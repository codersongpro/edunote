import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  MAX_BACKUP_BYTES,
  MAX_BACKUP_DATA_FILES,
  MAX_BACKUP_JSON_BYTES,
  applyBackupTransaction,
  parseBackup,
  type BackupSettingsStore,
} from '../backup';
import { atomicWriteJsonSync } from '../atomicFile';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edunote-backup-test-'));
  tempDirs.push(dir);
  return dir;
}

function backup(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    app: 'EduNote',
    schemaVersion: 2,
    settings: { teacherName: '김교사' },
    dataFiles: { memo: { text: '기존 메모' } },
    localStorage: { eduNote_test: 'value' },
    ...overrides,
  });
}

describe('parseBackup', () => {
  it('v1 백업을 지원하되 저장 경로 설정은 복원 대상에서 제외한다', () => {
    const parsed = parseBackup(backup({
      schemaVersion: 1,
      settings: {
        teacherName: '김교사',
        appDataDir: 'C:\\Users\\Public\\attacker',
        saveDir: 'C:\\Users\\Public',
      },
      localStorage: undefined,
    }));

    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.settings).toEqual({ teacherName: '김교사' });
    expect(parsed.localStorage).toEqual({});
    expect(parsed.warnings).toContain('저장 경로 설정 2개는 안전을 위해 제외했습니다.');
  });

  it('백업 전체 크기, 데이터 파일 수, JSON 파일별 크기를 제한한다', () => {
    expect(() => parseBackup(backup(), MAX_BACKUP_BYTES + 1)).toThrow('50MiB');

    const tooManyFiles = Object.fromEntries(
      Array.from({ length: MAX_BACKUP_DATA_FILES + 1 }, (_, i) => [`file-${i}`, { i }]),
    );
    expect(() => parseBackup(backup({ dataFiles: tooManyFiles }))).toThrow('200개');

    const oversized = { text: '가'.repeat(MAX_BACKUP_JSON_BYTES) };
    expect(() => parseBackup(backup({ dataFiles: { oversized } }))).toThrow('5MiB');
  });

  it('경로로 해석될 수 있는 데이터 파일명과 지원하지 않는 schema를 거부한다', () => {
    expect(() => parseBackup(backup({ dataFiles: { '../package': {} } }))).toThrow('파일 이름');
    expect(() => parseBackup(backup({ schemaVersion: 3 }))).toThrow('지원하지 않는');
  });
});

class MemorySettingsStore implements BackupSettingsStore {
  constructor(private readonly values = new Map<string, unknown>()) {}

  has(key: string): boolean { return this.values.has(key); }
  get(key: string): unknown { return this.values.get(key); }
  set(key: string, value: unknown): void { this.values.set(key, value); }
  delete(key: string): void { this.values.delete(key); }
}

describe('applyBackupTransaction', () => {
  it('두 번째 데이터 파일 쓰기가 실패하면 설정과 첫 번째 파일을 원래대로 되돌린다', () => {
    const dataDir = makeTempDir();
    atomicWriteJsonSync(path.join(dataDir, 'first.json'), { value: 'before' });
    const settings = new MemorySettingsStore(new Map([['teacherName', '기존 교사']]));
    const parsed = parseBackup(backup({
      settings: { teacherName: '새 교사' },
      dataFiles: { first: { value: 'after' }, second: { value: 'new' } },
    }));
    let writes = 0;

    expect(() => applyBackupTransaction(parsed, {
      dataDir,
      settings,
      sanitizeSetting: (_key, value) => value,
      writeJson: (filePath, value) => {
        writes += 1;
        if (writes === 2) throw new Error('disk full');
        atomicWriteJsonSync(filePath, value);
      },
    })).toThrow('disk full');

    expect(settings.get('teacherName')).toBe('기존 교사');
    expect(JSON.parse(fs.readFileSync(path.join(dataDir, 'first.json'), 'utf8'))).toEqual({ value: 'before' });
    expect(fs.existsSync(path.join(dataDir, 'second.json'))).toBe(false);
  });

  it('성공 후 반환된 rollback을 호출하면 적용 전 상태로 되돌린다', () => {
    const dataDir = makeTempDir();
    const settings = new MemorySettingsStore();
    const parsed = parseBackup(backup({
      settings: { teacherName: '새 교사' },
      dataFiles: { memo: { value: 'new' } },
    }));

    const rollback = applyBackupTransaction(parsed, {
      dataDir,
      settings,
      sanitizeSetting: (_key, value) => value,
    });
    expect(settings.get('teacherName')).toBe('새 교사');
    expect(fs.existsSync(path.join(dataDir, 'memo.json'))).toBe(true);

    rollback();
    expect(settings.has('teacherName')).toBe(false);
    expect(fs.existsSync(path.join(dataDir, 'memo.json'))).toBe(false);
  });
});

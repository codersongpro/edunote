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
  serializeValidatedBackup,
  writeValidatedBackup,
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

describe('serializeValidatedBackup', () => {
  const payload = (overrides: Record<string, unknown> = {}) => ({
    app: 'EduNote',
    schemaVersion: 2,
    exportedAt: '2026-09-06T00:00:00.000Z',
    settings: { teacherName: '김교사' },
    dataFiles: { memo: { text: '메모' } },
    localStorage: { eduNote_test: 'value' },
    ...overrides,
  });

  it('실제로 기록할 들여쓰기 JSON을 기존 복원 검증기로 왕복 확인한다', () => {
    const raw = serializeValidatedBackup(payload());
    expect(raw).toContain('\n  "schemaVersion": 2');
    expect(parseBackup(raw).dataFiles.memo).toEqual({ text: '메모' });
  });

  it('200개 데이터 파일은 허용하고 201개는 기록 전에 거부한다', () => {
    const twoHundred = Object.fromEntries(Array.from({ length: MAX_BACKUP_DATA_FILES }, (_, index) => [`file-${index}`, { index }]));
    expect(() => serializeValidatedBackup(payload({ dataFiles: twoHundred }))).not.toThrow();
    expect(() => serializeValidatedBackup(payload({ dataFiles: { ...twoHundred, overflow: {} } }))).toThrow('200개');
  });

  it('파일별 5MiB 경계는 허용하고 1바이트 초과는 기록 전에 거부한다', () => {
    const emptyValue = { text: '' };
    const overhead = Buffer.byteLength(JSON.stringify(emptyValue, null, 2), 'utf8');
    const atLimit = { text: 'x'.repeat(MAX_BACKUP_JSON_BYTES - overhead) };
    expect(() => serializeValidatedBackup(payload({ dataFiles: { atLimit } }))).not.toThrow();
    expect(() => serializeValidatedBackup(payload({
      dataFiles: { oversized: { text: `${atLimit.text}x` } },
    }))).toThrow('5MiB');
  });

  it('전체 50MiB 경계는 허용하고 1바이트 초과는 기록 전에 거부한다', () => {
    const emptyPayload = payload({ localStorage: { huge: '' } });
    const overhead = Buffer.byteLength(JSON.stringify(emptyPayload, null, 2), 'utf8');
    const atLimit = 'x'.repeat(MAX_BACKUP_BYTES - overhead);
    expect(() => serializeValidatedBackup(payload({ localStorage: { huge: atLimit } }))).not.toThrow();
    expect(() => serializeValidatedBackup(payload({ localStorage: { huge: `${atLimit}x` } }))).toThrow('50MiB');
  });

  it('순환 참조는 파일 기록에 앞선 직렬화 단계에서 실패한다', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => serializeValidatedBackup(payload({ settings: circular }))).toThrow();
  });

  it('수동·자동 백업 공용 쓰기는 검증 실패 시 대상 파일을 호출하지 않는다', () => {
    let writes = 0;
    const invalid = payload({ dataFiles: Object.fromEntries(
      Array.from({ length: MAX_BACKUP_DATA_FILES + 1 }, (_, index) => [`file-${index}`, {}]),
    ) });
    const writer = () => { writes += 1; };

    expect(() => writeValidatedBackup('manual.json', invalid, writer)).toThrow('200개');
    expect(() => writeValidatedBackup('auto.json', invalid, writer)).toThrow('200개');
    expect(writes).toBe(0);
  });

  it('검증 성공 시 실제 검증한 문자열을 한 번만 기록한다', () => {
    const calls: Array<{ path: string; data: string; encoding: BufferEncoding }> = [];
    writeValidatedBackup('backup.json', payload(), (filePath, data, encoding) => {
      calls.push({ path: filePath, data, encoding });
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe('backup.json');
    expect(calls[0].encoding).toBe('utf8');
    expect(parseBackup(calls[0].data).schemaVersion).toBe(2);
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

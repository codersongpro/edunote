import * as fs from 'fs';
import * as path from 'path';
import { atomicWriteFileSync, atomicWriteJsonSync } from './atomicFile';

export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;
export const MAX_BACKUP_DATA_FILES = 200;
export const MAX_BACKUP_JSON_BYTES = 5 * 1024 * 1024;

const BLOCKED_SETTING_KEYS = new Set([
  'appDataDir',
  'saveDir',
  'geminiApiKey',
  'geminiPaidApiKey',
  'geminiApiKeyEnc',
  'geminiPaidApiKeyEnc',
  'naramarketApiKey',
  'naramarketApiKeyEnc',
]);

export interface ParsedBackup {
  schemaVersion: 1 | 2;
  settings: Record<string, unknown>;
  dataFiles: Record<string, unknown>;
  localStorage: Record<string, string>;
  warnings: string[];
}

export interface BackupSettingsStore {
  has(key: string): boolean;
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  delete(key: string): void;
}

export interface BackupRestoreOptions {
  dataDir: string;
  settings: BackupSettingsStore;
  sanitizeSetting: (key: string, value: unknown) => unknown | undefined;
  writeJson?: (filePath: string, value: unknown) => void;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function serializedBytes(value: unknown): number {
  // 실제 저장 형식(들여쓰기 2칸)의 바이트 수를 기준으로 5MiB 제한을 적용합니다.
  return Buffer.byteLength(JSON.stringify(value, null, 2), 'utf8');
}

export function parseBackup(raw: string, sourceSizeBytes = Buffer.byteLength(raw, 'utf8')): ParsedBackup {
  if (sourceSizeBytes > MAX_BACKUP_BYTES) {
    throw new Error('백업 파일은 최대 50MiB까지 불러올 수 있습니다.');
  }

  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    throw new Error('백업 파일이 손상되어 읽을 수 없습니다.');
  }
  if (!isPlainRecord(input) || input.app !== 'EduNote') {
    throw new Error('EduNote 백업 파일 형식이 아닙니다.');
  }

  const rawVersion = input.schemaVersion ?? 1;
  if (rawVersion !== 1 && rawVersion !== 2) {
    throw new Error('지원하지 않는 EduNote 백업 버전입니다.');
  }
  if (!isPlainRecord(input.settings) || !isPlainRecord(input.dataFiles)) {
    throw new Error('EduNote 백업 파일 형식이 아닙니다.');
  }

  const warnings: string[] = [];
  const settings: Record<string, unknown> = {};
  let blockedPathCount = 0;
  for (const [key, value] of Object.entries(input.settings)) {
    if (key === 'appDataDir' || key === 'saveDir') {
      blockedPathCount += 1;
      continue;
    }
    if (BLOCKED_SETTING_KEYS.has(key)) continue;
    settings[key] = value;
  }
  if (blockedPathCount > 0) {
    warnings.push(`저장 경로 설정 ${blockedPathCount}개는 안전을 위해 제외했습니다.`);
  }

  const dataEntries = Object.entries(input.dataFiles);
  if (dataEntries.length > MAX_BACKUP_DATA_FILES) {
    throw new Error('백업 데이터 파일은 최대 200개까지 불러올 수 있습니다.');
  }
  const dataFiles: Record<string, unknown> = {};
  for (const [name, value] of dataEntries) {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(name)) {
      throw new Error(`안전하지 않은 데이터 파일 이름입니다: ${name}`);
    }
    if (serializedBytes(value) > MAX_BACKUP_JSON_BYTES) {
      throw new Error(`데이터 파일 ${name}.json은 최대 5MiB까지 불러올 수 있습니다.`);
    }
    dataFiles[name] = value;
  }

  const localStorage: Record<string, string> = {};
  if (input.localStorage !== undefined) {
    if (!isPlainRecord(input.localStorage)) {
      throw new Error('백업의 브라우저 저장 데이터 형식이 올바르지 않습니다.');
    }
    let ignored = 0;
    for (const [key, value] of Object.entries(input.localStorage)) {
      if (typeof value === 'string') localStorage[key] = value;
      else ignored += 1;
    }
    if (ignored > 0) warnings.push(`문자열이 아닌 브라우저 저장 값 ${ignored}개를 제외했습니다.`);
  }

  return { schemaVersion: rawVersion, settings, dataFiles, localStorage, warnings };
}

/**
 * 설정과 JSON 파일을 한 트랜잭션처럼 적용합니다. 반환된 rollback은 renderer의
 * localStorage 복원이 실패한 경우 메인 프로세스 변경까지 되돌릴 때 사용합니다.
 */
export function applyBackupTransaction(
  backup: ParsedBackup,
  options: BackupRestoreOptions,
): () => void {
  fs.mkdirSync(options.dataDir, { recursive: true });

  const settingChanges = Object.entries(backup.settings)
    .map(([key, value]) => ({ key, value: options.sanitizeSetting(key, value) }))
    .filter((entry): entry is { key: string; value: unknown } => entry.value !== undefined);
  const settingSnapshots = settingChanges.map(({ key }) => ({
    key,
    existed: options.settings.has(key),
    value: options.settings.get(key),
  }));
  const fileSnapshots = Object.keys(backup.dataFiles).map(name => {
    const filePath = path.join(options.dataDir, `${name}.json`);
    return {
      filePath,
      existed: fs.existsSync(filePath),
      content: fs.existsSync(filePath) ? fs.readFileSync(filePath) : null,
    };
  });

  let rolledBack = false;
  const rollback = (): void => {
    if (rolledBack) return;
    let firstError: unknown;

    for (const snapshot of settingSnapshots.slice().reverse()) {
      try {
        if (snapshot.existed) options.settings.set(snapshot.key, snapshot.value);
        else options.settings.delete(snapshot.key);
      } catch (error) {
        firstError ??= error;
      }
    }
    for (const snapshot of fileSnapshots.slice().reverse()) {
      try {
        if (snapshot.existed && snapshot.content) {
          atomicWriteFileSync(snapshot.filePath, snapshot.content);
        } else if (fs.existsSync(snapshot.filePath)) {
          fs.unlinkSync(snapshot.filePath);
        }
      } catch (error) {
        firstError ??= error;
      }
    }
    if (firstError) throw new Error('백업 복원 중 변경사항을 되돌리지 못했습니다.', { cause: firstError });
    rolledBack = true;
  };

  try {
    const writeJson = options.writeJson ?? atomicWriteJsonSync;
    for (const [name, value] of Object.entries(backup.dataFiles)) {
      writeJson(path.join(options.dataDir, `${name}.json`), value);
    }
    for (const { key, value } of settingChanges) options.settings.set(key, value);
  } catch (error) {
    try {
      rollback();
    } catch (rollbackError) {
      throw new AggregateError([error, rollbackError], '백업 복원과 자동 복구가 모두 실패했습니다.');
    }
    throw error;
  }

  return rollback;
}

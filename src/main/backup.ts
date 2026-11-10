import * as fs from 'fs';
import * as path from 'path';
import { atomicWriteFileSync, atomicWriteJsonSync } from './atomicFile';

export {
  MAX_BACKUP_BYTES,
  MAX_BACKUP_DATA_FILES,
  MAX_BACKUP_JSON_BYTES,
  parseBackup,
  serializeValidatedBackup,
  type ParsedBackup,
} from './backupFormat';
import { serializeValidatedBackup, type ParsedBackup } from './backupFormat';

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

export function writeValidatedBackup(
  targetPath: string,
  payload: unknown,
  writeFile: (filePath: string, data: string, encoding: BufferEncoding) => void = atomicWriteFileSync,
): void {
  const raw = serializeValidatedBackup(payload);
  writeFile(targetPath, raw, 'utf8');
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

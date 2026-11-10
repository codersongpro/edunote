// 백업 파일 형식 검증·직렬화(순수 로직). fs·Buffer를 쓰지 않아 데스크톱과 웹판이 같은 규칙으로
// 백업을 만들고 읽는다 — 한쪽에서 만든 백업 파일을 다른 쪽에서 그대로 복원할 수 있다.

const textEncoder = new TextEncoder();
function utf8Bytes(text: string): number {
  return textEncoder.encode(text).length;
}

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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function serializedBytes(value: unknown): number {
  // 실제 저장 형식(들여쓰기 2칸)의 바이트 수를 기준으로 5MiB 제한을 적용합니다.
  return utf8Bytes(JSON.stringify(value, null, 2));
}

export function parseBackup(raw: string, sourceSizeBytes = utf8Bytes(raw)): ParsedBackup {
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

/** 실제 파일에 기록할 문자열을 먼저 만들고, 같은 문자열을 복원 검증기로 확인합니다. */
export function serializeValidatedBackup(payload: unknown): string {
  const raw = JSON.stringify(payload, null, 2);
  if (raw === undefined) throw new Error('백업 데이터를 JSON으로 변환할 수 없습니다.');
  parseBackup(raw, utf8Bytes(raw));
  return raw;
}

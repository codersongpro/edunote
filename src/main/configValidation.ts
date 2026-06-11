import * as path from 'path';

// config:set / 백업 복원에서 들어오는 설정값을 키별 타입에 맞게 검증한다.
// 백업 파일이 임의로 수정되었거나 렌더러가 잘못된 값을 보내도
// electron-store에 비정상 타입이 저장되지 않도록 막는다.

const MAX_STRING_VALUE_CHARS = 10_000;

const BOOLEAN_KEYS = new Set([
  'alwaysAskPath',
  'darkMode',
  'apiKeyLastUsable',
  'onboardingDismissed',
  'privacyModeEnabled',
  'reviewChecklistEnabled',
]);

const PATH_KEYS = new Set(['saveDir', 'appDataDir']);

// 유효하면 저장해도 되는 값을 반환하고, 무효하면 undefined를 반환한다(해당 키는 건너뜀).
export function sanitizeConfigEntry(key: string, value: unknown): unknown | undefined {
  if (BOOLEAN_KEYS.has(key)) {
    return typeof value === 'boolean' ? value : undefined;
  }

  if (key === 'apiTier') {
    return value === 'free' || value === 'paid' ? value : undefined;
  }

  if (typeof value !== 'string' || value.length > MAX_STRING_VALUE_CHARS) {
    return undefined;
  }

  if (PATH_KEYS.has(key)) {
    // 빈 문자열(미설정) 또는 절대 경로만 허용한다.
    return value === '' || path.isAbsolute(value) ? value : undefined;
  }

  return value;
}

// 설정값 검증 규칙(순수 로직). 데스크톱(configValidation.ts)과 웹판이 같은 규칙을 쓴다.
// 경로 판정만 플랫폼마다 달라 호출부에서 주입받는다.

export const MAX_STRING_VALUE_CHARS = 10_000;

// 렌더러가 읽고 쓸 수 있는 설정 키 허용 목록(시크릿은 절대 넣지 않는다). 데스크톱 IPC와 웹판이 공유한다.
// 새 설정 키를 추가하면 아래 sanitizeConfigEntryWith의 값 검증 규칙도 함께 갱신해야 한다.
export const ALLOWED_CONFIG_KEYS = ['saveDir', 'appDataDir', 'alwaysAskPath', 'teacherName', 'schoolName', 'institution', 'schoolLevel', 'gradeClass', 'studentNames', 'studentMaleNames', 'studentFemaleNames', 'darkMode', 'apiTier', 'apiKeyLastUsable', 'onboardingDismissed', 'privacyModeEnabled', 'reviewChecklistEnabled', 'cautionTerms', 'lastBackupAt', 'autoBackupInterval', 'fontSize', 'chatFirebaseConfig', 'chatActiveRoomId', 'chatRoomHistory', 'neisByteLimits', 'eduMaterialWebSearch'];

const BOOLEAN_KEYS = new Set([
  'alwaysAskPath',
  'darkMode',
  'apiKeyLastUsable',
  'onboardingDismissed',
  'privacyModeEnabled',
  'reviewChecklistEnabled',
  'eduMaterialWebSearch',
]);

const PATH_KEYS = new Set(['saveDir', 'appDataDir']);

// 유효하면 저장해도 되는 값을 반환하고, 무효하면 undefined를 반환한다(해당 키는 건너뜀).
export function sanitizeConfigEntryWith(
  key: string,
  value: unknown,
  isAbsolutePath: (value: string) => boolean,
): unknown | undefined {
  if (BOOLEAN_KEYS.has(key)) {
    return typeof value === 'boolean' ? value : undefined;
  }

  if (key === 'apiTier') {
    return value === 'free' || value === 'paid' ? value : undefined;
  }

  if (key === 'autoBackupInterval') {
    return value === 'off' || value === 'daily' || value === 'weekly' ? value : undefined;
  }

  if (key === 'fontSize') {
    return typeof value === 'number' && Number.isInteger(value) && value >= 75 && value <= 150 ? value : undefined;
  }

  if (typeof value !== 'string' || value.length > MAX_STRING_VALUE_CHARS) {
    return undefined;
  }

  if (PATH_KEYS.has(key)) {
    // 빈 문자열(미설정) 또는 절대 경로만 허용한다.
    return value === '' || isAbsolutePath(value) ? value : undefined;
  }

  return value;
}

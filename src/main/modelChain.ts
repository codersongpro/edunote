// 모델 폴백 체인의 순수 로직 (테스트 가능하도록 SDK 의존 없이 분리).
//
// 이전 폴백 시도(v1.3.1 무렵)는 모델 이름을 하드코딩으로 추측해서,
// 사용자 키에서 제공되지 않는 모델로 요청을 낭비하고 같은 오류를 반복했다.
// 이번에는 키로 실제 조회한 모델 목록과 선호 순서의 교집합만 폴백 후보로 쓴다.

// 선호 순서 — 무료 키는 분당 허용량이 큰 경량 모델을 앞에 둔다.
// gemini-3.1-flash-lite(무료 티어 제공, 안정판)를 최우선으로 두고, 프로젝트에 아직
// 3세대 모델이 열리지 않은 키를 위해 2.5/2.0 계열을 그대로 폴백으로 남겨둔다.
// (buildModelChain이 키로 실제 조회한 모델과 교집합만 쓰므로, 없는 이름은 안전하게 건너뛴다.)
export const FREE_MODEL_PREFERENCE = [
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
];

export const PAID_MODEL_PREFERENCE = [
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];

// 폴백 시도 횟수 상한 — 모델당 최대 90초 대기이므로 전체 지연을 묶어둔다.
const MAX_CHAIN_LENGTH = 3;

// 키에서 실제 사용 가능한 모델 목록(availableNames)과 선호 순서의 교집합을 만든다.
// 목록 조회에 실패해 availableNames가 null이면 기본 모델 1개로만 동작한다(종전과 동일).
export function buildModelChain(preference: string[], availableNames: string[] | null): string[] {
  if (!availableNames || availableNames.length === 0) return [preference[0]];
  const normalized = new Set(availableNames.map(name => name.replace(/^models\//, '')));
  const chain = preference.filter(model => normalized.has(model));
  if (chain.length === 0) return [preference[0]];
  return chain.slice(0, MAX_CHAIN_LENGTH);
}

function errorText(error: unknown): string {
  const msg = (error as { message?: string })?.message || '';
  const str = String(error ?? '');
  return `${msg} ${str}`;
}

// 429 응답에 Google이 포함하는 재시도 대기 시간(RetryInfo retryDelay)을 ms로 파싱한다.
// 예: '"retryDelay":"22s"', 'Please retry in 22.53s'. 없으면 null.
export function getRetryDelayMs(error: unknown): number | null {
  const text = errorText(error);
  const match =
    text.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/i) ||
    text.match(/retry in (\d+(?:\.\d+)?)\s*s/i);
  if (!match) return null;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.round(seconds * 1000);
}

// 일일 한도(PerDay) 초과인지 판별 — 이 경우 같은 모델 재시도는 의미가 없다.
// 예: quotaId "GenerateRequestsPerDayPerProjectPerModel-FreeTier"
export function isDailyQuotaError(error: unknown): boolean {
  const text = errorText(error).toLowerCase();
  return /perday|per day|daily limit|requests per day/.test(text);
}

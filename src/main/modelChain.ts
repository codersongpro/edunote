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

// gemini-{major}.{minor}-flash / -flash-lite / -pro 형태의 정식 안정판 이름만 인식한다.
// -preview, -exp 등 접미사가 붙은 실험판은 제외해, 불안정한 신모델이 자동으로
// 선택되지 않게 한다(정식 전환 전까지는 기존 안전망 목록이 계속 쓰인다).
const STABLE_MODEL_PATTERN = /^gemini-(\d+)\.(\d+)-(flash-lite|flash|pro)$/;

export type ModelTier = 'flash-lite' | 'flash' | 'pro';

interface StableModel {
  name: string;
  major: number;
  minor: number;
  tier: ModelTier;
}

function parseStableModels(availableNames: string[]): StableModel[] {
  const parsed: StableModel[] = [];
  for (const raw of availableNames) {
    const name = raw.replace(/^models\//, '');
    const match = name.match(STABLE_MODEL_PATTERN);
    if (!match) continue;
    parsed.push({ name, major: Number(match[1]), minor: Number(match[2]), tier: match[3] as ModelTier });
  }
  return parsed;
}

// 세대(버전)가 다르면 항상 최신 세대를 앞세우고, 같은 세대 안에서만 tierOrder로
// 우선순위를 가른다(무료: flash-lite가 분당 요청 한도가 넉넉해 우선, 유료: pro가 품질 우선).
// → Google이 새 모델을 내면 코드 수정 없이 다음 실행부터 자동으로 1순위가 된다.
export function buildDynamicPreference(tierOrder: readonly ModelTier[], availableNames: string[] | null): string[] {
  if (!availableNames) return [];
  const tierRank = new Map(tierOrder.map((tier, index) => [tier, index]));
  return parseStableModels(availableNames)
    .filter(m => tierRank.has(m.tier))
    .sort((a, b) => b.major - a.major || b.minor - a.minor || tierRank.get(a.tier)! - tierRank.get(b.tier)!)
    .map(m => m.name);
}

export const FREE_TIER_ORDER: readonly ModelTier[] = ['flash-lite', 'flash'];
export const PAID_TIER_ORDER: readonly ModelTier[] = ['pro', 'flash', 'flash-lite'];

// 동적으로 감지한 최신 모델을 우선 사용하고, 감지 실패(목록 조회 실패)나 예상 밖
// 이름 규칙 변경에 대비해 기존 고정 목록을 안전망으로 뒤에 붙인다.
export function resolvePreference(
  tierOrder: readonly ModelTier[],
  staticFallback: readonly string[],
  availableNames: string[] | null,
): string[] {
  const seen = new Set<string>();
  const combined: string[] = [];
  for (const name of [...buildDynamicPreference(tierOrder, availableNames), ...staticFallback]) {
    if (!seen.has(name)) {
      seen.add(name);
      combined.push(name);
    }
  }
  return combined;
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

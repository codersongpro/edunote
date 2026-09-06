// 일반 텍스트 생성 모델 정책은 아래 공식 모델·가격·사용 중단 문서를 사람이 함께
// 확인한 뒤 갱신한다. API 목록에 보인다는 사실만으로 무료 제공이나 정식 지원을
// 추측하지 않는다. 새 모델은 이 정책을 앱 업데이트로 갱신하기 전까지 자동 선택하지 않는다.
// https://ai.google.dev/gemini-api/docs/models
// https://ai.google.dev/gemini-api/docs/pricing
// https://ai.google.dev/gemini-api/docs/deprecations
export const MODEL_POLICY_UPDATED_AT = '2026-09-06';
export const MODEL_POLICY_SOURCE = 'Google Gemini 모델·가격·사용 중단 공식 문서';

export type ApiTier = 'free' | 'paid';

export interface VerifiedModelPolicy {
  name: string;
  // 동일 요금제에서 최신 모델부터 정렬하기 위한 공식 출시 순서다.
  releaseOrder: number;
  free: boolean;
  paid: boolean;
  stable: boolean;
  generative: boolean;
  // 유료 모드의 기존 품질 우선순위. 무료 자격 판정에는 사용하지 않는다.
  paidPriority?: number;
}

// 2026-09-06 공식 문서에서 정식·지원 중·일반 텍스트 생성·요금제 제공 여부를 확인한 목록.
// 숫자는 모델명 추측용이 아니라 이 검증 목록 안에서만 사용하는 출시 순서다.
export const VERIFIED_GENERAL_MODELS: readonly VerifiedModelPolicy[] = [
  { name: 'gemini-3.8-flash', releaseOrder: 380, free: true, paid: true, stable: true, generative: true, paidPriority: 1 },
  { name: 'gemini-3.7-flash', releaseOrder: 370, free: true, paid: true, stable: true, generative: true, paidPriority: 1 },
  { name: 'gemini-3.6-flash', releaseOrder: 360, free: true, paid: true, stable: true, generative: true, paidPriority: 1 },
  { name: 'gemini-3.5-flash', releaseOrder: 350, free: true, paid: true, stable: true, generative: true, paidPriority: 1 },
  { name: 'gemini-3.5-flash-lite', releaseOrder: 349, free: true, paid: true, stable: true, generative: true, paidPriority: 2 },
  { name: 'gemini-3.1-flash-lite', releaseOrder: 310, free: true, paid: true, stable: true, generative: true, paidPriority: 2 },
];

const MAX_CHAIN_LENGTH = 3;

export function buildModelChain(preference: readonly string[], availableNames: string[] | null): string[] {
  if (!availableNames?.length) return [];
  const normalized = new Set(availableNames.map(name => name.replace(/^models\//, '')));
  return preference.filter(model => normalized.has(model)).slice(0, MAX_CHAIN_LENGTH);
}

export function selectVerifiedModels(
  tier: ApiTier,
  availableNames: string[],
  policy: readonly VerifiedModelPolicy[] = VERIFIED_GENERAL_MODELS,
): string[] {
  const normalized = new Set(availableNames.map(name => name.replace(/^models\//, '')));
  return policy
    .filter(model =>
      normalized.has(model.name) &&
      model.stable &&
      model.generative &&
      (tier === 'free' ? model.free : model.paid),
    )
    .sort((a, b) =>
      tier === 'paid'
        ? (a.paidPriority ?? Number.MAX_SAFE_INTEGER) - (b.paidPriority ?? Number.MAX_SAFE_INTEGER) || b.releaseOrder - a.releaseOrder
        : b.releaseOrder - a.releaseOrder,
    )
    .map(model => model.name)
    .slice(0, MAX_CHAIN_LENGTH);
}

interface LastVerifiedEntry {
  models: string[];
  verifiedAt: number;
}

export class LastVerifiedModelCache {
  private readonly entries = new Map<string, LastVerifiedEntry>();

  constructor(private readonly ttlMs: number) {}

  private entryKey(keyId: string, tier: ApiTier): string {
    return `${keyId}:${tier}`;
  }

  set(keyId: string, tier: ApiTier, models: string[], verifiedAt = Date.now()): void {
    this.entries.set(this.entryKey(keyId, tier), { models: [...models], verifiedAt });
  }

  get(keyId: string, tier: ApiTier, now = Date.now(), allowed?: ReadonlySet<string>): string[] | null {
    const key = this.entryKey(keyId, tier);
    const entry = this.entries.get(key);
    if (!entry || now - entry.verifiedAt > this.ttlMs) {
      this.entries.delete(key);
      return null;
    }
    if (allowed && entry.models.some(model => !allowed.has(model))) {
      this.entries.delete(key);
      return null;
    }
    return [...entry.models];
  }

  clearKey(keyId: string): void {
    this.entries.delete(this.entryKey(keyId, 'free'));
    this.entries.delete(this.entryKey(keyId, 'paid'));
  }

  clear(): void {
    this.entries.clear();
  }
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

// 일반 생성 쿼터 오류와 "이 모델/등급에서는 검색 그라운딩을 쓸 수 없음" 오류를
// 구분한다. 검색 전용 호출에서 이 오류가 나면 모델 자체를 차단하지 않고 다음
// 후보로 넘어가야, 이어지는 일반 문서 생성에서 최신 모델을 그대로 쓸 수 있다.
export function isSearchGroundingUnavailableError(error: unknown): boolean {
  const text = errorText(error).toLowerCase();
  const mentionsSearchTool = /google search|search grounding|grounding with google|grounded generation|google_search/.test(text);
  const mentionsUnavailable = /not supported|unsupported|not available|unavailable|free tier|permission|not enabled|invalid argument/.test(text);
  return mentionsSearchTool && mentionsUnavailable;
}

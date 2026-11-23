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
  // 무료 모드에서 한도 초과에 대비해 마지막 후보로 두는 검증된 경량 모델.
  liteSafety?: boolean;
}

// 2026-09-06 공식 문서에서 정식·지원 중·일반 텍스트 생성·요금제 제공 여부를 확인한 목록.
// 숫자는 모델명 추측용이 아니라 이 검증 목록 안에서만 사용하는 출시 순서다.
export const VERIFIED_GENERAL_MODELS: readonly VerifiedModelPolicy[] = [
  { name: 'gemini-3.8-flash', releaseOrder: 380, free: true, paid: true, stable: true, generative: true, paidPriority: 1 },
  { name: 'gemini-3.7-flash', releaseOrder: 370, free: true, paid: true, stable: true, generative: true, paidPriority: 1 },
  { name: 'gemini-3.6-flash', releaseOrder: 360, free: true, paid: true, stable: true, generative: true, paidPriority: 1 },
  { name: 'gemini-3.5-flash', releaseOrder: 350, free: true, paid: true, stable: true, generative: true, paidPriority: 1 },
  { name: 'gemini-3.5-flash-lite', releaseOrder: 349, free: true, paid: true, stable: true, generative: true, paidPriority: 2, liteSafety: true },
  { name: 'gemini-3.1-flash-lite', releaseOrder: 310, free: true, paid: true, stable: true, generative: true, paidPriority: 2, liteSafety: true },
];

const MAX_CHAIN_LENGTH = 3;

// ─── 무료 모드 새 모델 자동 탐색 ───────────────────────────────────────────
// Google이 새 모델을 내놓아도 앱 업데이트 없이 무료 키로 바로 써 보게 한다.
// - 무료 키는 결제가 연결되지 않은 프로젝트라 새 모델을 시도해도 요금이 나가지 않는다.
//   무료가 아니면 429(limit: 0)·403 같은 오류가 오고, 그 모델은 하루 동안 빼고 다음 후보로 넘어간다.
// - 유료 모드는 모르는 모델을 자동으로 쓰면 과금될 수 있으므로 검증 목록만 쓴다.
// - 이름이 "gemini-<버전>-<계열>"인 정식판만 받는다. 미리보기·실험판·음성·이미지·임베딩 모델은 뺀다.
const AUTO_MODEL_NAME = /^gemini-(\d+)(?:\.(\d+))?-([a-z]+(?:-[a-z]+)?)$/;
const NON_GENERAL_TOKENS = /(preview|exp|experimental|tts|image|live|audio|embedding|native|thinking|computer|robotics|latest|customtools|search|nano)/;

// "gemini-3.8-flash" → 380, "gemini-4-hydrogen" → 400. 정식판 일반 모델 이름이 아니면 null.
export function modelVersionOrder(name: string): number | null {
  const bare = name.replace(/^models\//, '');
  const m = bare.match(AUTO_MODEL_NAME);
  if (!m || NON_GENERAL_TOKENS.test(m[3])) return null;
  return Number(m[1]) * 100 + Number(m[2] ?? 0) * 10;
}

const isLiteName = (name: string) => /-lite$/.test(name);

// 검증 목록에 없지만, 검증된 무료 모델 중 가장 새 모델보다 나중에 나온 정식 일반 모델.
// 오래된 미등재 모델(사용 중단 예정 등)은 고르지 않는다.
export function discoverNewFreeModels(
  availableNames: string[],
  policy: readonly VerifiedModelPolicy[] = VERIFIED_GENERAL_MODELS,
): string[] {
  const known = new Set(policy.map(model => model.name));
  const newestVerified = Math.max(0, ...policy.filter(model => model.free && model.stable).map(model => model.releaseOrder));
  return [...new Set(availableNames.map(name => name.replace(/^models\//, '')))]
    .filter(name => !known.has(name))
    .map(name => ({ name, order: modelVersionOrder(name) }))
    .filter((item): item is { name: string; order: number } => item.order !== null && item.order > newestVerified)
    .sort((a, b) => b.order - a.order || Number(isLiteName(a.name)) - Number(isLiteName(b.name)))
    .map(item => item.name);
}

// 무료 모드 후보 순서: 이 키에서 쓸 수 있는 가장 새 무료 모델 → 다음으로 새 모델 → 한도 대비 Lite.
// 같은 버전이면 Lite보다 일반 모델을 먼저 쓴다.
export function selectFreeModels(
  availableNames: string[],
  policy: readonly VerifiedModelPolicy[] = VERIFIED_GENERAL_MODELS,
  includeAuto = true,
): { chain: string[]; autoDiscovered: string[] } {
  const normalized = new Set(availableNames.map(name => name.replace(/^models\//, '')));
  const verified = policy
    .filter(model => normalized.has(model.name) && model.stable && model.generative && model.free)
    .map(model => ({ name: model.name, order: model.releaseOrder }));
  const auto = includeAuto ? discoverNewFreeModels(availableNames, policy) : [];
  const ranked = [
    ...auto.map(name => ({ name, order: modelVersionOrder(name) ?? 0 })),
    ...verified,
  ].sort((a, b) => b.order - a.order || Number(isLiteName(a.name)) - Number(isLiteName(b.name)));

  const chain = ranked.slice(0, MAX_CHAIN_LENGTH - 1).map(item => item.name);
  // 한도가 넉넉한 검증된 Lite를 마지막 안전판으로 둔다.
  const lite = verified.filter(item => isLiteName(item.name)).sort((a, b) => b.order - a.order)[0];
  if (lite && !chain.includes(lite.name)) chain.push(lite.name);
  for (const item of ranked) {
    if (chain.length >= MAX_CHAIN_LENGTH) break;
    if (!chain.includes(item.name)) chain.push(item.name);
  }
  return { chain, autoDiscovered: chain.filter(name => auto.includes(name)) };
}

// 무료 등급에서 아예 제공하지 않는 모델의 한도 오류("limit: 0").
// 분당·일일 한도 초과와 달리 기다려도 풀리지 않는다.
export function isZeroQuotaError(error: unknown): boolean {
  return /limit:\s*0(?![\d.])|free[_ ]tier[^.]*not (?:available|supported)/i.test(errorText(error));
}

export function buildModelChain(preference: readonly string[], availableNames: string[] | null): string[] {
  if (!availableNames?.length) return [];
  const normalized = new Set(availableNames.map(name => name.replace(/^models\//, '')));
  return preference.filter(model => normalized.has(model)).slice(0, MAX_CHAIN_LENGTH);
}

// 검증 목록 안에서만 고른다. 무료 모드는 selectFreeModels와 같은 순서(최신 우선, Lite는 안전판)다.
export function selectVerifiedModels(
  tier: ApiTier,
  availableNames: string[],
  policy: readonly VerifiedModelPolicy[] = VERIFIED_GENERAL_MODELS,
): string[] {
  if (tier === 'free') return selectFreeModels(availableNames, policy, false).chain;
  const normalized = new Set(availableNames.map(name => name.replace(/^models\//, '')));
  const eligible = policy
    .filter(model =>
      normalized.has(model.name) &&
      model.stable &&
      model.generative &&
      model.paid,
    )
    .sort((a, b) =>
      (a.paidPriority ?? Number.MAX_SAFE_INTEGER) - (b.paidPriority ?? Number.MAX_SAFE_INTEGER) || b.releaseOrder - a.releaseOrder,
    );
  return eligible.slice(0, MAX_CHAIN_LENGTH).map(model => model.name);
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

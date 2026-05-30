import { GoogleGenAI } from '@google/genai';

export type ApiTier = 'free' | 'paid';

const FREE_MODEL = 'gemini-2.5-flash-lite';
const PAID_MODEL = 'gemini-2.5-pro';

// 권한 거부/모델 미지원으로 차단된 모델 → 차단 해제 시각(unix ms)
// 1시간 후 자동 해제 → 상위 모델을 주기적으로 재시도하여 계정 상황 변화에 대응
const permanentlyBlockedModels = new Map<string, number>();
const PERMANENT_BLOCK_MS = 60 * 60 * 1000; // 1시간

// 쿼터 초과로 임시 차단된 모델 → 차단 해제 시각(unix ms)
const quotaBlockedModels = new Map<string, number>();

// 쿼터 초과 시 재시도 대기 시간 (60초)
const QUOTA_COOLDOWN_MS = 60_000;

// AI 호출 최대 대기 시간 (90초) — 응답이 멈춰도 무한정 기다리지 않도록
const REQUEST_TIMEOUT_MS = 90_000;

// Promise에 타임아웃을 거는 헬퍼 — 네트워크 hang으로 인한 무한 대기 방지
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('요청 시간이 초과되었습니다. 네트워크 상태를 확인하고 다시 시도해주세요.')),
      ms,
    );
    p.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

// API 키 변경 시 모든 차단 상태를 초기화 (외부에서 호출)
export function resetModelCache(): void {
  permanentlyBlockedModels.clear();
  quotaBlockedModels.clear();
}

// 특정 모델이 현재 차단 상태인지 확인 (만료 시 자동 해제)
function isBlocked(model: string): boolean {
  // 쿼터 임시 차단 (60초)
  const quotaUntil = quotaBlockedModels.get(model);
  if (quotaUntil !== undefined) {
    if (quotaUntil > Date.now()) return true;
    quotaBlockedModels.delete(model);
  }
  // 권한/모델 차단 (1시간 후 자동 해제 → 상위 모델 재시도)
  const permUntil = permanentlyBlockedModels.get(model);
  if (permUntil !== undefined) {
    if (permUntil > Date.now()) return true;
    permanentlyBlockedModels.delete(model);
  }
  return false;
}

// 쿼터 초과 에러인지 판단 (429, 503, RESOURCE_EXHAUSTED 등)
const isQuotaError = (error: unknown): boolean => {
  const msg = (error as any)?.message?.toLowerCase() || '';
  const str = (error as any)?.toString()?.toLowerCase() || '';
  const status = (error as any)?.status || (error as any)?.error?.code || (error as any)?.response?.status;
  const code = (error as any)?.error?.status;

  if (status === 429 || status === 503) return true;
  if (code === 'RESOURCE_EXHAUSTED' || code === 'UNAVAILABLE') return true;
  return msg.includes('429') || msg.includes('503') || msg.includes('quota') ||
    msg.includes('resource exhausted') || msg.includes('rate limit') ||
    msg.includes('exceeded') || msg.includes('overloaded') ||
    str.includes('quota') || str.includes('exceeded');
};

// 권한/모델 문제로 재시도 무의미한 에러인지 판단 (400/403/404)
// → 영구 차단 대상
const isPermanentBlockError = (error: unknown): boolean => {
  const errStatus = ((error as any)?.error?.status || '').toLowerCase();
  const httpStatus = (error as any)?.status ?? (error as any)?.error?.code ?? 0;
  return httpStatus === 400 || httpStatus === 403 || httpStatus === 404 ||
    errStatus === 'invalid_argument' || errStatus === 'not_found' || errStatus === 'permission_denied';
};

export interface GenerateOptions {
  systemInstruction?: string;
  temperature?: number;
  apiTier?: ApiTier;
}

export interface MultipartPart {
  text?: string;
  inlineData?: { data: string; mimeType: string };
}

// 텍스트 생성 (단일 프롬프트)
export async function generateContent(
  apiKey: string,
  prompt: string,
  options?: GenerateOptions,
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  let lastError: unknown = null;

  const model = options?.apiTier === 'paid' ? PAID_MODEL : FREE_MODEL;
  for (let i = 0; i < 1; i++) {
    if (isBlocked(model)) continue; // 차단된 모델 건너뜀

    try {
      const config: Record<string, unknown> = {};
      if (options?.systemInstruction) config.systemInstruction = options.systemInstruction;
      if (options?.temperature !== undefined) config.temperature = options.temperature;

      const result = await withTimeout(ai.models.generateContent({ model, contents: prompt, config }), REQUEST_TIMEOUT_MS);
      return result.text ?? '';
    } catch (error: unknown) {
      lastError = error;

      // 쿼터 초과 → 60초 임시 차단 후 다음 모델로
      if (isQuotaError(error)) {
        quotaBlockedModels.set(model, Date.now() + QUOTA_COOLDOWN_MS);
        console.warn(`[${model}] 쿼터 초과 → 60초 쿨다운`);
        continue;
      }

      // 권한 거부/모델 미지원 → 영구 차단
      if (isPermanentBlockError(error)) {
        permanentlyBlockedModels.set(model, Date.now() + PERMANENT_BLOCK_MS);
        console.warn(`[${model}] 접근 불가 → 임시 차단`);
        continue;
      }

      // 그 외 에러는 즉시 전파 (네트워크 오류 등)
      throw error;
    }
  }

  if (lastError && isQuotaError(lastError)) {
    throw new Error('API 사용을 위해 잠시 기다리세요! 토큰 소모 또는 잦은 요청으로 지금은 결과물을 생성할 수 없습니다.');
  }

  // 모든 모델이 실패한 경우 마지막 에러 전파
  throw lastError ?? new Error('사용 가능한 모델이 없습니다. 잠시 후 다시 시도해주세요.');
}

// 멀티파트(텍스트+파일) 생성
export async function generateContentMultipart(
  apiKey: string,
  parts: MultipartPart[],
  options?: GenerateOptions,
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  let lastError: unknown = null;

  const model = options?.apiTier === 'paid' ? PAID_MODEL : FREE_MODEL;
  for (let i = 0; i < 1; i++) {
    if (isBlocked(model)) continue;

    try {
      const config: Record<string, unknown> = {};
      if (options?.systemInstruction) config.systemInstruction = options.systemInstruction;
      if (options?.temperature !== undefined) config.temperature = options.temperature;

      const result = await withTimeout(ai.models.generateContent({ model, contents: { parts }, config }), REQUEST_TIMEOUT_MS);
      return result.text ?? '';
    } catch (error: unknown) {
      lastError = error;

      if (isQuotaError(error)) {
        quotaBlockedModels.set(model, Date.now() + QUOTA_COOLDOWN_MS);
        console.warn(`[${model}] 쿼터 초과 → 60초 쿨다운`);
        continue;
      }

      if (isPermanentBlockError(error)) {
        permanentlyBlockedModels.set(model, Date.now() + PERMANENT_BLOCK_MS);
        console.warn(`[${model}] 접근 불가 → 임시 차단`);
        continue;
      }

      throw error;
    }
  }

  if (lastError && isQuotaError(lastError)) {
    throw new Error('API 사용을 위해 잠시 기다리세요! 토큰 소모 또는 잦은 요청으로 지금은 결과물을 생성할 수 없습니다.');
  }

  throw lastError ?? new Error('사용 가능한 모델이 없습니다. 잠시 후 다시 시도해주세요.');
}

// API 키 유효성 검증 (설정 화면에서 호출)
//
// 검증 전략:
//   1. 여러 모델을 순서대로 시도하여 "한 모델이라도 성공"하면 키 유효 판정
//   2. 403 발생 시 즉시 종료하지 않고 다음 모델도 시도 (모델별로 활성화 상태가 다를 수 있음)
//   3. 모든 모델이 403일 때만 원인 분석 후 정확한 안내 제공
//      - 학교/조직 Workspace 차단 → 개인 Gmail 키 발급 안내
//      - GCP 프로젝트 API 미활성화 → 활성화 방법 안내
//      - 그 외 → 원본 에러 메시지와 함께 일반 안내
export async function testApiKey(apiKey: string, apiTier: ApiTier = 'free'): Promise<{ ok: boolean; warning?: string; error?: string; wait?: boolean }> {
  const ai = new GoogleGenAI({ apiKey });
  const testModels = [apiTier === 'paid' ? PAID_MODEL : FREE_MODEL];
  const TIMEOUT_MS = 10_000;

  type ErrKind = 'invalid_key' | 'network' | 'timeout' | 'permission' | 'quota' | 'model_unavailable' | 'other';
  interface ModelResult { model: string; ok: boolean; kind: ErrKind; rawMsg: string; status: number; }

  // SDK 에러에서 HTTP 상태코드와 메시지를 안전하게 추출
  const extractError = (error: unknown) => {
    const rawMsg =
      (error as any)?.message ||
      (error as any)?.error?.message ||
      String(error) ||
      '';
    const status: number =
      (error as any)?.status ??
      (error as any)?.statusCode ??
      (error as any)?.error?.code ??
      (error as any)?.httpErrorCode ??
      0;
    const errStatusStr: string =
      ((error as any)?.error?.status || (error as any)?.statusText || '').toLowerCase();
    return { rawMsg, msg: rawMsg.toLowerCase(), status, errStatusStr };
  };

  const classifyError = (error: unknown, model: string): ModelResult => {
    const { rawMsg, msg, status, errStatusStr } = extractError(error);

    if (msg.includes('failed to fetch') || msg.includes('network error') ||
        msg.includes('networkerror') || msg.includes('fetch failed') ||
        msg.includes('econnrefused') || msg.includes('connection refused')) {
      return { model, ok: false, kind: 'network', rawMsg, status };
    }

    if (status === 401 ||
        msg.includes('api_key_invalid') || msg.includes('api key not valid') ||
        msg.includes('api key invalid') || msg.includes('invalid api key') ||
        msg.includes('api_key_not_found') || msg.includes('api key expired')) {
      return { model, ok: false, kind: 'invalid_key', rawMsg, status };
    }

    if (status === 403 || errStatusStr === 'permission_denied' ||
        msg.includes('permission_denied') || msg.includes('permission denied')) {
      return { model, ok: false, kind: 'permission', rawMsg, status };
    }

    if (status === 429 || errStatusStr === 'resource_exhausted' ||
        msg.includes('quota') || msg.includes('resource_exhausted') ||
        msg.includes('rate limit') || msg.includes('too many requests')) {
      return { model, ok: false, kind: 'quota', rawMsg, status };
    }

    // 모델 미지원/잘못된 요청 → 키 자체는 유효할 수 있음
    if (status === 400 || status === 404 ||
        errStatusStr === 'invalid_argument' || errStatusStr === 'not_found' ||
        msg.includes('model not found') || msg.includes('is not found') ||
        msg.includes('not supported') || msg.includes('does not exist')) {
      return { model, ok: false, kind: 'model_unavailable', rawMsg, status };
    }

    return { model, ok: false, kind: 'other', rawMsg, status };
  };

  const tryModel = (model: string): Promise<ModelResult> =>
    Promise.race([
      ai.models.generateContent({ model, contents: 'Hi' })
        .then((): ModelResult => ({ model, ok: true, kind: 'other', rawMsg: '', status: 200 })),
      new Promise<ModelResult>((resolve) =>
        setTimeout(() => resolve({ model, ok: false, kind: 'timeout', rawMsg: '응답 없음', status: 0 }), TIMEOUT_MS)
      ),
    ]).catch((error: unknown) => classifyError(error, model));

  const results = await new Promise<ModelResult[]>((resolve) => {
    const collected: ModelResult[] = [];
    let settled = false;

    testModels.forEach((model) => {
      tryModel(model).then((result) => {
        if (settled) return;
        collected.push(result);
        if (result.ok) {
          settled = true;
          resolve([result]);
          return;
        }
        if (collected.length === testModels.length) {
          settled = true;
          resolve(collected);
        }
      });
    });
  });

  // 디버그 로그 — 실제로 테스트가 이뤄졌는지 확인 가능
  console.log('[API키 테스트]', results.map((r) => `${r.model}: ${r.ok ? '✓' : r.kind}(${r.status})`).join(' | '));

  // ── 성공 판정 ──
  if (results.some((r) => r.ok)) return { ok: true };

  const firstOfKind = (kind: ErrKind) => results.find((r) => r.kind === kind);

  // ── 잘못된 키 ──
  if (firstOfKind('invalid_key')) {
    return { ok: false, error: 'API 키가 유효하지 않습니다. 키를 다시 확인해 주세요.' };
  }

  // ── 네트워크 오류 ──
  if (firstOfKind('network')) {
    return { ok: false, error: '네트워크 오류가 발생했습니다. 인터넷 연결을 확인하세요.' };
  }

  // ── 전체 타임아웃 ──
  if (results.every((r) => r.kind === 'timeout')) {
    return { ok: false, error: '응답 시간이 초과됐습니다. 인터넷 연결을 확인하거나 잠시 후 다시 시도해 주세요.' };
  }

  // ── 쿼터 초과 (단독 또는 모델 미지원과 혼합) → 키는 유효 ──
  const hasQuota = results.some((r) => r.kind === 'quota');
  const allNonQuotaAreModelIssue = results
    .filter((r) => r.kind !== 'quota')
    .every((r) => r.kind === 'model_unavailable' || r.kind === 'other' || r.kind === 'timeout');
  if (hasQuota && allNonQuotaAreModelIssue) {
    return {
      ok: false,
      wait: true,
      error: 'API 사용을 위해 잠시 기다리세요!\n\n토큰 소모 또는 잦은 요청으로 지금은 결과물을 생성할 수 없습니다. 1~2분 후 다시 테스트해 주세요.',
    };
  }

  // ── 403 권한 거부 — 원인별 상세 안내 ──
  const permResult = firstOfKind('permission');
  if (permResult) {
    const lowerRaw = permResult.rawMsg.toLowerCase();

    if (lowerRaw.includes('has not been used') || lowerRaw.includes('not enabled') ||
        lowerRaw.includes('service is disabled') || lowerRaw.includes('enable it') ||
        lowerRaw.includes('serviceusage')) {
      return {
        ok: false,
        error: 'Generative Language API가 활성화되지 않았습니다 (403).\n\n📌 해결 방법 (둘 중 하나):\n\n방법 1: 1~2분 기다린 후 다시 시도\n  • 새로 발급한 키는 API 활성화에 시간이 걸립니다.\n\n방법 2: 키를 새로 발급\n  • aistudio.google.com 접속 → 기존 키 삭제 → 새 키 발급\n  • 새 키는 자동으로 API가 활성화됩니다.\n\n원본 오류:\n' + permResult.rawMsg.substring(0, 300),
      };
    }

    if (lowerRaw.includes('workspace') || lowerRaw.includes('consumer api') ||
        lowerRaw.includes('organization') || lowerRaw.includes('admin') || lowerRaw.includes('policy')) {
      return {
        ok: false,
        error: 'Gemini API가 학교/기관 정책으로 차단되었습니다 (403).\n\n학교/기관 Google Workspace 계정의 키는 조직 관리자가 차단해 놓은 경우 이 오류가 발생합니다.\n\n해결 방법: 개인 Gmail 계정(gmail.com)으로 aistudio.google.com에 접속하여 새 API 키를 발급받아 주세요.\n\n원본 오류:\n' + permResult.rawMsg.substring(0, 300),
      };
    }

    return {
      ok: false,
      error: 'Gemini API 접근이 거부되었습니다 (403).\n\n📌 가능한 원인:\n  ① 키 발급 직후라면 1~2분 후 다시 시도해 주세요 (API 활성화 지연)\n  ② 학교/기관 Workspace 계정이라면 개인 Gmail 키를 사용하세요\n  ③ 키가 만료되었거나 삭제됐다면 새로 발급받으세요\n\n원본 오류:\n' + permResult.rawMsg.substring(0, 300),
    };
  }

  // ── 모든 모델이 미지원/기타 → 키는 인식되나 접근 불가 ──
  if (results.every((r) => r.kind === 'model_unavailable' || r.kind === 'other')) {
    const sample = results.find((r) => r.rawMsg)?.rawMsg || '';
    return {
      ok: false,
      error: '키는 인식됐지만 사용 가능한 Gemini 모델이 없습니다.\n\n키를 새로 발급받거나 잠시 후 다시 시도해 주세요.\n\n원본 오류:\n' + sample.substring(0, 300),
    };
  }

  // ── 최후 폴백 — 실제 오류 메시지와 모델별 결과 노출 ──
  const sample = results.find((r) => r.rawMsg)?.rawMsg || '정보 없음';
  const modelSummary = results.map((r) => `• ${r.model}: ${r.kind}(${r.status})`).join('\n');
  return {
    ok: false,
    error: '오류가 발생했습니다.\n\n원본 오류:\n' + sample.substring(0, 300) + '\n\n모델별 결과:\n' + modelSummary,
  };
}

// 이미지 생성 모델 (2종류만 시도, 캐싱 로직 불필요)
const IMAGE_MODELS_TO_TRY = [
  'gemini-2.0-flash-preview-image-generation',
  'gemini-2.0-flash-exp-image-generation',
];

export async function generateSlideImage(apiKey: string, imagePrompt: string): Promise<string | null> {
  const ai = new GoogleGenAI({ apiKey });

  // 1. Gemini 계열 이미지 생성 모델 시도
  for (const model of IMAGE_MODELS_TO_TRY) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents: imagePrompt,
          config: { responseModalities: ['IMAGE', 'TEXT'] },
        }),
        20000,
      );
      const parts = response.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
      }
    } catch (error: unknown) {
      const msg = (error as any)?.message ?? '';
      console.error(`[slideImage] ${model} failed:`, msg);
      if (isQuotaError(error)) await new Promise(r => setTimeout(r, 2000));
    }
  }

  // 2. Imagen 4 (generateImages API) 폴백
  try {
    const response = await withTimeout(
      ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: imagePrompt,
        config: { numberOfImages: 1 },
      }),
      30000,
    );
    const imageBytes = response?.generatedImages?.[0]?.image?.imageBytes;
    if (imageBytes) return `data:image/png;base64,${imageBytes}`;
  } catch (error: unknown) {
    console.error('[slideImage] imagen-4 failed:', (error as any)?.message ?? '');
  }

  return null;
}

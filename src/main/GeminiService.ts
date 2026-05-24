import { GoogleGenAI } from '@google/genai';

// ─────────────────────────────────────────────────────────────
// Gemini 모델 스마트 폴백 전략
//
// 동작 원리:
//   1. 매 호출마다 사용 가능한 "가장 상위" 모델부터 시도
//   2. 쿼터 초과(429) → 해당 모델만 60초간 임시 차단 → 다음 모델로 폴백
//      → 60초가 지나면 자동으로 차단 해제 → 다시 상위 모델로 복귀
//   3. 권한 거부/모델 미지원(400/403/404) → 영구 차단 (재시도 무의미)
//      → 앱 재시작 또는 API 키 변경 시에만 초기화
//
// 계정별 자동 결과:
//   • 유료 계정: 항상 gemini-2.5-pro 사용
//   • 무료 gmail: 첫 호출 시 2.5-pro 403 → 영구 차단 → 이후 2.5-flash 사용
//     쿼터 시 2.0-flash로 일시 폴백 → 1분 후 자동으로 2.5-flash 복귀
// ─────────────────────────────────────────────────────────────

// 시도할 모델 우선순위 (위에서부터 시도)
const MODELS_TO_TRY = [
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

// 권한 거부/모델 미지원으로 영구 차단된 모델 목록
const permanentlyBlockedModels = new Set<string>();

// 쿼터 초과로 임시 차단된 모델 → 차단 해제 시각(unix ms)
const quotaBlockedModels = new Map<string, number>();

// 쿼터 초과 시 재시도 대기 시간 (60초)
const QUOTA_COOLDOWN_MS = 60_000;

// API 키 변경 시 모든 차단 상태를 초기화 (외부에서 호출)
export function resetModelCache(): void {
  permanentlyBlockedModels.clear();
  quotaBlockedModels.clear();
}

// 특정 모델이 현재 차단 상태인지 확인 (쿨다운 만료 시 자동 해제)
function isBlocked(model: string): boolean {
  if (permanentlyBlockedModels.has(model)) return true;
  const cooldownUntil = quotaBlockedModels.get(model);
  if (cooldownUntil === undefined) return false;
  if (cooldownUntil > Date.now()) return true;
  // 쿨다운 만료 → 차단 해제하고 다시 사용 가능
  quotaBlockedModels.delete(model);
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

  // 우선순위 순서대로 모델 시도, 차단된 모델은 자동 skip
  for (let i = 0; i < MODELS_TO_TRY.length; i++) {
    const model = MODELS_TO_TRY[i];
    if (isBlocked(model)) continue; // 차단된 모델 건너뜀

    try {
      const config: Record<string, unknown> = {};
      if (options?.systemInstruction) config.systemInstruction = options.systemInstruction;
      if (options?.temperature !== undefined) config.temperature = options.temperature;

      const result = await ai.models.generateContent({ model, contents: prompt, config });
      return result.text ?? '';
    } catch (error: unknown) {
      lastError = error;

      // 쿼터 초과 → 60초 임시 차단 후 다음 모델로
      if (isQuotaError(error)) {
        quotaBlockedModels.set(model, Date.now() + QUOTA_COOLDOWN_MS);
        console.warn(`[${model}] 쿼터 초과 → 60초 쿨다운, 다음 모델로 폴백`);
        continue;
      }

      // 권한 거부/모델 미지원 → 영구 차단
      if (isPermanentBlockError(error)) {
        permanentlyBlockedModels.add(model);
        console.warn(`[${model}] 접근 불가 → 영구 차단, 다음 모델로 폴백`);
        continue;
      }

      // 그 외 에러는 즉시 전파 (네트워크 오류 등)
      throw error;
    }
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

  for (let i = 0; i < MODELS_TO_TRY.length; i++) {
    const model = MODELS_TO_TRY[i];
    if (isBlocked(model)) continue;

    try {
      const config: Record<string, unknown> = {};
      if (options?.systemInstruction) config.systemInstruction = options.systemInstruction;
      if (options?.temperature !== undefined) config.temperature = options.temperature;

      const result = await ai.models.generateContent({ model, contents: { parts }, config });
      return result.text ?? '';
    } catch (error: unknown) {
      lastError = error;

      if (isQuotaError(error)) {
        quotaBlockedModels.set(model, Date.now() + QUOTA_COOLDOWN_MS);
        console.warn(`[${model}] 쿼터 초과 → 60초 쿨다운, 다음 모델로 폴백`);
        continue;
      }

      if (isPermanentBlockError(error)) {
        permanentlyBlockedModels.add(model);
        console.warn(`[${model}] 접근 불가 → 영구 차단, 다음 모델로 폴백`);
        continue;
      }

      throw error;
    }
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
export async function testApiKey(apiKey: string): Promise<{ ok: boolean; warning?: string; error?: string }> {
  const ai = new GoogleGenAI({ apiKey });
  // 검증용 모델 — 무료 계정에서도 접근 가능한 모델 위주로 시도
  const testModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'];

  let quotaHit = false;
  let permissionDeniedCount = 0;
  let firstPermissionErrorRawMsg = ''; // 첫 403 에러의 원본 메시지 (원인 분석용)

  for (const model of testModels) {
    try {
      await Promise.race([
        ai.models.generateContent({ model, contents: 'Hi' }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 12000)
        ),
      ]);
      // 하나라도 성공하면 키 유효
      return { ok: true };
    } catch (error: unknown) {
      const rawMsg = (error as any)?.message || '';
      const msg = rawMsg.toLowerCase();
      const status = (error as any)?.status ?? (error as any)?.error?.code ?? 0;
      const errStatus = ((error as any)?.error?.status || '').toLowerCase();

      if (msg === 'timeout') return { ok: false, error: '응답 시간 초과. 인터넷 연결을 확인하세요.' };

      if (msg.includes('failed to fetch') || msg.includes('network error') || msg.includes('networkerror')) {
        return { ok: false, error: '네트워크 오류. 인터넷 연결을 확인하세요.' };
      }

      // 명시적인 "키 잘못됨" 에러 (401 또는 메시지에 키 관련 문구)
      // → 즉시 실패 처리 (다른 모델 시도해도 동일하게 실패할 것)
      const isKeyInvalid =
        status === 401 ||
        msg.includes('api_key_invalid') ||
        msg.includes('api key not valid') ||
        msg.includes('api key invalid') ||
        msg.includes('invalid api key');

      if (isKeyInvalid) {
        return { ok: false, error: 'API 키가 유효하지 않습니다. 키를 다시 확인해 주세요.' };
      }

      // 403 PERMISSION_DENIED → 즉시 실패하지 않고 다른 모델도 시도
      // (특정 모델만 막혀 있고 다른 모델은 사용 가능한 경우가 있음)
      if (status === 403 || errStatus === 'permission_denied') {
        if (!firstPermissionErrorRawMsg) firstPermissionErrorRawMsg = rawMsg;
        permissionDeniedCount++;
        continue;
      }

      // 쿼터 초과 → 키는 유효, 일시적 제한
      if (status === 429 || errStatus === 'resource_exhausted' ||
          msg.includes('quota') || msg.includes('resource_exhausted') || msg.includes('rate limit')) {
        quotaHit = true;
        continue;
      }

      // 모델 미지원 (400/404) → 다음 모델 시도
      if (status === 400 || status === 404 || errStatus === 'invalid_argument' || errStatus === 'not_found') {
        continue;
      }

      // 그 외 → 다음 모델 시도
      continue;
    }
  }

  // 모든 모델이 쿼터 초과 → 키는 유효함
  if (quotaHit) {
    return {
      ok: true,
      warning: '무료 요청 한도가 일시적으로 초과된 상태입니다. 1~2분 후 정상적으로 사용할 수 있습니다.',
    };
  }

  // 모든 모델이 403 PERMISSION_DENIED → 원본 메시지 분석하여 정확한 안내
  if (permissionDeniedCount > 0) {
    const lowerRaw = firstPermissionErrorRawMsg.toLowerCase();

    // (1) GCP 프로젝트의 Generative Language API 미활성화
    //     → 새 계정에서 키 발급 직후 자주 발생. API 활성화 또는 1~2분 대기 필요
    if (lowerRaw.includes('has not been used') ||
        lowerRaw.includes('not enabled') ||
        lowerRaw.includes('service is disabled') ||
        lowerRaw.includes('enable it') ||
        lowerRaw.includes('serviceusage')) {
      return {
        ok: false,
        error: 'Generative Language API가 활성화되지 않았습니다 (403).\n\n📌 해결 방법 (둘 중 하나):\n\n방법 1: 1~2분 기다린 후 다시 시도\n  • 새로 발급한 키는 API 활성화에 시간이 걸립니다.\n\n방법 2: 키를 새로 발급\n  • aistudio.google.com 접속 → 기존 키 삭제 → 새 키 발급\n  • 새 키는 자동으로 API가 활성화됩니다.\n\n원본 오류:\n' + firstPermissionErrorRawMsg.substring(0, 250),
      };
    }

    // (2) 학교/조직 Workspace 계정 차단
    if (lowerRaw.includes('workspace') ||
        lowerRaw.includes('consumer api') ||
        lowerRaw.includes('organization') ||
        lowerRaw.includes('admin') ||
        lowerRaw.includes('policy')) {
      return {
        ok: false,
        error: 'Gemini API가 학교/기관 정책으로 차단되었습니다 (403).\n\n학교/기관 Google Workspace 계정의 키는 조직 관리자가 차단해 놓은 경우 이 오류가 발생합니다.\n\n해결 방법: 개인 Gmail 계정(gmail.com)으로 aistudio.google.com에 접속하여 새 API 키를 발급받아 주세요.\n\n원본 오류:\n' + firstPermissionErrorRawMsg.substring(0, 250),
      };
    }

    // (3) 그 외 일반 403 — 원본 메시지와 함께 가능한 원인 모두 안내
    return {
      ok: false,
      error: 'Gemini API 접근이 거부되었습니다 (403).\n\n📌 가능한 원인:\n  ① 키 발급 직후라면 1~2분 후 다시 시도해 주세요 (API 활성화 지연)\n  ② 학교/기관 Workspace 계정이라면 개인 Gmail 키를 사용하세요\n  ③ 키가 만료되었거나 삭제됐다면 새로 발급받으세요\n\n원본 오류:\n' + firstPermissionErrorRawMsg.substring(0, 250),
    };
  }

  return { ok: false, error: '알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' };
}

// 이미지 생성 모델 (2종류만 시도, 캐싱 로직 불필요)
const IMAGE_MODELS_TO_TRY = [
  'gemini-2.0-flash-preview-image-generation',
  'gemini-2.0-flash-exp-image-generation',
];

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

export async function generateSlideImage(apiKey: string, imagePrompt: string): Promise<string | null> {
  const ai = new GoogleGenAI({ apiKey });

  for (const model of IMAGE_MODELS_TO_TRY) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents: imagePrompt,
          config: { responseModalities: ['IMAGE', 'TEXT'] },
        }),
        15000,
      );
      const imageData = response.data;
      if (imageData) return `data:image/png;base64,${imageData}`;
      const parts = (response as any).candidates?.[0]?.content?.parts ?? [];
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

  return null;
}

import { GoogleGenAI } from '@google/genai';

const MODELS_TO_TRY = [
  'gemini-2.5-flash-preview-05-20',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

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

export interface GenerateOptions {
  systemInstruction?: string;
  temperature?: number;
}

export interface MultipartPart {
  text?: string;
  inlineData?: { data: string; mimeType: string };
}

export async function generateContent(
  apiKey: string,
  prompt: string,
  options?: GenerateOptions,
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  let lastError: unknown = null;

  for (let i = 0; i < MODELS_TO_TRY.length; i++) {
    const model = MODELS_TO_TRY[i];
    try {
      const config: Record<string, unknown> = {};
      if (options?.systemInstruction) config.systemInstruction = options.systemInstruction;
      if (options?.temperature !== undefined) config.temperature = options.temperature;

      const result = await ai.models.generateContent({
        model,
        contents: prompt,
        config,
      });
      return result.text ?? '';
    } catch (error: unknown) {
      lastError = error;
      if (isQuotaError(error)) {
        console.warn(`Model ${model} quota limit. Trying next...`);
        const delay = 2000 * Math.pow(2, i);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export async function generateContentMultipart(
  apiKey: string,
  parts: MultipartPart[],
  options?: GenerateOptions,
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  let lastError: unknown = null;

  for (let i = 0; i < MODELS_TO_TRY.length; i++) {
    const model = MODELS_TO_TRY[i];
    try {
      const config: Record<string, unknown> = {};
      if (options?.systemInstruction) config.systemInstruction = options.systemInstruction;
      if (options?.temperature !== undefined) config.temperature = options.temperature;

      const result = await ai.models.generateContent({
        model,
        contents: { parts },
        config,
      });
      return result.text ?? '';
    } catch (error: unknown) {
      lastError = error;
      if (isQuotaError(error)) {
        console.warn(`Model ${model} quota limit. Trying next...`);
        const delay = 2000 * Math.pow(2, i);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export async function testApiKey(apiKey: string): Promise<{ ok: boolean; warning?: string; error?: string }> {
  const ai = new GoogleGenAI({ apiKey });
  // Try models from most stable to newest — free-tier new keys may be limited on preview models
  const testModels = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-8b'];
  let quotaHit = false;

  for (const model of testModels) {
    try {
      await Promise.race([
        ai.models.generateContent({ model, contents: 'Hi' }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 12000)
        ),
      ]);
      return { ok: true };
    } catch (error: unknown) {
      const msg = ((error as any)?.message || '').toLowerCase();
      const status = (error as any)?.status ?? (error as any)?.error?.code ?? 0;
      const errStatus = ((error as any)?.error?.status || '').toLowerCase();

      if (msg === 'timeout') return { ok: false, error: '응답 시간 초과. 인터넷 연결을 확인하세요.' };

      // Definitively invalid key
      if (status === 400 || status === 401 || status === 403 ||
          errStatus === 'permission_denied' || errStatus === 'invalid_argument' ||
          msg.includes('api_key_invalid') || msg.includes('api key not valid') ||
          msg.includes('permission_denied')) {
        return { ok: false, error: 'API 키가 유효하지 않습니다. 키를 다시 확인하세요.' };
      }

      // Quota / rate limit — key IS valid, just limited; try next model
      if (status === 429 || errStatus === 'resource_exhausted' ||
          msg.includes('quota') || msg.includes('resource_exhausted') || msg.includes('rate limit')) {
        quotaHit = true;
        continue;
      }

      // Network error
      if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch')) {
        return { ok: false, error: '네트워크 오류. 인터넷 연결을 확인하세요.' };
      }

      // Unknown — try next model
      continue;
    }
  }

  // All models hit quota → key is valid but rate-limited
  if (quotaHit) {
    return {
      ok: true,
      warning: 'API 키가 확인되었습니다. 무료 계정 요청 한도에 근접했거나 일시적으로 제한 중입니다. 잠시 후 사용하면 정상 동작합니다.',
    };
  }

  return { ok: false, error: '알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' };
}

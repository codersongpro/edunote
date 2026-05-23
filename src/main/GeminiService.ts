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

export async function testApiKey(apiKey: string): Promise<{ ok: boolean; error?: string }> {
  const ai = new GoogleGenAI({ apiKey });
  const model = 'gemini-2.0-flash';
  try {
    const result = await Promise.race([
      ai.models.generateContent({ model, contents: 'Hi', config: {} }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 15000)
      ),
    ]);
    if ((result as any)?.text !== undefined) return { ok: true };
    return { ok: false, error: '응답을 받지 못했습니다.' };
  } catch (error: unknown) {
    const msg = ((error as any)?.message || '').toLowerCase();
    const status = (error as any)?.status ?? (error as any)?.error?.code ?? 0;
    if (msg === 'timeout') return { ok: false, error: '응답 시간 초과. 인터넷 연결을 확인하세요.' };
    if (status === 401 || msg.includes('api_key_invalid') || msg.includes('api key not valid') || msg.includes('invalid_argument'))
      return { ok: false, error: 'API 키가 유효하지 않습니다. 키를 다시 확인하세요.' };
    if (status === 429 || msg.includes('quota') || msg.includes('resource_exhausted'))
      return { ok: false, error: '요청 한도 초과. 잠시 후 다시 시도하거나 다른 API 키를 사용하세요.' };
    if (msg.includes('network') || msg.includes('fetch'))
      return { ok: false, error: '네트워크 오류. 인터넷 연결을 확인하세요.' };
    return { ok: false, error: `오류: ${(error as any)?.message || '알 수 없는 오류'}` };
  }
}

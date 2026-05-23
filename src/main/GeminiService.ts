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

export async function testApiKey(apiKey: string): Promise<boolean> {
  try {
    await generateContent(apiKey, '안녕하세요. 한 문장으로 짧게 답해주세요.', {});
    return true;
  } catch {
    return false;
  }
}

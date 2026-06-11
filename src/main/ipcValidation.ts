// ai:generate / ai:generate-multipart IPC 입력 검증.
// 렌더러가 손상되었거나 잘못된 호출을 보내도 메인 프로세스가 과도한 페이로드를
// Gemini API로 전달하지 않도록 형식과 크기를 점검한다.

// 프롬프트에는 업로드 문서 전문이 포함될 수 있어 상한을 넉넉히 둔다.
const MAX_PROMPT_CHARS = 1_500_000;
const MAX_SYSTEM_INSTRUCTION_CHARS = 200_000;
const MAX_PARTS = 16;
// Gemini inline 데이터 한도(요청당 20MB)에 base64 부풀림(약 4/3)을 반영한 값.
const MAX_INLINE_BASE64_CHARS = 28_000_000;
const MIME_TYPE_PATTERN = /^[\w.+-]+\/[\w.+-]+$/;

export interface GenerateOptions {
  temperature?: number;
  maxOutputTokens?: number;
  responseJson?: boolean;
}

export interface MultipartPart {
  text?: string;
  inlineData?: { data: string; mimeType: string };
}

function validateOptions(options?: GenerateOptions): void {
  if (options === undefined || options === null) return;
  if (typeof options !== 'object') throw new Error('AI 요청 옵션 형식이 올바르지 않습니다.');
  const { temperature, maxOutputTokens } = options;
  if (temperature !== undefined) {
    if (typeof temperature !== 'number' || !Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
      throw new Error('AI 요청 temperature 값이 올바르지 않습니다.');
    }
  }
  if (maxOutputTokens !== undefined) {
    if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > 65_536) {
      throw new Error('AI 요청 출력 토큰 상한 값이 올바르지 않습니다.');
    }
  }
  if (options.responseJson !== undefined && typeof options.responseJson !== 'boolean') {
    throw new Error('AI 요청 옵션 형식이 올바르지 않습니다.');
  }
}

function validateSystemInstruction(systemInstruction?: string): void {
  if (systemInstruction === undefined || systemInstruction === null) return;
  if (typeof systemInstruction !== 'string') throw new Error('AI 시스템 지시문 형식이 올바르지 않습니다.');
  if (systemInstruction.length > MAX_SYSTEM_INSTRUCTION_CHARS) {
    throw new Error('AI 시스템 지시문이 허용 길이를 초과했습니다.');
  }
}

export function validateGenerateArgs(prompt: unknown, systemInstruction?: unknown, options?: unknown): void {
  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw new Error('AI 요청 내용이 비어 있습니다.');
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    throw new Error('AI 요청 내용이 너무 깁니다. 입력 내용을 줄인 뒤 다시 시도해주세요.');
  }
  validateSystemInstruction(systemInstruction as string | undefined);
  validateOptions(options as GenerateOptions | undefined);
}

export function validateMultipartArgs(parts: unknown, systemInstruction?: unknown, options?: unknown): void {
  if (!Array.isArray(parts) || parts.length === 0) {
    throw new Error('AI 요청 내용이 비어 있습니다.');
  }
  if (parts.length > MAX_PARTS) {
    throw new Error('한 번에 보낼 수 있는 파일·텍스트 개수를 초과했습니다.');
  }
  for (const part of parts as MultipartPart[]) {
    if (!part || typeof part !== 'object') throw new Error('AI 요청 형식이 올바르지 않습니다.');
    const hasText = typeof part.text === 'string';
    const hasInline = part.inlineData !== undefined && part.inlineData !== null;
    if (!hasText && !hasInline) throw new Error('AI 요청 형식이 올바르지 않습니다.');
    if (hasText && (part.text as string).length > MAX_PROMPT_CHARS) {
      throw new Error('AI 요청 내용이 너무 깁니다. 입력 내용을 줄인 뒤 다시 시도해주세요.');
    }
    if (hasInline) {
      const inline = part.inlineData as { data?: unknown; mimeType?: unknown };
      if (typeof inline.data !== 'string' || inline.data.length === 0) {
        throw new Error('첨부 파일 데이터가 올바르지 않습니다.');
      }
      if (inline.data.length > MAX_INLINE_BASE64_CHARS) {
        throw new Error('첨부 파일이 너무 큽니다. 20MB 이하 파일로 다시 시도해주세요.');
      }
      if (typeof inline.mimeType !== 'string' || !MIME_TYPE_PATTERN.test(inline.mimeType)) {
        throw new Error('첨부 파일 형식 정보가 올바르지 않습니다.');
      }
    }
  }
  validateSystemInstruction(systemInstruction as string | undefined);
  validateOptions(options as GenerateOptions | undefined);
}

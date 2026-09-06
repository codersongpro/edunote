import { FinishReason, type GenerateContentResponse } from '@google/genai';

const SAFETY_FINISH_REASONS = new Set<FinishReason>([
  FinishReason.SAFETY,
  FinishReason.BLOCKLIST,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.SPII,
  FinishReason.IMAGE_SAFETY,
  FinishReason.IMAGE_PROHIBITED_CONTENT,
]);

export function assertGenerationResponseAccepted(response: GenerateContentResponse): void {
  if (response.promptFeedback?.blockReason) {
    throw new Error('요청 내용이 안전 정책에 따라 차단되었습니다. 개인정보나 민감한 표현을 줄여 다시 시도해주세요.');
  }

  const finishReason = response.candidates?.[0]?.finishReason;
  if (!finishReason || finishReason === FinishReason.STOP || finishReason === FinishReason.FINISH_REASON_UNSPECIFIED) return;
  if (finishReason === FinishReason.MAX_TOKENS) {
    throw new Error('AI 응답이 출력 한도에 도달해 완료되지 않았습니다. 입력 내용을 줄이거나 결과 길이를 낮춰 다시 시도해주세요.');
  }
  if (SAFETY_FINISH_REASONS.has(finishReason)) {
    throw new Error('AI 응답이 안전 정책에 따라 중단되었습니다. 개인정보나 민감한 표현을 줄여 다시 시도해주세요.');
  }
  throw new Error('AI 응답이 완료되지 않았습니다. 입력 내용을 확인하고 다시 시도해주세요.');
}

export function validateGeneratedResponse(response: GenerateContentResponse, text: string): string {
  assertGenerationResponseAccepted(response);
  if (!text.trim()) {
    throw new Error('AI가 빈 응답을 반환했습니다. 입력 내용을 확인하고 다시 시도해주세요.');
  }
  return text;
}

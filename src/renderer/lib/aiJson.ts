// AI 응답 텍스트에서 JSON 배열을 안전하게 꺼낸다.
// 코드펜스(```json ... ```)로 감싸인 경우와 산문 속에 배열이 섞인 경우를 모두 처리하고,
// 형식이 맞지 않으면 일관된 한국어 에러를 던진다.
export function parseJsonArrayFromAiText(text: string): unknown[] {
  const trimmed = String(text ?? '').trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1]?.trim();
  const start = trimmed.indexOf('[');
  const end = trimmed.lastIndexOf(']');
  const sliced = start >= 0 && end > start ? trimmed.slice(start, end + 1) : '';
  const jsonText = fenced ?? sliced;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('AI 응답을 해석하지 못했습니다. 다시 시도해주세요.');
  }
  if (!Array.isArray(parsed)) throw new Error('AI 응답 형식이 올바르지 않습니다.');
  return parsed;
}

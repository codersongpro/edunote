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

// AI 응답 텍스트에서 JSON 객체를 꺼낸다. 웹 검색을 켠 요청은 JSON 응답 모드를 쓸 수 없어
// 산문·코드펜스가 섞여 오는 경우가 있으므로 첫 '{'부터 마지막 '}'까지를 해석한다.
export function parseJsonObjectFromAiText(text: string): Record<string, unknown> {
  const trimmed = String(text ?? '').trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1]?.trim();
  const source = fenced ?? trimmed;
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  let parsed: unknown;
  try {
    parsed = JSON.parse(start >= 0 && end > start ? source.slice(start, end + 1) : source);
  } catch {
    throw new Error('AI 응답을 해석하지 못했습니다. 다시 시도해주세요.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('AI 응답 형식이 올바르지 않습니다.');
  return parsed as Record<string, unknown>;
}

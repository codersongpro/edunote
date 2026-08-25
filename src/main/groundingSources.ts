// 웹 검색 그라운딩(googleSearch 도구)을 켜고 생성했을 때, 응답에 함께 오는
// groundingMetadata에서 화면에 표시할 출처 정보만 추려낸다.
//
// - 같은 URL이 여러 번 인용되면 한 번만 남긴다.
// - searchSuggestionHtml은 구글이 내려주는 검색 제안 위젯 HTML로,
//   검색 결과를 사용할 때 화면에 함께 표시해야 하는 항목이다.

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface GroundingInfo {
  sources: GroundingSource[];
  searchQueries: string[];
  searchSuggestionHtml: string;
}

// 응답 객체는 SDK 버전에 따라 필드가 없을 수 있어 전부 선택 접근으로 다룬다.
export function extractGroundingInfo(response: unknown): GroundingInfo | null {
  const metadata = (response as any)?.candidates?.[0]?.groundingMetadata;
  if (!metadata || typeof metadata !== 'object') return null;

  const seen = new Set<string>();
  const sources: GroundingSource[] = [];
  const chunks = Array.isArray(metadata.groundingChunks) ? metadata.groundingChunks : [];
  for (const chunk of chunks) {
    const uri = typeof chunk?.web?.uri === 'string' ? chunk.web.uri.trim() : '';
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    const rawTitle = typeof chunk?.web?.title === 'string' ? chunk.web.title.trim() : '';
    sources.push({ title: rawTitle || uri, uri });
  }

  const searchQueries = Array.isArray(metadata.webSearchQueries)
    ? metadata.webSearchQueries.filter((q: unknown): q is string => typeof q === 'string' && q.trim() !== '')
    : [];

  const searchSuggestionHtml =
    typeof metadata.searchEntryPoint?.renderedContent === 'string'
      ? metadata.searchEntryPoint.renderedContent
      : '';

  if (sources.length === 0 && searchQueries.length === 0 && !searchSuggestionHtml) return null;
  return { sources, searchQueries, searchSuggestionHtml };
}

// 스트리밍은 청크마다 부분 메타데이터가 올 수 있어, 정보가 더 많은 쪽을 남긴다.
// (출처 수가 같으면 나중에 온 것이 더 완성된 값이므로 나중 것을 쓴다.)
export function mergeGroundingInfo(
  previous: GroundingInfo | null,
  next: GroundingInfo | null,
): GroundingInfo | null {
  if (!next) return previous;
  if (!previous) return next;
  return next.sources.length >= previous.sources.length ? next : previous;
}

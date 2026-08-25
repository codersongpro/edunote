// 연수자료 제작에 참고할 교육부·시도교육청 자료를 사람이 직접 찾아 첨부하도록
// 검색 결과 페이지를 열어주는 방식이다. 검색 API로 데이터를 자동 수집하지 않으므로
// 이용약관 문제나 API 서비스 종료 위험이 없다(가격 검색과 같은 방식).
//
// 정부·교육청 도메인(go.kr)으로 범위를 좁혀, 블로그·상업 자료가 아닌
// 공공기관이 배포한 원본 자료가 먼저 나오도록 한다.
export function buildEduReferenceSearchUrl(topic: string): string | null {
  const trimmed = topic.trim();
  if (!trimmed) return null;
  const query = `${trimmed} 교직원 연수 자료 site:go.kr`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

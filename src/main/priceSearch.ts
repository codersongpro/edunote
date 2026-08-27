// 네이버 쇼핑 검색 API(2026년 7월 31일 종료)를 호출하는 것이 아니라, 사람이 직접 눈으로
// 보고 가격을 입력하도록 검색 결과 페이지를 열어주는 방식이다. 자동으로 데이터를 긁어오지
// 않으므로 이용약관 문제나 API 서비스 종료 위험이 없다.
export function buildNaverShoppingSearchUrl(itemName: string): string | null {
  const trimmed = itemName.trim();
  if (!trimmed) return null;
  return `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(trimmed)}`;
}

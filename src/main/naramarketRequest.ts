// 나라장터(조달청) OpenAPI 요청 조립.
// 서비스마다 필수 요청변수가 달라서, 하나로 뭉뚱그리면 필수값을 빠뜨리기 쉽다.
// 실제로 종합쇼핑몰 품목정보 서비스의 필수값 inqryDiv를 보내지 않아 게이트웨이가
// [04] HTTP 에러로 응답했고, 원인 파악에 오래 걸렸다. 서비스별로 나눠 둔다.

// 종합쇼핑몰 품목정보 서비스의 필수 요청변수(명세 기준): serviceKey, pageNo, numOfRows, inqryDiv
// serviceKey는 호출부에서 붙이므로 여기서는 나머지를 만든다.
export const SHOPPING_MALL_REQUIRED_KEYS = ['pageNo', 'numOfRows', 'inqryDiv'] as const;

// 조회구분. 명세에 값 목록이 없어 조달청 관행대로 1을 사용한다.
// 조회기준일자(inqryBgnDate·inqryEndDate)는 선택값이라 보내지 않는다.
const SHOPPING_MALL_INQRY_DIV = '1';

// 키워드로 검색할 항목을 넓은 것부터 좁은 것 순으로 시도한다.
// 명세상 각 항목의 의미: prdctClsfcNoNm=품명, dtilPrdctClsfcNoNm=세부품명,
// prdctIdntNoNm=물품규격명. '복사용지' 같은 일반 검색어는 품명에 해당한다.
export const SHOPPING_MALL_SEARCH_KEYS = [
  'prdctClsfcNoNm',
  'dtilPrdctClsfcNoNm',
  'prdctIdntNoNm',
] as const;

// 물품목록정보 서비스는 inqryDiv를 쓰지 않는다.
export const THNG_LIST_SEARCH_KEYS = [
  'krnPrdctNm',
  'prdctClsfcNoNm',
  'dtilPrdctClsfcNoNm',
] as const;

const ROWS_PER_PAGE = '30';

function baseParams(pageNo: number): URLSearchParams {
  const params = new URLSearchParams();
  params.set('pageNo', String(Math.max(1, Math.floor(pageNo) || 1)));
  params.set('numOfRows', ROWS_PER_PAGE);
  return params;
}

// 종합쇼핑몰 품목정보 서비스용 요청 항목
export function buildShoppingMallParams(
  searchKey: string,
  keyword: string,
  pageNo: number,
): URLSearchParams {
  const params = baseParams(pageNo);
  params.set('inqryDiv', SHOPPING_MALL_INQRY_DIV);
  params.set(searchKey, keyword);
  params.set('type', 'json');
  return params;
}

// 물품목록정보 서비스용 요청 항목
export function buildThngListParams(
  searchKey: string,
  keyword: string,
  pageNo: number,
): URLSearchParams {
  const params = baseParams(pageNo);
  params.set(searchKey, keyword);
  params.set('type', 'json');
  return params;
}

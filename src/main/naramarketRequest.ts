// 나라장터(조달청) OpenAPI 요청 조립.
// 서비스마다 필수 요청변수가 달라서, 하나로 뭉뚱그리면 필수값을 빠뜨리기 쉽다.
// 실제로 종합쇼핑몰 품목정보 서비스의 필수값 inqryDiv를 보내지 않아 게이트웨이가
// [04] HTTP 에러로 응답했고, 원인 파악에 오래 걸렸다. 서비스별로 나눠 둔다.

// 종합쇼핑몰 품목정보 서비스의 필수 요청변수(명세 기준): serviceKey, pageNo, numOfRows, inqryDiv
// serviceKey는 호출부에서 붙이므로 여기서는 나머지를 만든다.
export const SHOPPING_MALL_REQUIRED_KEYS = ['pageNo', 'numOfRows', 'inqryDiv'] as const;

// 조회구분(inqryDiv)은 필수값인데 명세에 값 목록이 없다. 조달청 서비스들의 관행상
// 1은 조회기간 기준, 2는 조건 기준인 경우가 많아 두 가지를 함께 시도하고 결과를 합친다.
// 한쪽이 실패해도 다른 쪽 결과를 쓰므로(collectOpenApiItems), 값이 확인되면 하나로 줄인다.
// 1에는 조회기준일자를 함께 보낸다 — 기간 기준인데 기간이 없으면 결과가 비어 돌아온다.
export const SHOPPING_MALL_INQRY_VARIANTS = [
  { inqryDiv: '1', dateRangeDays: 365 },
  { inqryDiv: '2', dateRangeDays: 0 },
] as const;

function formatApiDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

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

// 여러 조회 조합을 한 번에 병렬로 던지면 느린 정부 API가 버티지 못해 전부 타임아웃 난다.
// 순서대로 하나씩 시도하고, 결과가 나오는 순간 나머지는 호출하지 않는다.
// 전체 제한 시간을 넘기면 더 시도하지 않고 그때까지의 결과를 돌려준다.
export async function collectFirstNonEmpty<T>(
  runners: Array<() => Promise<T>>,
  readItems: (value: T) => unknown[],
  options: { deadlineMs?: number; now?: () => number } = {},
): Promise<{ items: unknown[]; failures: unknown[]; attempts: number }> {
  const { deadlineMs = 60_000, now = () => Date.now() } = options;
  const startedAt = now();
  const failures: unknown[] = [];
  let attempts = 0;

  for (const run of runners) {
    if (attempts > 0 && now() - startedAt >= deadlineMs) break;
    attempts += 1;
    try {
      const items = readItems(await run());
      if (items.length > 0) return { items, failures, attempts };
    } catch (error) {
      failures.push(error);
    }
  }

  return { items: [], failures, attempts };
}

function baseParams(pageNo: number): URLSearchParams {
  const params = new URLSearchParams();
  params.set('pageNo', String(Math.max(1, Math.floor(pageNo) || 1)));
  params.set('numOfRows', ROWS_PER_PAGE);
  return params;
}

// 종합쇼핑몰 품목정보 서비스용 요청 항목.
// variant는 SHOPPING_MALL_INQRY_VARIANTS의 항목이며, today는 시험에서 고정하기 위해 받는다.
export function buildShoppingMallParams(
  searchKey: string,
  keyword: string,
  pageNo: number,
  variant: { inqryDiv: string; dateRangeDays: number } = SHOPPING_MALL_INQRY_VARIANTS[0],
  today: Date = new Date(),
): URLSearchParams {
  const params = baseParams(pageNo);
  params.set('inqryDiv', variant.inqryDiv);
  if (variant.dateRangeDays > 0) {
    const begin = new Date(today);
    begin.setDate(begin.getDate() - variant.dateRangeDays);
    params.set('inqryBgnDate', formatApiDate(begin));
    params.set('inqryEndDate', formatApiDate(today));
  }
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

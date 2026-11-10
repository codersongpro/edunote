// 나라장터(조달청) OpenAPI 물품 검색 — 데스크톱 메인 프로세스와 웹판 서버 함수(api/naramarket.ts)가 공유한다.
// 네트워크 호출만 주입받으므로 Electron net.fetch·Node fetch 어디서나 쓸 수 있다.
import { describeOpenApiError, parseOpenApiBody } from './openApiError';
import {
  collectFirstNonEmpty,
  SHOPPING_MALL_INQRY_VARIANTS,
  SHOPPING_MALL_SEARCH_KEYS,
  THNG_LIST_SEARCH_KEYS,
  buildShoppingMallParams,
  buildThngListParams,
} from './naramarketRequest';

export type NaramarketKind = 'thng' | 'shopping';
export type NaramarketFetch = (url: string) => Promise<{ ok: boolean; status: number; body: string }>;

export function readOpenApiItems(data: any): any[] {
  const raw = data?.response?.body?.items ?? data?.body?.items ?? [];
  const rows = raw?.item ?? raw;
  return Array.isArray(rows) ? rows : (rows ? [rows] : []);
}

// 여러 검색 항목으로 나눠 조회한 결과를 합친다. 하나라도 성공하면 그 결과를 쓰고,
// 전부 실패하면 첫 실패 사유를 그대로 올려 보낸다 — 조용히 빈 결과를 돌려주면 화면에는
// "검색 결과가 없습니다"로만 보여서 인증키 오류·활용신청 미승인을 구분할 수 없다.
async function collectOpenApiItems(runners: Array<() => Promise<unknown>>): Promise<any> {
  const { items, failures, attempts } = await collectFirstNonEmpty(runners, readOpenApiItems);
  // 시도한 조회가 모두 실패했을 때만 오류로 본다. 하나라도 정상 응답했는데 결과가 없으면
  // 그건 오류가 아니라 "검색 결과 없음"이다.
  if (items.length === 0 && failures.length > 0 && failures.length === attempts) {
    const first = failures[0];
    throw first instanceof Error ? first : new Error(String(first));
  }
  return { response: { body: { items: { item: items } } } };
}

// 나라장터 OpenAPI 한 건을 호출한다. 포털은 인증 오류일 때도 HTTP 200에 XML 오류 본문을
// 돌려주므로, 본문을 먼저 읽어 오류인지 판별한 뒤 JSON으로 해석한다.
async function fetchNaramarket(fetchText: NaramarketFetch, serviceKey: string, path: string, params: URLSearchParams): Promise<unknown> {
  // 공공데이터포털 표준 파라미터명은 소문자 serviceKey다. 게이트웨이가 대소문자를 가리면
  // 키를 읽지 못해 SERVICE_KEY_IS_NOT_REGISTERED_ERROR로 응답한다.
  // 인증키는 Encoding 키(이미 %로 인코딩됨)와 Decoding 키가 함께 제공되며,
  // 특수문자가 없는 키는 두 형태가 같아 encodeURIComponent를 거쳐도 값이 바뀌지 않는다.
  const encodedKey = serviceKey.includes('%') ? serviceKey : encodeURIComponent(serviceKey);
  const rawUrl = `https://apis.data.go.kr/1230000/${path}?serviceKey=${encodedKey}&${params.toString()}`;
  // 실패 원인을 좁히려면 실제로 보낸 주소가 필요하다. 인증키만 가려서 함께 알려준다.
  const maskedUrl = rawUrl.replace(encodedKey, '***');
  const { ok, status, body } = await fetchText(rawUrl);
  if (!ok) {
    const reason = describeOpenApiError(body);
    throw new Error(`나라장터 API 오류(HTTP ${status}): ${reason ?? body.slice(0, 200)} · 요청: ${maskedUrl}`);
  }
  try {
    return parseOpenApiBody(body);
  } catch (e: any) {
    throw new Error(`나라장터 API 오류: ${e?.message ?? '응답을 해석하지 못했습니다.'} · 요청: ${maskedUrl}`);
  }
}

export function searchNaramarket(
  kind: NaramarketKind,
  keyword: string,
  pageNo: number,
  serviceKey: string,
  fetchText: NaramarketFetch,
): Promise<any> {
  if (kind === 'thng') {
    const path = 'ao/ThngListInfoService/getThngPrdnmLocplcAccotListInfoInfoPrdlstSearch';
    return collectOpenApiItems(
      THNG_LIST_SEARCH_KEYS.map(searchKey => () => (
        fetchNaramarket(fetchText, serviceKey, path, buildThngListParams(searchKey, keyword, pageNo))
      )),
    );
  }
  const path = 'at/ShoppingMallPrdctInfoService/getShoppingMallPrdctInfoList';
  // 조회구분 값이 확정되지 않아 두 가지를 순서대로 시도한다. 결과가 나오면 거기서 멈추므로
  // 보통은 첫 조회 한 번으로 끝나고, 일일 호출 한도와 응답 시간을 아낀다.
  return collectOpenApiItems(
    SHOPPING_MALL_INQRY_VARIANTS.flatMap(variant => (
      SHOPPING_MALL_SEARCH_KEYS.map(searchKey => () => (
        fetchNaramarket(fetchText, serviceKey, path, buildShoppingMallParams(searchKey, keyword, pageNo, variant))
      ))
    )),
  );
}

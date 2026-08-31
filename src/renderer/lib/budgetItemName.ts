// 나라장터 검색 결과를 예산안에 넣을 때 품목명을 "물품명(식별번호)" 형태로 만든다.
// 식별번호가 함께 적혀 있으면 담당자가 나라장터에서 같은 물품을 바로 찾을 수 있고,
// 품의·계약 단계에서 물품을 특정하기도 쉽다.

// 나라장터 물품식별번호는 숫자 8자리다(예: 25262451).
// 자릿수를 8자리로 못 박는 이유가 두 가지 있다.
//  1) 앱이 내부적으로 쓰는 식별자(example-draft·ai-generated·market-... 등)가
//     품목명에 섞여 들어가는 것을 막는다.
//  2) 같은 응답에 들어 있는 물품분류번호(10자리, 예: 5610170301)를 식별번호로
//     잘못 붙이는 것을 막는다. 둘 다 숫자여서 자릿수 말고는 구분할 방법이 없다.
const NARA_ID_NO = /^\d{8}$/;

export function extractNaraIdNo(thngCd?: unknown): string {
  const trimmed = String(thngCd ?? '').trim();
  return NARA_ID_NO.test(trimmed) ? trimmed : '';
}

// 응답 한 줄에서 물품식별번호를 찾는다.
// 조달청 응답의 항목 이름은 서비스마다 조금씩 달라서 하나로 못 박기 어렵다.
// 그래서 알려진 이름(prdctIdntNo)을 먼저 보고, 없으면 이름에 식별(idnt)이 들어간
// 항목 중 값이 8자리 숫자인 것을 쓴다. 이름을 함께 보기 때문에 계약종료일(20261231)처럼
// 우연히 8자리인 다른 값이 식별번호로 잘못 뽑히지 않는다.
export function pickNaraIdNo(row: Record<string, unknown>): string {
  const direct = extractNaraIdNo(row.prdctIdntNo);
  if (direct) return direct;
  for (const [name, value] of Object.entries(row)) {
    if (!/idnt/i.test(name)) continue;
    const found = extractNaraIdNo(value);
    if (found) return found;
  }
  return '';
}

// 품목명에 식별번호를 괄호로 덧붙인다. 식별번호가 없으면 품목명을 그대로 둔다.
export function formatItemNameWithIdNo(thngNm?: string, thngCd?: string): string {
  const name = String(thngNm ?? '').trim();
  const idNo = extractNaraIdNo(thngCd);
  if (!name) return name;
  if (!idNo) return name;
  // 이미 같은 식별번호가 붙어 있으면 중복해서 붙이지 않는다.
  if (name.includes(`(${idNo})`)) return name;
  return `${name}(${idNo})`;
}

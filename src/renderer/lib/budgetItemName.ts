// 나라장터 검색 결과를 예산안에 넣을 때 품목명을 "물품명(식별번호)" 형태로 만든다.
// 식별번호가 함께 적혀 있으면 담당자가 나라장터에서 같은 물품을 바로 찾을 수 있고,
// 품의·계약 단계에서 물품을 특정하기도 쉽다.

// 나라장터 물품식별번호는 숫자 8자리다(예: 20698349).
// 앱이 내부적으로 쓰는 식별자(example-draft·ai-generated·market-... 등)가
// 품목명에 섞여 들어가지 않도록 자릿수까지 확인한다.
const NARA_ID_NO = /^\d{8}$/;

export function extractNaraIdNo(thngCd?: unknown): string {
  const trimmed = String(thngCd ?? '').trim();
  return NARA_ID_NO.test(trimmed) ? trimmed : '';
}

// 응답 한 줄에서 물품식별번호를 찾는다.
// 반드시 항목 이름을 함께 봐야 한다. 같은 응답에 8자리 숫자가 여럿 들어 있어서
// 자릿수만으로는 고를 수 없기 때문이다 — 품명번호(prdctClsfcNo=14111507),
// 계약일자·계약종료일(cntrctDate=20260115, cntrctEndDate=20261231)이 모두 8자리다.
// 그래서 알려진 이름(prdctIdntNo)을 먼저 보고, 없을 때만 이름에 식별(idnt)이
// 들어간 항목 중 값이 8자리 숫자인 것을 쓴다.
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

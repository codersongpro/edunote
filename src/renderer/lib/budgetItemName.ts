// 나라장터 검색 결과를 예산안에 넣을 때 품목명을 "물품명(식별번호)" 형태로 만든다.
// 식별번호가 함께 적혀 있으면 담당자가 나라장터에서 같은 물품을 바로 찾을 수 있고,
// 품의·계약 단계에서 물품을 특정하기도 쉽다.

// 나라장터 물품식별번호는 숫자로만 이루어진다. 앱이 내부적으로 쓰는 식별자
// (example-draft·ai-generated·market-... 등)가 품목명에 섞여 들어가지 않도록,
// 숫자로만 된 값만 식별번호로 인정한다.
const NARA_ID_NO = /^\d{6,14}$/;

export function extractNaraIdNo(thngCd?: string): string {
  const trimmed = String(thngCd ?? '').trim();
  return NARA_ID_NO.test(trimmed) ? trimmed : '';
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

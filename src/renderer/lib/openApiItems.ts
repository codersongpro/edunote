// 공공데이터포털 응답에서 실제로 몇 건이 왔는지, 각 항목이 어떤 필드 이름을 쓰는지 읽는다.
// 응답은 정상인데 화면에 아무것도 안 보일 때, "정말 0건"인지 "필드 이름이 달라 단가를
// 못 읽은 것"인지 구분하려면 원본 항목을 그대로 봐야 한다.

export interface ApiItemSummary {
  // 응답에 담겨 온 항목 수
  count: number;
  // 첫 항목이 사용하는 필드 이름들(쉼표로 이어 붙임). 항목이 없으면 빈 문자열.
  fieldNames: string;
}

const MAX_FIELD_NAMES = 14;

// 포털 응답은 items가 배열인 경우와 items.item에 담기는 경우가 섞여 있고,
// 결과가 한 건이면 배열이 아니라 객체 하나로 오기도 한다.
export function readApiItemRows(data: unknown): Record<string, unknown>[] {
  const payload = data as any;
  const items = payload?.response?.body?.items ?? payload?.body?.items ?? [];
  const source = items?.item ?? items;
  if (Array.isArray(source)) {
    return source.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object');
  }
  return source && typeof source === 'object' ? [source as Record<string, unknown>] : [];
}

export function readApiItemCount(data: unknown): ApiItemSummary {
  const rows = readApiItemRows(data);
  if (rows.length === 0) return { count: 0, fieldNames: '' };

  const names = Object.keys(rows[0]);
  const shown = names.slice(0, MAX_FIELD_NAMES).join(', ');
  return {
    count: rows.length,
    fieldNames: names.length > MAX_FIELD_NAMES ? `${shown} 외 ${names.length - MAX_FIELD_NAMES}개` : shown,
  };
}

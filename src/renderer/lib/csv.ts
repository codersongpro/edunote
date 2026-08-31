// CSV 한 줄을 만드는 공용 유틸.
//
// 셀을 나누는 쉼표와 값 안에 들어 있는 쉼표를 구별하려면 모든 셀을 큰따옴표로 감싸고,
// 값 안의 큰따옴표는 두 번 반복해야 한다(RFC 4180). 일부 셀만 감싸면
// "협동심, 배려심"처럼 쉼표가 든 값에서 열이 밀린다.
//
// BOM은 여기서 붙이지 않는다 — 메인 프로세스의 file:save-csv 핸들러가 저장 직전에
// 한글 엑셀 호환용으로 한 번 붙이므로, 여기서 또 붙이면 파일 첫 칸에
// 보이지 않는 문자가 남는다.

function escapeCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

/** 2차원 배열(첫 행은 보통 머리글)을 CSV 문자열로 만든다. */
export function toCsv(rows: unknown[][]): string {
  return rows.map(row => row.map(escapeCell).join(',')).join('\n');
}

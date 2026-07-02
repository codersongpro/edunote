/**
 * 시맨틱 버전 비교 유틸.
 * `1.16.0-beta`처럼 숫자 뒤에 접미사가 붙은 세그먼트도 안전하게 다룬다.
 * 각 세그먼트에서 앞쪽 숫자 부분만 취하고, 숫자가 없으면 0으로 본다.
 */
function parseSegment(seg: string | undefined): number {
  if (!seg) return 0;
  const m = /^\d+/.exec(seg.trim());
  return m ? parseInt(m[0], 10) : 0;
}

/** a가 b보다 큰 버전이면 true (major.minor.patch만 비교) */
export function semverGt(a: string, b: string): boolean {
  const pa = String(a ?? '').split('.');
  const pb = String(b ?? '').split('.');
  for (let i = 0; i < 3; i++) {
    const d = parseSegment(pa[i]) - parseSegment(pb[i]);
    if (d !== 0) return d > 0;
  }
  return false;
}

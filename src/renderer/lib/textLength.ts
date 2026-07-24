// 나이스(NEIS) 생기부 시스템과 동일하게 UTF-8 인코딩 기준으로 바이트 수를 계산한다.
// (한글 1자 = 3byte, 영문/숫자/공백 = 1byte)
export function getByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

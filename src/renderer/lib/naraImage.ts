// 나라장터 종합쇼핑몰 품목정보 응답의 상품 사진 주소(prdctImgUrl)를 썸네일로 쓸 수 있는
// 형태로 다듬는다. 응답에는 빈 값·공백·"-" 같은 자리표시 값이 섞여 오고,
// 스킴이 없는 "//host/a.jpg" 형태로 오는 경우도 있어 그대로 <img>에 넣으면 깨진다.
// 메인 프로세스의 이미지 대행 요청(resource:fetch-image)은 http·https만 허용하므로
// 그 두 가지로 정규화되지 않는 값은 아예 버린다.

export function toNaraImageUrl(raw?: unknown): string {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed || trimmed === '-') return '';
  // 스킴이 없는 프로토콜 상대 주소는 https로 채워 넣는다.
  const candidate = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.toString();
  } catch {
    // 상대 경로 등 기준 주소 없이는 열 수 없는 값은 썸네일로 쓰지 않는다.
    return '';
  }
}

// data: URL로 된 PNG를 OS 클립보드에 이미지로 넣기 전에 값이 쓸 만한지 검사한다.
//
// 렌더러에서 fetch(dataUrl) → blob → ClipboardItem 경로를 쓸 수 없다.
// index.html의 CSP가 connect-src를 'self'와 파이어베이스 주소로만 열어 두어,
// data: URL에 대한 fetch가 connect-src 위반으로 차단되기 때문이다. 그래서 예외가 나고
// 텍스트 복사 폴백만 동작했다. 메인 프로세스의 네이티브 클립보드를 쓰면 CSP와
// 브라우저 클립보드 권한을 모두 우회한다.

const PNG_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/;

/** 클립보드에 이미지로 넣어도 되는 PNG data URL인지 검사한다. */
export function isPngDataUrl(value: unknown): value is string {
  return typeof value === 'string' && PNG_DATA_URL.test(value);
}

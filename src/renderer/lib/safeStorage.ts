// localStorage 쓰기 안전 래퍼.
// 저장 공간(5~10MB)이 가득 차면 setItem이 예외를 던져 앱이 멈출 수 있으므로,
// 실패해도 앱은 계속 동작하게 하고 성공 여부만 돌려준다.
export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.warn(`[safeSetItem] 저장 실패 (저장 공간 부족 가능): ${key}`, e);
    return false;
  }
}

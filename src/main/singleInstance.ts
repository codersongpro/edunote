export interface FocusableWindow {
  isDestroyed(): boolean;
  isMinimized(): boolean;
  restore(): void;
  show(): void;
  focus(): void;
}

/** 두 번째 실행 요청이 오면 기존 EduNote 창을 사용자가 바로 볼 수 있게 합니다. */
export function focusFirstAppWindow(windows: FocusableWindow[]): boolean {
  const window = windows.find(candidate => !candidate.isDestroyed());
  if (!window) return false;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
  return true;
}

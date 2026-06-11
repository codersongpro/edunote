// 컴포넌트 어디서나 토스트를 띄울 수 있게 하는 전역 헬퍼.
// App이 'edunote-toast' 이벤트를 듣고 토스트 큐에 넣는다.
// (GlobalStateContext의 showToast를 모든 컴포넌트에 배선하지 않고도 사용 가능)
export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastPayload {
  type: ToastType;
  title: string;
  description?: string;
}

export function notifyToast(payload: ToastPayload): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('edunote-toast', { detail: payload }));
}

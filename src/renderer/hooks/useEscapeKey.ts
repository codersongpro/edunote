import { useEffect } from 'react';

// 모달 등이 열려 있을 때 Esc 키로 닫을 수 있게 해주는 훅.
// active가 true일 때만 keydown 리스너를 등록하고, Esc가 눌리면 onClose를 호출한다.
export function useEscapeKey(active: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!active) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active, onClose]);
}

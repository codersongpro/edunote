// Electron의 Clipboard API는 실행 환경이나 권한 상태에 따라 거부될 수 있다.
// 일반 텍스트 복사는 브라우저 API를 먼저 쓰고, 실패하면 사용자 클릭 이벤트 안에서
// 동작하는 textarea 선택 방식으로 한 번 더 시도한다.
export async function copyPlainTextToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.warn('[clipboard] Clipboard API 복사 실패 — 대체 경로 사용:', error);
    }
  }

  const textarea = document.createElement('textarea');
  textarea.dataset.edunoteClipboardFallback = 'true';
  textarea.value = text;
  textarea.readOnly = true;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);

  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    return typeof document.execCommand === 'function' && document.execCommand('copy');
  } catch (error) {
    console.error('[clipboard] 대체 복사 실패:', error);
    return false;
  } finally {
    textarea.remove();
  }
}

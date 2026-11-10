// 웹판의 "새 창" 기능 — 데스크톱의 BrowserWindow를 같은 크기의 팝업 창으로 대신한다.

const POPUP_SIZES = {
  demo: { width: 560, height: 760 },
  chat: { width: 760, height: 900 },
  search: { width: 900, height: 800 },
} as const;

function features(kind: keyof typeof POPUP_SIZES): string {
  const { width, height } = POPUP_SIZES[kind];
  const left = Math.max(0, Math.round((window.screen.availWidth - width) / 2));
  const top = Math.max(0, Math.round((window.screen.availHeight - height) / 2));
  return `popup=yes,width=${width},height=${height},left=${left},top=${top}`;
}

function appUrl(hash: string): string {
  const url = new URL(window.location.href);
  url.hash = hash;
  return url.toString();
}

export function isSafeHttpUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

// 외부 사이트는 새 탭으로, 이 앱에 접근하지 못하도록 opener를 끊어서 연다.
export function openExternalTab(url: string): boolean {
  if (!isSafeHttpUrl(url)) return false;
  // noopener로 열면 브라우저가 null을 돌려주므로 반환값으로 성공 여부를 판단하지 않는다.
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

export function openSearchPopup(url: string): boolean {
  if (!isSafeHttpUrl(url)) return false;
  window.open(url, 'edunote-search', `${features('search')},noopener,noreferrer`);
  return true;
}

let demoRef: Window | null = null;
export function openDemoPopup(): void {
  if (demoRef && !demoRef.closed) { demoRef.focus(); return; }
  demoRef = window.open(appUrl('demo'), 'edunote-demo', features('demo'));
}

// 채팅 대화 창 — 열림 상태를 본 창(QR·접속주소 화면)에 알려준다.
let chatRef: Window | null = null;
let chatPoll: ReturnType<typeof setInterval> | null = null;
const chatListeners = new Set<(open: boolean) => void>();

function emitChatState(open: boolean): void {
  for (const cb of chatListeners) {
    try { cb(open); } catch { /* 구독자 오류는 무시 */ }
  }
}

export function isChatPopupOpen(): boolean {
  return !!chatRef && !chatRef.closed;
}

export function openChatPopup(reload?: boolean): void {
  if (chatRef && !chatRef.closed) {
    if (reload) chatRef.location.reload();
    chatRef.focus();
    return;
  }
  chatRef = window.open(appUrl('chat'), 'edunote-chat', features('chat'));
  if (!chatRef) return;
  emitChatState(true);
  if (chatPoll) clearInterval(chatPoll);
  chatPoll = setInterval(() => {
    if (!chatRef || chatRef.closed) {
      if (chatPoll) clearInterval(chatPoll);
      chatPoll = null;
      chatRef = null;
      emitChatState(false);
    }
  }, 1000);
}

export function onChatPopupState(cb: (open: boolean) => void): () => void {
  chatListeners.add(cb);
  return () => { chatListeners.delete(cb); };
}

// AI가 만든 HTML 앱·퀴즈를 새 창에서 실행한다.
// 이 앱과 같은 출처(origin)에서 실행하면 생성된 스크립트가 API 키·학생 데이터(IndexedDB)에 접근할 수 있으므로,
// CSP sandbox 헤더가 붙은 /sandbox.html(고유 출처 없음)에 HTML을 넘겨 격리된 상태로 실행한다.
export function openSandboxedHtml(html: string): boolean {
  const target = window.open(new URL('sandbox.html', window.location.href).toString(), '_blank', 'popup=no');
  if (!target) return false;
  const onMessage = (event: MessageEvent) => {
    if (event.source !== target || event.data?.type !== 'edunote-sandbox-ready') return;
    window.removeEventListener('message', onMessage);
    // 샌드박스 창은 출처가 없는(opaque) 문서라 대상 출처를 '*'로만 지정할 수 있다. 내용은 사용자가 만든 HTML뿐이다.
    target.postMessage({ type: 'edunote-sandbox-html', html }, '*');
  };
  window.addEventListener('message', onMessage);
  setTimeout(() => window.removeEventListener('message', onMessage), 30_000);
  return true;
}

// PDF 저장 — 숨긴 iframe에 문서를 넣고 브라우저 인쇄 창을 띄운다("PDF로 저장" 선택).
// sandbox에 allow-scripts를 주지 않아 문서 안의 스크립트는 실행되지 않는다.
export function printHtml(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-same-origin allow-modals');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    frame.onload = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
        resolve();
      } catch (e) {
        reject(e);
      } finally {
        setTimeout(() => frame.remove(), 1000);
      }
    };
    frame.srcdoc = html;
    document.body.appendChild(frame);
  });
}

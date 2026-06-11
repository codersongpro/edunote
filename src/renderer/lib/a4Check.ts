// 생성된 워크시트 HTML이 A4 한 장을 넘는지 렌더 높이로 추정한다.
// 숨김 iframe에 문서를 그대로 로드해 측정하므로 <head>의 스타일도 반영된다.
// (앱 CSP가 srcdoc에 상속되어 스크립트는 실행되지 않지만, 만약을 위해 한 번 더 제거한다)

// 96dpi 기준 A4 본문 영역: 너비 210-28mm ≈ 688px, 높이 297-24mm ≈ 1032px
const A4_CONTENT_WIDTH_PX = 688;
const A4_CONTENT_HEIGHT_PX = 1032;
const MEASURE_TIMEOUT_MS = 3000;

const stripActiveContent = (html: string): string =>
  String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '');

// A4 기준 예상 장수를 반환한다. 측정에 실패하면 1을 반환해 경고를 띄우지 않는다.
export function estimateA4Pages(html: string): Promise<number> {
  return new Promise(resolve => {
    let settled = false;
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = `position:absolute;left:-99999px;top:0;width:${A4_CONTENT_WIDTH_PX}px;height:${A4_CONTENT_HEIGHT_PX}px;visibility:hidden;pointer-events:none;border:0;`;

    const finish = (pages: number) => {
      if (settled) return;
      settled = true;
      iframe.remove();
      resolve(pages);
    };

    iframe.onload = () => {
      try {
        const doc = iframe.contentDocument;
        const height = Math.max(doc?.body?.scrollHeight ?? 0, doc?.documentElement?.scrollHeight ?? 0);
        finish(height > 0 ? Math.max(1, Math.ceil(height / A4_CONTENT_HEIGHT_PX)) : 1);
      } catch {
        finish(1);
      }
    };

    setTimeout(() => finish(1), MEASURE_TIMEOUT_MS);
    document.body.appendChild(iframe);
    iframe.srcdoc = stripActiveContent(html);
  });
}

import { describe, expect, it } from 'vitest';
import { collectHtmlTextNodes, writeHtmlTextNodes } from '../htmlTextNodes';

describe('htmlTextNodes', () => {
  it('서식을 유지한 채 바뀐 텍스트 노드만 고치고, 그사이 편집된 노드는 건너뛴다', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    root.innerHTML = '<h1>2025학년도</h1><p style="color:red"><b>기간</b> 4주</p><style>.x{}</style>';
    const snapshot = collectHtmlTextNodes(root);
    expect(snapshot.nodes).toEqual(['2025학년도', '기간', ' 4주']);

    snapshot.textNodes[1].nodeValue = '사용자가 고친 글자';
    const result = writeHtmlTextNodes(snapshot, ['2026학년도', '바꿀 글자', ' 6주']);
    expect(result).toEqual({ written: 2, skipped: 1 });
    expect(root.innerHTML).toBe('<h1>2026학년도</h1><p style="color:red"><b>사용자가 고친 글자</b> 6주</p><style>.x{}</style>');

    root.remove();
    expect(writeHtmlTextNodes(snapshot, ['2027학년도', '기간', ' 6주'])).toEqual({ written: 0, skipped: 2 });
  });
});

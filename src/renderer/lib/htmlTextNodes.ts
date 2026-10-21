// 화면에 보이는 HTML 문서(결과 편집기)의 텍스트 노드를 검토용 노드 배열로 다룬다.
// 텍스트 노드의 글자만 바꾸므로 표·글자 크기·들여쓰기 같은 서식은 그대로 남는다.

export interface HtmlTextSnapshot {
  nodes: string[];
  textNodes: Text[];
}

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);

export function collectHtmlTextNodes(root: Node): HtmlTextSnapshot {
  const doc = root.ownerDocument ?? (root as Document);
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: node => (node.parentElement && SKIP_TAGS.has(node.parentElement.tagName)
      ? NodeFilter.FILTER_REJECT
      : NodeFilter.FILTER_ACCEPT),
  });
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
  return { nodes: textNodes.map(node => node.nodeValue ?? ''), textNodes };
}

// 검토 뒤 사용자가 편집기에서 직접 고친 노드는 덮어쓰지 않는다.
// 바꾼 노드 수와, 그사이 내용이 달라져 건너뛴 노드 수를 돌려준다.
export function writeHtmlTextNodes(snapshot: HtmlTextSnapshot, updated: string[]): { written: number; skipped: number } {
  let written = 0;
  let skipped = 0;
  snapshot.textNodes.forEach((node, i) => {
    if (updated[i] === undefined || updated[i] === snapshot.nodes[i]) return;
    if (!node.isConnected || node.nodeValue !== snapshot.nodes[i]) {
      skipped += 1;
      return;
    }
    node.nodeValue = updated[i];
    written += 1;
  });
  return { written, skipped };
}

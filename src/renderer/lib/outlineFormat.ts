// 연수자료처럼 계획서와 같은 말머리 위계(1. → 가. → 1) → 가))로 쓰는 문서에서
// AI가 들여쓰기와 글자 크기를 빠뜨려도 화면·인쇄·저장 결과가 항상 같은 서식으로
// 보이도록 보정한다. 프롬프트만으로는 서식이 반영되지 않는 경우가 있어, 생성된
// HTML을 한 번 더 훑어 단계별 들여쓰기와 글자 크기를 직접 넣어 준다.

export type OutlineLevel = 1 | 2 | 3 | 4;

export interface OutlineLevelStyle {
  // 해당 단계 줄의 왼쪽 들여쓰기
  indent: string;
  // 해당 단계 줄의 글자 크기
  fontSize: string;
  // 대항목만 굵게 표시한다.
  bold: boolean;
}

// 계획서 서식과 같은 단계별 들여쓰기·글자 크기 값
export const OUTLINE_LEVEL_STYLES: Record<OutlineLevel, OutlineLevelStyle> = {
  1: { indent: '0px', fontSize: '16pt', bold: true },
  2: { indent: '14px', fontSize: '13pt', bold: false },
  3: { indent: '30px', fontSize: '12.5pt', bold: false },
  4: { indent: '46px', fontSize: '12pt', bold: false },
};

// 제목(h1)과 대항목 제목(h2·h3)에 인라인 글자 크기가 없을 때 사용할 기본값
const HEADING_FONT_SIZES: Record<string, string> = {
  H1: '22pt',
  H2: '16pt',
  H3: '14pt',
};

// 개조식 말머리에 쓰는 한글 순서 글자
const HANGUL_MARKERS = '가나다라마바사아자차카타파하';

// 줄 앞의 공백·비줄바꿈 공백(&nbsp;)을 모두 제거한 뒤 말머리를 판별한다.
const LEADING_SPACE = /^[\s\u00a0]+/;

const LEVEL_PATTERNS: Array<{ level: OutlineLevel; pattern: RegExp }> = [
  { level: 1, pattern: /^\d{1,2}\.(?!\d)\s*\S/ },
  { level: 2, pattern: new RegExp(`^[${HANGUL_MARKERS}]\\.\\s*\\S`) },
  { level: 3, pattern: /^\d{1,2}\)\s*\S/ },
  { level: 4, pattern: new RegExp(`^[${HANGUL_MARKERS}]\\)\\s*\\S`) },
];

// 문장 맨 앞의 말머리 기호로 항목 단계를 판별한다. 말머리가 없으면 null.
export function detectOutlineLevel(text: string): OutlineLevel | null {
  const trimmed = String(text ?? '').replace(LEADING_SPACE, '');
  for (const { level, pattern } of LEVEL_PATTERNS) {
    if (pattern.test(trimmed)) return level;
  }
  return null;
}

const HANGING_INDENTS: Record<OutlineLevel, string> = {
  1: '2.4em',
  2: '2.2em',
  3: '2.4em',
  4: '2.2em',
};

// 단계별 인라인 스타일 문자열을 만든다. 한 요소가 단계 여백과 내어쓰기를 함께
// 책임져야 부모 여백과 합산되지 않고, 긴 줄의 둘째 줄도 본문 시작점에 맞는다.
export function buildOutlineLineStyle(level: OutlineLevel): string {
  const style = OUTLINE_LEVEL_STYLES[level];
  const hangingIndent = HANGING_INDENTS[level];
  return `display:block; margin-left:${style.indent}; padding-left:${hangingIndent}; text-indent:-${hangingIndent}; width:calc(100% - ${style.indent}); box-sizing:border-box; font-size:${style.fontSize};${style.bold ? ' font-weight:bold;' : ''}`;
}

const BLOCK_CHILD_TAGS = new Set(['DIV', 'P', 'TABLE', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

// <br>을 기준으로 자식 노드를 한 줄씩 묶는다.
function splitLines(block: Element): ChildNode[][] {
  const lines: ChildNode[][] = [];
  let current: ChildNode[] = [];
  Array.from(block.childNodes).forEach(node => {
    if (node.nodeType === 1 && BLOCK_CHILD_TAGS.has((node as Element).tagName)) {
      if (current.length > 0) lines.push(current);
      current = [];
      return;
    }
    if (node.nodeName === 'BR') {
      lines.push(current);
      current = [];
      return;
    }
    current.push(node);
  });
  lines.push(current);
  return lines;
}

function firstTextNode(nodes: ChildNode[]): Text | null {
  const visit = (node: ChildNode): Text | null => {
    if (node.nodeType === 3) return node as Text;
    for (const child of Array.from(node.childNodes)) {
      const found = visit(child);
      if (found) return found;
    }
    return null;
  };
  for (const node of nodes) {
    const found = visit(node);
    if (found) return found;
  }
  return null;
}

function normalizeOutlineElement(element: HTMLElement, level: OutlineLevel): void {
  element.setAttribute('data-outline-level', String(level));
  element.setAttribute('style', buildOutlineLineStyle(level));
  const firstText = firstTextNode(Array.from(element.childNodes));
  if (firstText?.textContent) firstText.textContent = firstText.textContent.replace(LEADING_SPACE, '');
}

// 한 줄의 말머리 단계를 판별해 들여쓰기·글자 크기를 가진 span으로 감싼다.
function formatBlockLines(doc: Document, block: Element): void {
  if (block.closest('table')) return;
  const lines = splitLines(block);
  const meaningfulLines = lines.filter(nodes => nodes.some(node => (node.textContent ?? '').trim()));
  const allDirectLinesAreOutline = meaningfulLines.length > 0 && meaningfulLines.every(nodes => {
    if (nodes.length === 1 && nodes[0].nodeType === 1 && (nodes[0] as Element).hasAttribute('data-outline-level')) return true;
    return detectOutlineLevel(nodes.map(node => node.textContent ?? '').join('')) !== null;
  });

  lines.forEach(nodes => {
    if (nodes.length === 0) return;
    const first = nodes[0];
    if (nodes.length === 1 && first.nodeType === 1 && (first as Element).hasAttribute('data-outline-level')) {
      const existing = first as HTMLElement;
      const level = Number(existing.getAttribute('data-outline-level')) as OutlineLevel;
      if (OUTLINE_LEVEL_STYLES[level]) normalizeOutlineElement(existing, level);
      return;
    }

    const text = nodes.map(node => node.textContent ?? '').join('');
    const level = detectOutlineLevel(text);
    if (!level) return;

    const wrapper = doc.createElement('span');
    block.insertBefore(wrapper, first);
    nodes.forEach(node => wrapper.appendChild(node));
    normalizeOutlineElement(wrapper, level);
  });

  // 모든 직접 본문 줄이 정규화 대상이면 기존 부모 여백을 지운다. 표나 하위 블록의
  // 사용자 서식은 건드리지 않으며, 단계 여백은 data-outline-level 요소 하나만 맡는다.
  if (allDirectLinesAreOutline && block instanceof HTMLElement) {
    block.style.removeProperty('margin-left');
    block.style.removeProperty('padding-left');
    if (!block.style.cssText) block.removeAttribute('style');
  }

  Array.from(block.children).forEach((child, index, children) => {
    if (child.tagName !== 'BR') return;
    const previous = children[index - 1];
    const next = children[index + 1];
    if (previous?.hasAttribute('data-outline-level') && next?.hasAttribute('data-outline-level')) child.remove();
  });
}

// 제목 태그와 말머리 줄에 서식을 채워 넣는다.
function formatRoot(doc: Document, root: Element): void {
  // 제목 태그는 인라인 크기가 없으면 미리보기 공통 스타일에 눌려 본문과 같은 크기로 보인다.
  root.querySelectorAll<HTMLElement>('h1, h2, h3').forEach(heading => {
    const fallback = HEADING_FONT_SIZES[heading.tagName];
    if (fallback && !heading.style.fontSize) heading.style.fontSize = fallback;
    if (!heading.style.fontWeight) heading.style.fontWeight = 'bold';
  });

  root.querySelectorAll<HTMLElement>('[data-outline-level]').forEach(element => {
    const level = Number(element.getAttribute('data-outline-level')) as OutlineLevel;
    if (OUTLINE_LEVEL_STYLES[level]) normalizeOutlineElement(element, level);
  });

  root.querySelectorAll('div, p').forEach(block => {
    if (block.hasAttribute('data-outline-level')) return;
    formatBlockLines(doc, block);
  });
}

// 생성된 문서 HTML에 말머리 단계별 들여쓰기와 글자 크기를 적용해 돌려준다.
export function applyOutlineStyles(html: string): string {
  const source = String(html ?? '');
  if (!source.trim() || typeof DOMParser === 'undefined') return source;

  const parser = new DOMParser();

  // AI가 <html>·<!DOCTYPE>을 포함한 전체 문서를 만든 경우에는 div로 감싸면 구조가
  // 흐트러지므로 문서 그대로 파싱해 본문만 손본다.
  if (/<html[\s>]/i.test(source) || /^\s*<!DOCTYPE\s+html/i.test(source)) {
    const fullDoc = parser.parseFromString(source, 'text/html');
    if (!fullDoc.body) return source;
    formatRoot(fullDoc, fullDoc.body);
    return fullDoc.documentElement.outerHTML;
  }

  const doc = parser.parseFromString(`<div data-outline-root>${source}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return source;

  formatRoot(doc, root);

  return root.innerHTML;
}

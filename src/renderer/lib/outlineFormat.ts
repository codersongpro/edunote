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
  { level: 1, pattern: /^\d{1,2}\.\s*\S/ },
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

// 단계별 인라인 스타일 문자열을 만든다.
// display:inline-block을 써야 줄이 길어져 넘어가도 들여쓰기 위치가 유지된다.
export function buildOutlineLineStyle(level: OutlineLevel): string {
  const style = OUTLINE_LEVEL_STYLES[level];
  return `display:inline-block; padding-left:${style.indent}; font-size:${style.fontSize};${style.bold ? ' font-weight:bold;' : ''}`;
}

// 문단 안에 다시 블록 요소가 들어 있으면 그 문단은 건너뛴다(중복 처리 방지).
const BLOCK_CHILD_SELECTOR = 'div,p,table,ul,ol,h1,h2,h3,h4,h5,h6';

// <br>을 기준으로 자식 노드를 한 줄씩 묶는다.
function splitLines(block: Element): ChildNode[][] {
  const lines: ChildNode[][] = [];
  let current: ChildNode[] = [];
  Array.from(block.childNodes).forEach(node => {
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

// 한 줄의 말머리 단계를 판별해 들여쓰기·글자 크기를 가진 span으로 감싼다.
function formatBlockLines(doc: Document, block: Element): void {
  if (block.closest('table')) return;
  if (block.querySelector(BLOCK_CHILD_SELECTOR)) return;

  splitLines(block).forEach(nodes => {
    if (nodes.length === 0) return;
    const first = nodes[0];
    if (nodes.length === 1 && first.nodeType === 1 && (first as Element).hasAttribute('data-outline-level')) return;

    const text = nodes.map(node => node.textContent ?? '').join('');
    const level = detectOutlineLevel(text);
    if (!level) return;

    // AI가 &nbsp;로 직접 넣은 들여쓰기가 남아 있으면 우리 들여쓰기와 겹치므로 지운다.
    if (first.nodeType === 3 && first.textContent) {
      first.textContent = first.textContent.replace(LEADING_SPACE, '');
    }

    const wrapper = doc.createElement('span');
    wrapper.setAttribute('data-outline-level', String(level));
    wrapper.setAttribute('style', buildOutlineLineStyle(level));
    block.insertBefore(wrapper, first);
    nodes.forEach(node => wrapper.appendChild(node));
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

  root.querySelectorAll('div, p').forEach(block => formatBlockLines(doc, block));
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

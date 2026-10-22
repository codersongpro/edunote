// 현행화 제안을 비교표 대신 본문 위에 바로 보여 주기 위한 배치 계산.
// 노드(HWPX 글자 노드·텍스트 줄)를 문단으로 묶고, 각 제안이 놓일 글자 위치를 찾는다.

import { DocSuggestion } from './aiReview';

export interface InlinePiece {
  text: string;
  suggestion?: DocSuggestion;
}

export interface InlineParagraph {
  key: string;
  pieces: InlinePiece[];
}

export interface InlineLayout {
  paragraphs: InlineParagraph[];
  /** 본문 위치에 놓을 수 없는 제안(문서 전체 안내, 다른 제안과 겹친 제안) */
  unplaced: DocSuggestion[];
}

// 한 노드 안에서 제안 위치를 정한다. 규칙 제안은 계산한 위치를, AI 제안은 아직 비어 있는
// 첫 번째 일치 위치를 쓴다. 겹치면 본문에 놓지 않고 따로 보여 준다.
function placeInNode(text: string, suggestions: DocSuggestion[], unplaced: DocSuggestion[]): InlinePiece[] {
  const taken: Array<{ start: number; end: number; s: DocSuggestion }> = [];
  const free = (start: number, end: number) => taken.every(t => end <= t.start || start >= t.end);
  const ordered = [...suggestions].sort((a, b) => Number(a.start === undefined) - Number(b.start === undefined));
  for (const s of ordered) {
    let start = -1;
    if (s.start !== undefined && text.slice(s.start, s.start + s.before.length) === s.before) {
      start = free(s.start, s.start + s.before.length) ? s.start : -1;
    } else {
      for (let at = text.indexOf(s.before); at !== -1; at = text.indexOf(s.before, at + 1)) {
        if (free(at, at + s.before.length)) { start = at; break; }
      }
    }
    if (start === -1) unplaced.push(s);
    else taken.push({ start, end: start + s.before.length, s });
  }
  taken.sort((a, b) => a.start - b.start);
  const pieces: InlinePiece[] = [];
  let cursor = 0;
  for (const t of taken) {
    if (t.start > cursor) pieces.push({ text: text.slice(cursor, t.start) });
    pieces.push({ text: t.s.before, suggestion: t.s });
    cursor = t.end;
  }
  if (cursor < text.length) pieces.push({ text: text.slice(cursor) });
  return pieces;
}

export function layoutInlineChanges(nodes: string[], paragraphOf: number[] | undefined, items: DocSuggestion[]): InlineLayout {
  const unplaced: DocSuggestion[] = [];
  const byNode = new Map<number, DocSuggestion[]>();
  for (const s of items) {
    if (s.idx < 0 || s.idx >= nodes.length || !s.before) {
      unplaced.push(s);
      continue;
    }
    byNode.set(s.idx, [...(byNode.get(s.idx) ?? []), s]);
  }

  const paragraphs: InlineParagraph[] = [];
  let current: InlineParagraph | null = null;
  let currentPara: number | null = null;
  nodes.forEach((text, idx) => {
    // 문단 정보가 없으면(붙여넣은 글·캡처) 노드 하나가 한 줄이다
    const para = paragraphOf ? paragraphOf[idx] : idx;
    if (!current || para !== currentPara) {
      current = { key: `p${para}`, pieces: [] };
      currentPara = para;
      paragraphs.push(current);
    }
    current.pieces.push(...placeInNode(text, byNode.get(idx) ?? [], unplaced));
  });

  // 글자도 제안도 없는 빈 문단은 화면에서 한 줄 간격으로만 남긴다
  const compact = paragraphs.filter((p, i) => {
    const empty = !p.pieces.some(piece => piece.suggestion || piece.text.trim());
    if (!empty) return true;
    const prev = paragraphs[i - 1];
    return !!prev && prev.pieces.some(piece => piece.suggestion || piece.text.trim());
  }).map(p => (p.pieces.some(piece => piece.suggestion || piece.text.trim()) ? p : { ...p, pieces: [] }));

  return { paragraphs: compact, unplaced };
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 고친 노드를 문단 HTML로 만든다. 문서작성기와 같은 HWPX 생성기(saveHwpx)로 저장할 때 쓰며,
// 생성기가 "1." "가." "1)" 말머리를 보고 단계별 들여쓰기를 다시 매긴다.
export function nodesToParagraphHtml(nodes: string[], paragraphOf?: number[]): string {
  const paragraphs: string[] = [];
  let currentPara: number | null = null;
  nodes.forEach((text, idx) => {
    const para = paragraphOf ? paragraphOf[idx] : idx;
    if (paragraphs.length === 0 || para !== currentPara) {
      currentPara = para;
      paragraphs.push('');
    }
    paragraphs[paragraphs.length - 1] += text;
  });
  return paragraphs
    .map(text => text.trim())
    .filter(Boolean)
    .map(text => `<p>${escapeHtml(text)}</p>`)
    .join('');
}

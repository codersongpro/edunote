import { describe, expect, it } from 'vitest';
import { layoutInlineChanges } from '../inlineChanges';
import type { DocSuggestion } from '../aiReview';

const s = (partial: Partial<DocSuggestion>): DocSuggestion => ({
  id: Math.random().toString(36), idx: 0, before: '', category: '날짜', reason: '', severity: 'info', source: 'rule', needsCheck: false, ...partial,
});

describe('layoutInlineChanges', () => {
  it('HWPX 글자 노드를 문단으로 묶고 제안을 정확한 위치에 놓는다', () => {
    const nodes = ['2025', '학년도 계획', '', '기간: 2025. 3. 4.(화) ~ 2025. 3. 4.(화)'];
    const first = s({ idx: 3, before: '2025. 3. 4.(화)', after: '2026. 3. 4.(수)', start: 4 });
    const second = s({ idx: 3, before: '2025. 3. 4.(화)', after: '2026. 3. 4.(수)', start: 20 });
    const year = s({ idx: 0, before: '2025', after: '2026', start: 0 });
    const { paragraphs, unplaced } = layoutInlineChanges(nodes, [0, 0, 1, 2], [first, second, year]);

    expect(unplaced).toEqual([]);
    expect(paragraphs.map(p => p.pieces.map(x => (x.suggestion ? `[${x.text}]` : x.text)).join(''))).toEqual([
      '[2025]학년도 계획',
      '',
      '기간: [2025. 3. 4.(화)] ~ [2025. 3. 4.(화)]',
    ]);
    expect(paragraphs[2].pieces.filter(x => x.suggestion).map(x => x.suggestion)).toEqual([first, second]);
  });

  it('위치를 모르는 AI 제안은 비어 있는 첫 일치 위치에 놓고, 겹치거나 문서 전체 안내는 따로 모은다', () => {
    const nodes = ['4주 운영, 4주 평가'];
    const rule = s({ idx: 0, before: '4주', after: '6주', start: 0 });
    const ai = s({ idx: 0, before: '4주', after: '5주', source: 'ai' });
    const overlap = s({ idx: 0, before: '4주 운영', after: 'x', source: 'ai' });
    const doc = s({ idx: -1, before: '', reason: '관련 근거 확인' });
    const { paragraphs, unplaced } = layoutInlineChanges(nodes, undefined, [ai, rule, overlap, doc]);

    const placed = paragraphs[0].pieces.filter(x => x.suggestion).map(x => x.suggestion);
    expect(placed).toEqual([rule, ai]);
    expect(unplaced).toEqual([doc, overlap]);
  });

  it('연속된 빈 문단은 한 줄 간격만 남긴다', () => {
    const { paragraphs } = layoutInlineChanges(['가', '', '', '', '나'], undefined, []);
    expect(paragraphs.map(p => p.pieces.map(x => x.text).join(''))).toEqual(['가', '', '나']);
  });
});

describe('nodesToParagraphHtml', () => {
  it('글자 노드를 문단별 <p>로 묶고 HTML을 이스케이프한다', async () => {
    const { nodesToParagraphHtml } = await import('../inlineChanges');
    expect(nodesToParagraphHtml(['2026', '학년도 계획', '', '가. A & B <안내>'], [0, 0, 1, 2]))
      .toBe('<p>2026학년도 계획</p><p>가. A &amp; B &lt;안내&gt;</p>');
    expect(nodesToParagraphHtml(['1. 목적', '가. 내용'])).toBe('<p>1. 목적</p><p>가. 내용</p>');
  });
});

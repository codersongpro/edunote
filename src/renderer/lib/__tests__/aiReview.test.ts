import { describe, expect, it } from 'vitest';
import {
  DocSuggestion,
  applySuggestions,
  changedFillNodes,
  formatNodesForPrompt,
  formatSuggestionReport,
  isDefaultSelected,
  mergeSuggestions,
  parseSuggestions,
  textToNodes,
} from '../aiReview';

const nodes = ['2026학년도 계획', '운영 기간은 4주로 함.', '', '담당: 교무부'];

const suggestion = (partial: Partial<DocSuggestion>): DocSuggestion => ({
  id: Math.random().toString(36), idx: 0, before: '', category: '내용', reason: '', severity: 'warning', source: 'ai', needsCheck: false, ...partial,
});

describe('parseSuggestions', () => {
  it('원문에 없는 글자·범위 밖 번호·바뀌지 않는 제안을 버리고 번호를 바로잡는다', () => {
    const result = parseSuggestions([
      { idx: 1, before: '4주', after: '6주', severity: 'error', category: '변경사항', reason: '교사 입력' },
      { idx: 99, before: '교무부', after: '교육과정부' },
      { idx: 1, before: '없는 글자', after: 'x' },
      { idx: 0, before: '계획', after: '계획' },
      { idx: 1, before: '4주', after: '6주' },
      'oops',
    ], nodes);
    expect(result.map(r => [r.idx, r.before, r.after, r.severity])).toEqual([
      [1, '4주', '6주', 'error'],
      [3, '교무부', '교육과정부', 'warning'],
    ]);
    expect(parseSuggestions('not array', nodes)).toEqual([]);
  });
});

describe('mergeSuggestions', () => {
  it('같은 위치를 지적한 AI 제안보다 규칙 검사 결과를 남긴다', () => {
    const rule = [suggestion({ idx: 1, before: '4주', source: 'rule' })];
    const ai = [suggestion({ idx: 1, before: '기간은 4주로' }), suggestion({ idx: 3, before: '교무부' })];
    expect(mergeSuggestions(rule, ai).map(s => [s.idx, s.source])).toEqual([[1, 'rule'], [3, 'ai']]);
  });
});

describe('applySuggestions', () => {
  it('위치를 아는 제안은 정확한 자리를, AI 제안은 글자를 찾아 바꾼다', () => {
    const a = suggestion({ idx: 1, before: '4주', after: '6주', start: 6, source: 'rule' });
    const b = suggestion({ idx: 1, before: '함.', after: '운영함.' });
    const c = suggestion({ idx: 3, before: '없음', after: 'x' });
    const result = applySuggestions(nodes, [a, b, c]);
    expect(result.nodes[1]).toBe('운영 기간은 6주로 운영함.');
    expect(result.applied).toEqual([a.id, b.id]);
    expect(result.failed).toEqual([c.id]);
    expect(changedFillNodes(nodes, result.nodes)).toEqual([{ idx: 1, value: '운영 기간은 6주로 운영함.' }]);
  });

  it('겹치는 위치 제안과 안내만 하는 제안은 적용하지 않는다', () => {
    const a = suggestion({ idx: 0, before: '2026학년도', after: '2027학년도', start: 0 });
    const b = suggestion({ idx: 0, before: '2026', after: '2027', start: 0 });
    const c = suggestion({ idx: -1, before: '' });
    const result = applySuggestions(nodes, [a, b, c]);
    expect(result.nodes[0]).toBe('2027학년도 계획');
    expect(result.failed).toHaveLength(2);
  });
});

describe('isDefaultSelected', () => {
  it('현행화는 자동 수정 제안을, 검토는 규칙 오류만 기본으로 고른다', () => {
    const ruleError = suggestion({ before: 'a', after: 'b', source: 'rule', severity: 'error' });
    const aiError = suggestion({ before: 'a', after: 'b', severity: 'error' });
    const check = suggestion({ before: 'a', after: 'b', needsCheck: true });
    expect(isDefaultSelected(ruleError, 'review')).toBe(true);
    expect(isDefaultSelected(aiError, 'review')).toBe(false);
    expect(isDefaultSelected(aiError, 'refresh')).toBe(true);
    expect(isDefaultSelected(check, 'refresh')).toBe(false);
  });
});

describe('formatting', () => {
  it('빈 노드를 빼고 번호를 붙여 프롬프트를 만든다', () => {
    expect(formatNodesForPrompt(nodes)).toBe('[0] "2026학년도 계획"\n[1] "운영 기간은 4주로 함."\n[3] "담당: 교무부"');
    expect(textToNodes('a\r\nb')).toEqual(['a', 'b']);
    expect(formatSuggestionReport([suggestion({ before: '4주', after: '6주', reason: '변경', needsCheck: true })]))
      .toBe('1. [주의·내용] (확인 필요)\n   - 4주 → 6주\n   - 이유: 변경');
  });
});

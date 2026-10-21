// 학생기록(행발·세특·스포츠클럽·창체) 결과를 AI 없이 코드로 검사하는 규칙.
// 기재요령 금지어·바이트 상한·다른 학생 이름처럼 확실히 판정할 수 있는 것만 다룬다.

import { findGuidelineViolations } from './guidelineCompliance';
import { getByteLength } from './textLength';
import { normalizeName } from './generationSafety';
import { DocSuggestion, nextSuggestionId } from './aiReview';
import { checkPersonalInfo } from './docRules';

function ruleSuggestion(partial: Omit<DocSuggestion, 'id' | 'source' | 'needsCheck'>): DocSuggestion {
  return { ...partial, id: nextSuggestionId('rule'), source: 'rule', needsCheck: false };
}

// 문장 끝을 "~함." "~임."처럼 명사형으로 쓰는 기록에서 "~다."로 끝난 문장을 찾는다.
// 명사형 종결이 더 많을 때만 안내해, 서술형으로 쓰는 학교 기준을 방해하지 않는다.
function checkSentenceEndings(nodes: string[]): DocSuggestion[] {
  const nounEnding = /(?:함|임|음|됨|봄|짐|김|심)\.(?=\s|$)/g;
  const verbEnding = /([가-힣]{1,6}다)\.(?=\s|$)/g;
  const nounCount = nodes.reduce((n, node) => n + (node.match(nounEnding)?.length ?? 0), 0);
  const verbMatches = nodes.flatMap((node, idx) => [...node.matchAll(verbEnding)].map(m => ({ idx, m })));
  if (nounCount === 0 || verbMatches.length === 0 || verbMatches.length >= nounCount) return [];
  return verbMatches.map(({ idx, m }) => ruleSuggestion({
    idx, start: m.index, before: m[0], category: '문체', severity: 'info',
    reason: '다른 문장은 "~함."처럼 명사형으로 끝납니다. 문장 끝맺음을 맞춰 주세요.',
  }));
}

export function runRecordRules(nodes: string[], options: {
  byteLimit?: number;
  studentName?: string;
  rosterNames?: string[];
}): DocSuggestion[] {
  const text = nodes.join('\n');
  const result: DocSuggestion[] = [];

  if (options.byteLimit && options.byteLimit > 0) {
    const bytes = getByteLength(text);
    if (bytes > options.byteLimit) {
      result.push(ruleSuggestion({
        idx: -1, before: '', category: '분량', severity: 'error',
        reason: `${bytes.toLocaleString()}바이트로 상한 ${options.byteLimit.toLocaleString()}바이트를 ${(bytes - options.byteLimit).toLocaleString()}바이트 넘었습니다.`,
      }));
    }
  }

  for (const violation of findGuidelineViolations(text)) {
    const idx = nodes.findIndex(node => node.includes(violation.term));
    if (idx === -1) continue;
    result.push(ruleSuggestion({
      idx, start: nodes[idx].indexOf(violation.term), before: violation.term, category: '기재요령', severity: 'warning',
      reason: `학교생활기록부 기재요령상 기재 불가·주의 항목(${violation.category})입니다.`,
    }));
  }

  // 일괄 생성 때 다른 학생 이름이 섞여 들어가는 실수를 잡는다.
  const self = normalizeName(options.studentName ?? '');
  const others = Array.from(new Set((options.rosterNames ?? []).map(normalizeName)))
    .filter(name => name.length >= 2 && name !== self && !self.includes(name));
  for (const name of others) {
    const idx = nodes.findIndex(node => node.includes(name));
    if (idx === -1) continue;
    result.push(ruleSuggestion({
      idx, start: nodes[idx].indexOf(name), before: name, category: '다른 학생', severity: 'error',
      reason: '명단에 있는 다른 학생 이름이 들어 있습니다.',
    }));
  }

  result.push(...checkPersonalInfo(nodes), ...checkSentenceEndings(nodes));
  return result.sort((a, b) => a.idx - b.idx);
}

// 교사가 입력한 관찰 근거(태그·추가 메모·관찰 내용)를 AI 검토의 사실 기준으로 묶는다.
export function describeRecordSource(student: {
  positiveTags?: string[];
  negativeTags?: string[];
  selectedTags?: string[];
  additionalContext?: string;
  observationDetails?: { process?: string; attitude?: string; skill?: string; example?: string };
}): string {
  const lines: string[] = [];
  if (student.positiveTags?.length) lines.push(`긍정적 특성: ${student.positiveTags.join(', ')}`);
  if (student.negativeTags?.length) lines.push(`보완할 점: ${student.negativeTags.join(', ')}`);
  if (student.selectedTags?.length) lines.push(`활동 태그: ${student.selectedTags.join(', ')}`);
  const details = student.observationDetails;
  if (details) {
    const labeled: Array<[string, string | undefined]> = [
      ['학습 과정', details.process], ['태도', details.attitude], ['역량', details.skill], ['사례', details.example],
    ];
    for (const [label, value] of labeled) if (value?.trim()) lines.push(`${label}: ${value.trim()}`);
  }
  if (student.additionalContext?.trim()) lines.push(`추가 메모: ${student.additionalContext.trim()}`);
  return lines.join('\n');
}

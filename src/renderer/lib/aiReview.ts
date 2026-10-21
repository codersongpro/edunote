// 공문·계획서·학생기록 "AI 오류 검토"와 "전년도 공문 현행화"가 함께 쓰는 수정 제안 엔진.
//
// 문서를 텍스트 노드 배열(HWPX의 <hp:t>, HTML의 텍스트 노드, 일반 텍스트의 줄)로 보고,
// 규칙 검사와 AI가 "몇 번 노드의 어느 글자를 무엇으로 바꿀지"만 제안한다.
// 문서를 통째로 다시 쓰지 않으므로 원본 서식이 깨지지 않고, 교사가 체크한 제안만 반영된다.

export type SuggestionSeverity = 'error' | 'warning' | 'info';

export interface DocSuggestion {
  id: string;
  /** 노드 번호. 문서 전체에 대한 안내(분량 초과 등)는 -1 */
  idx: number;
  /** 바꿀 원문 글자. 문서 전체 안내는 빈 문자열 */
  before: string;
  /** 원본 노드에서 before가 시작하는 위치. 규칙 검사만 알고 있으며, 같은 글자가 여러 번 나와도 정확한 곳을 바꾼다 */
  start?: number;
  /** 바꿀 글자. 없으면 자동 수정 없이 안내만 한다 */
  after?: string;
  category: string;
  reason: string;
  severity: SuggestionSeverity;
  source: 'rule' | 'ai';
  /** 법령·지침 변경처럼 교사가 원문을 확인한 뒤 반영해야 하는 제안 */
  needsCheck: boolean;
}

export const SEVERITY_LABELS: Record<SuggestionSeverity, string> = {
  error: '오류',
  warning: '주의',
  info: '참고',
};

let suggestionSeq = 0;
export function nextSuggestionId(prefix: string): string {
  suggestionSeq += 1;
  return `${prefix}-${Date.now().toString(36)}-${suggestionSeq}`;
}

// 일반 텍스트는 줄 단위로 노드를 만든다. 빈 줄도 노드로 남겨 다시 합칠 때 줄 구성이 유지된다.
export function textToNodes(text: string): string[] {
  return String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
}

export function nodesToText(nodes: string[]): string {
  return nodes.join('\n');
}

// AI 프롬프트용 노드 목록. 빈 노드는 보내지 않아 토큰을 아낀다.
export function formatNodesForPrompt(nodes: string[], maxChars = 60_000): string {
  const lines: string[] = [];
  let total = 0;
  for (let i = 0; i < nodes.length; i++) {
    const text = nodes[i];
    if (!text.trim()) continue;
    const line = `[${i}] ${JSON.stringify(text)}`;
    total += line.length + 1;
    if (total > maxChars) {
      lines.push('[...문서가 길어 이후 내용은 생략됨]');
      break;
    }
    lines.push(line);
  }
  return lines.join('\n');
}

const SEVERITIES: readonly SuggestionSeverity[] = ['error', 'warning', 'info'];

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

// AI가 돌려준 제안을 문서와 대조해 검증한다.
// 범위를 벗어난 노드 번호, 원문에 없는 글자, 바뀌지 않는 제안은 버린다.
// 노드 번호가 틀렸지만 원문 글자가 다른 노드에 정확히 있으면 그 노드로 바로잡는다.
export function parseSuggestions(raw: unknown, nodes: string[]): DocSuggestion[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: DocSuggestion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const value = item as Record<string, unknown>;
    const before = asText(value.before);
    const afterRaw = value.after;
    const after = typeof afterRaw === 'string' ? afterRaw : undefined;
    if (!before.trim()) continue;
    if (after !== undefined && after === before) continue;

    let idx = Number(value.idx);
    if (!Number.isInteger(idx) || idx < 0 || idx >= nodes.length || !nodes[idx].includes(before)) {
      idx = nodes.findIndex(node => node.includes(before));
      if (idx === -1) continue;
    }

    const key = `${idx}\u0000${before}\u0000${after ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const severity = SEVERITIES.includes(value.severity as SuggestionSeverity)
      ? value.severity as SuggestionSeverity
      : 'warning';
    result.push({
      id: nextSuggestionId('ai'),
      idx,
      before,
      after,
      category: asText(value.category).trim().slice(0, 20) || '내용',
      reason: asText(value.reason).trim().slice(0, 300),
      severity,
      source: 'ai',
      needsCheck: value.needsCheck === true,
    });
  }
  return result;
}

function overlaps(a: DocSuggestion, b: DocSuggestion): boolean {
  if (a.idx !== b.idx || !a.before || !b.before) return false;
  return a.before.includes(b.before) || b.before.includes(a.before);
}

// 같은 위치를 규칙 검사와 AI가 함께 지적하면 계산이 정확한 규칙 검사 결과를 남긴다.
export function mergeSuggestions(rule: DocSuggestion[], ai: DocSuggestion[]): DocSuggestion[] {
  const kept = ai.filter(candidate => !rule.some(r => overlaps(r, candidate)));
  return [...rule, ...kept].sort((a, b) => a.idx - b.idx);
}

export function isApplicable(s: DocSuggestion): boolean {
  return s.idx >= 0 && !!s.before && s.after !== undefined;
}

// 기본으로 체크할 제안. 확인이 필요한 제안은 교사가 직접 고르도록 비워 둔다.
// - 현행화: 자동 수정 가능한 제안 전부
// - 오류 검토: 규칙 검사가 계산으로 확인한 '오류'만
export function isDefaultSelected(s: DocSuggestion, mode: 'refresh' | 'review'): boolean {
  if (!isApplicable(s) || s.needsCheck) return false;
  if (mode === 'refresh') return true;
  return s.source === 'rule' && s.severity === 'error';
}

export interface ApplyResult {
  nodes: string[];
  applied: string[];
  failed: string[];
}

// 선택한 제안을 적용한다.
// - 위치를 아는 규칙 제안은 원본 노드 기준으로 뒤에서부터 바꿔 앞쪽 위치가 밀리지 않게 한다.
//   ("2025. 3. 1. ~ 2026. 2. 28."에서 2025→2026, 2026→2027을 함께 바꿔도 섞이지 않는다.)
// - 위치를 모르는 AI 제안은 그다음에 글자를 찾아 바꾼다.
// 겹치거나 앞선 수정 때문에 원문 글자가 사라진 제안은 억지로 바꾸지 않고 실패로 돌려준다.
export function applySuggestions(nodes: string[], selected: DocSuggestion[]): ApplyResult {
  const next = [...nodes];
  const applied: string[] = [];
  const failed: string[] = [];
  const byNode = new Map<number, DocSuggestion[]>();
  for (const s of selected) {
    if (!isApplicable(s) || s.idx >= next.length) {
      failed.push(s.id);
      continue;
    }
    byNode.set(s.idx, [...(byNode.get(s.idx) ?? []), s]);
  }

  for (const [idx, list] of byNode) {
    const positioned = list
      .filter(s => s.start !== undefined && nodes[idx].slice(s.start, s.start + s.before.length) === s.before)
      .sort((a, b) => b.start! - a.start!);
    let text = nodes[idx];
    let limit = Infinity;
    for (const s of positioned) {
      if (s.start! + s.before.length > limit) {
        failed.push(s.id);
        continue;
      }
      text = text.slice(0, s.start) + s.after + text.slice(s.start! + s.before.length);
      limit = s.start!;
      applied.push(s.id);
    }
    for (const s of list) {
      if (positioned.includes(s)) continue;
      const at = text.indexOf(s.before);
      if (at === -1) {
        failed.push(s.id);
        continue;
      }
      text = text.slice(0, at) + s.after + text.slice(at + s.before.length);
      applied.push(s.id);
    }
    next[idx] = text;
  }
  return { nodes: next, applied, failed };
}

// HWPX 양식 채우기(fillHwpxTemplate)에 넘길 바뀐 노드 목록.
export function changedFillNodes(original: string[], updated: string[]): Array<{ idx: number; value: string }> {
  const result: Array<{ idx: number; value: string }> = [];
  for (let i = 0; i < updated.length; i++) {
    if (updated[i] !== original[i]) result.push({ idx: i, value: updated[i] });
  }
  return result;
}

// 비교표를 복사·저장할 때 쓰는 개조식 텍스트.
export function formatSuggestionReport(suggestions: DocSuggestion[]): string {
  if (suggestions.length === 0) return '발견된 수정 제안이 없습니다.';
  return suggestions.map((s, i) => {
    const head = `${i + 1}. [${SEVERITY_LABELS[s.severity]}·${s.category}]${s.needsCheck ? ' (확인 필요)' : ''}`;
    const change = s.before
      ? `   - ${s.before}${s.after !== undefined ? ` → ${s.after}` : ''}`
      : '';
    const reason = s.reason ? `   - 이유: ${s.reason}` : '';
    return [head, change, reason].filter(Boolean).join('\n');
  }).join('\n');
}

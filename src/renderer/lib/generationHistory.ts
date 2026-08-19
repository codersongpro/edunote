// 학생별 생성 히스토리 관리 (localStorage, 항목별 최대 3개 / 키 총량 제한)
import { safeSetItem } from './safeStorage';

const MAX_HISTORY = 3;
const KEY_PREFIX = 'eduHist_';
// 학생 × 기록 종류가 누적되면 키가 무한정 늘어나므로 총 키 개수를 제한하고,
// 초과분은 가장 오래 갱신되지 않은 키부터 정리한다.
const MAX_KEYS = 300;

export interface HistoryEntry {
  content: string;
  date: string; // ISO 문자열
}

function historyKey(mode: string, name: string): string {
  return `${KEY_PREFIX}${mode}_${name}`;
}

function parseEntries(raw: string | null): HistoryEntry[] {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// 히스토리 키가 상한을 넘으면 가장 최근 항목의 날짜가 오래된 키부터 삭제한다.
function pruneHistoryKeys(keepKey: string): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(KEY_PREFIX)) keys.push(k);
  }
  if (keys.length <= MAX_KEYS) return;

  const latestDate = (k: string): number => {
    const entries = parseEntries(localStorage.getItem(k));
    const d = entries[0]?.date ? Date.parse(entries[0].date) : 0;
    return Number.isNaN(d) ? 0 : d;
  };
  // 오래된 순으로 정렬 후, 방금 저장한 키는 남기고 초과분을 제거한다.
  keys.sort((a, b) => latestDate(a) - latestDate(b));
  let toRemove = keys.length - MAX_KEYS;
  for (const k of keys) {
    if (toRemove <= 0) break;
    if (k === keepKey) continue;
    localStorage.removeItem(k);
    toRemove--;
  }
}

export function saveHistory(mode: string, name: string, content: string): void {
  if (!content.trim()) return;
  const key = historyKey(mode, name);
  const entries = parseEntries(localStorage.getItem(key));
  // 동일한 내용은 중복 저장하지 않음
  if (entries[0]?.content === content) return;
  entries.unshift({ content, date: new Date().toISOString() });
  if (entries.length > MAX_HISTORY) entries.length = MAX_HISTORY;
  safeSetItem(key, JSON.stringify(entries));
  pruneHistoryKeys(key);
}

export function getHistory(mode: string, name: string): HistoryEntry[] {
  return parseEntries(localStorage.getItem(historyKey(mode, name)));
}

// 학생기록/문서 생성 결과 화면(GeneratedDisplay.tsx)이 버전별 결과를 저장할 때 쓰는 접두사.
// 여기서 export해 GeneratedDisplay.tsx와 삭제 로직(clearDocumentHistory)이 같은 값을 쓰도록 한다.
export const DOCUMENT_HISTORY_KEY_PREFIX = 'edunote_generated_document_history_v1_';

function clearKeysByPrefix(prefix: string): void {
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(prefix)) toRemove.push(k);
  }
  toRemove.forEach(k => localStorage.removeItem(k));
}

// 학생별 생성 이력(eduHist_*)을 전부 지운다. 설정 화면의 "학생 데이터 전체 삭제"에서 사용.
export function clearAllHistory(): void {
  clearKeysByPrefix(KEY_PREFIX);
}

// 문서 생성 결과 이력(문서작성기·상담일지 등)을 전부 지운다.
export function clearDocumentHistory(): void {
  clearKeysByPrefix(DOCUMENT_HISTORY_KEY_PREFIX);
}

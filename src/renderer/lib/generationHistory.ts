// 학생별 생성 히스토리 관리 (localStorage, 최대 3개)
import { safeSetItem } from './safeStorage';

const MAX_HISTORY = 3;

export interface HistoryEntry {
  content: string;
  date: string; // ISO 문자열
}

function historyKey(mode: string, name: string): string {
  return `eduHist_${mode}_${name}`;
}

export function saveHistory(mode: string, name: string, content: string): void {
  if (!content.trim()) return;
  const key = historyKey(mode, name);
  let entries: HistoryEntry[] = [];
  try {
    entries = JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    entries = [];
  }
  // 동일한 내용은 중복 저장하지 않음
  if (entries[0]?.content === content) return;
  entries.unshift({ content, date: new Date().toISOString() });
  if (entries.length > MAX_HISTORY) entries.length = MAX_HISTORY;
  safeSetItem(key, JSON.stringify(entries));
}

export function getHistory(mode: string, name: string): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(historyKey(mode, name)) || '[]');
  } catch {
    return [];
  }
}

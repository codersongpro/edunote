// 학생 카드 — 한 학생의 생기부 도우미 이력·메모를 한 화면에 모아 보여준다.
// AI 호출이 전혀 없고, 기존에 저장된 데이터(eduHist_*, student-memos)만 재사용한다.

import { getHistory, HistoryEntry } from './generationHistory';
import { memoStudents, normalizeName, StudentMemoRecord } from './generationSafety';

export type RecordMode = 'opinion' | 'subject' | 'sports' | 'creative';

export const RECORD_MODES: RecordMode[] = ['opinion', 'subject', 'sports', 'creative'];

export const RECORD_MODE_LABELS: Record<RecordMode, string> = {
  opinion: '행동특성 및 종합의견',
  subject: '교과 세부능력 및 특기사항',
  sports: '학교스포츠클럽',
  creative: '창의적 체험활동',
};

export interface StudentCardEntry {
  kind: RecordMode | 'memo';
  label: string;
  content: string;
  date: string;
}

async function loadMemoEntries(identifier: string): Promise<StudentCardEntry[]> {
  const target = normalizeName(identifier);
  let memoData: unknown;
  try {
    memoData = await window.electronAPI.readJsonData('student-memos');
  } catch {
    return [];
  }
  if (!Array.isArray(memoData)) return [];

  return (memoData as StudentMemoRecord[])
    .filter(memo => memoStudents(memo).some(name => name === target))
    .map(memo => {
      const title = memo.title?.trim();
      const content = memo.content?.trim();
      const timestamp = memo.updatedAt || memo.createdAt || 0;
      return {
        kind: 'memo' as const,
        label: '학생 메모',
        content: [title, content].filter(Boolean).join(': '),
        date: new Date(timestamp).toISOString(),
      };
    })
    .filter(entry => entry.content.length > 0);
}

function historyEntriesFor(mode: RecordMode, identifier: string): StudentCardEntry[] {
  return getHistory(mode, identifier).map((entry: HistoryEntry) => ({
    kind: mode,
    label: RECORD_MODE_LABELS[mode],
    content: entry.content,
    date: entry.date,
  }));
}

export async function loadStudentCard(identifier: string): Promise<StudentCardEntry[]> {
  const clean = identifier.trim();
  if (!clean) return [];

  const historyEntries = RECORD_MODES.flatMap(mode => historyEntriesFor(mode, clean));
  const memoEntries = await loadMemoEntries(clean);

  return [...historyEntries, ...memoEntries].sort(
    (a, b) => Date.parse(b.date) - Date.parse(a.date),
  );
}

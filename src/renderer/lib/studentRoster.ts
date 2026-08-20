// 학생 번호-이름 명렬표 — 로컬에만 저장되며 AI 생성 요청에는 전혀 포함되지 않는다.
// 생기부 도우미 화면에 번호/별명을 입력했을 때, 교사 본인이 확인할 수 있도록
// 화면에만(로컬) 실명 힌트를 보여주는 용도로 쓰인다.

export interface RosterEntry {
  number: string;
  name: string;
}

export const STUDENT_ROSTER_DATA_KEY = 'student-roster';

export function parseRosterInput(raw: string): RosterEntry[] {
  return raw
    .split('\n')
    .map(line => {
      const [numberPart, ...rest] = line.split(',');
      const number = (numberPart || '').trim();
      const name = rest.join(',').trim();
      return { number, name };
    })
    .filter(entry => entry.number.length > 0 && entry.name.length > 0);
}

export function formatRosterForEdit(entries: RosterEntry[]): string {
  return entries.map(entry => `${entry.number},${entry.name}`).join('\n');
}

// "12번" 같은 접미사를 허용해 생성기 화면에 입력한 값과 그대로 대조할 수 있게 한다.
export function findRosterMatch(entries: RosterEntry[], identifier: string): RosterEntry | null {
  const clean = identifier.trim().replace(/번$/, '');
  if (!clean) return null;
  return entries.find(entry => entry.number === clean) ?? null;
}

function isValidEntry(value: unknown): value is RosterEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.number === 'string' && typeof entry.name === 'string';
}

export async function loadStudentRoster(): Promise<RosterEntry[]> {
  try {
    const raw = await window.electronAPI.readJsonData(STUDENT_ROSTER_DATA_KEY);
    return Array.isArray(raw) ? raw.filter(isValidEntry) : [];
  } catch {
    return [];
  }
}

export async function saveStudentRoster(entries: RosterEntry[]): Promise<void> {
  await window.electronAPI.writeJsonData(STUDENT_ROSTER_DATA_KEY, entries);
}

export async function clearStudentRoster(): Promise<void> {
  await window.electronAPI.writeJsonData(STUDENT_ROSTER_DATA_KEY, []);
}

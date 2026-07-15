export interface StudentMemoRecord {
  studentName?: string;
  studentNames?: string[];
  title?: string;
  content?: string;
  updatedAt?: number;
  createdAt?: number;
}

export interface StudentGenerationExtras {
  privacyModeEnabled?: boolean;
  studentMemos?: string[];
}

function normalizeName(name: string): string {
  return name.replace(/^\d+[.\s)]+/, '').trim();
}

function memoStudents(memo: StudentMemoRecord): string[] {
  if (Array.isArray(memo.studentNames) && memo.studentNames.length > 0) {
    return memo.studentNames.map(normalizeName).filter(Boolean);
  }
  return memo.studentName ? memo.studentName.split(/[,;\n]+/).map(normalizeName).filter(Boolean) : [];
}

export async function getStudentGenerationExtras(studentName: string): Promise<StudentGenerationExtras> {
  const [privacyMode, memoData] = await Promise.all([
    window.electronAPI.getConfig('privacyModeEnabled').catch(() => true),
    window.electronAPI.readJsonData('student-memos').catch(() => null),
  ]);
  const target = normalizeName(studentName);
  const memos = Array.isArray(memoData)
    ? (memoData as StudentMemoRecord[])
        .filter(memo => memoStudents(memo).some(name => name === target))
        .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
        .slice(0, 5)
        .map((memo) => {
          const title = memo.title?.trim();
          const content = memo.content?.trim();
          return [title, content].filter(Boolean).join(': ');
        })
        .filter(Boolean)
    : [];

  return {
    privacyModeEnabled: privacyMode !== false,
    studentMemos: memos,
  };
}

export function formatStudentMemos(memos?: string[]): string {
  if (!memos || memos.length === 0) return '';
  return `\n[학생 메모 참고자료]\n${memos.map((memo, index) => `${index + 1}. ${memo}`).join('\n')}\n`;
}

// 본문에 이미 등장하지 않는 토큰을 고른다. includes('학생1') 검사는 '학생10'도 함께 걸러
// 복원 시 기존 문자열을 잘못 되돌리는 부분 겹침을 보수적으로 막는다.
export function pickUnusedToken(text: string, used: Set<string> = new Set()): string {
  for (let i = 1; i <= 99; i++) {
    const candidate = `학생${i}`;
    if (!used.has(candidate) && !text.includes(candidate)) return candidate;
  }
  return '학생0';
}

export function withStudentPrivacy(
  prompt: string,
  studentName: string,
  enabled?: boolean,
): { prompt: string; restore: (text: string) => string } {
  const cleanName = normalizeName(studentName);
  if (!enabled || !cleanName) return { prompt, restore: text => text };
  const token = pickUnusedToken(prompt);
  const escaped = cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const namePattern = new RegExp(escaped, 'g');
  return {
    prompt: prompt.replace(namePattern, token),
    restore: text => text.replace(new RegExp(token, 'g'), cleanName),
  };
}

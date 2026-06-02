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

export function withStudentPrivacy(
  prompt: string,
  studentName: string,
  enabled?: boolean,
): { prompt: string; restore: (text: string) => string } {
  const cleanName = normalizeName(studentName);
  if (!enabled || !cleanName) return { prompt, restore: text => text };
  const token = '학생1';
  const escaped = cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const namePattern = new RegExp(escaped, 'g');
  return {
    prompt: prompt.replace(namePattern, token),
    restore: text => text.replace(new RegExp(token, 'g'), cleanName),
  };
}

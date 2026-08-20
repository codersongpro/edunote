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

export function normalizeName(name: string): string {
  return name.replace(/^\d+[.\s)]+/, '').trim();
}

export function memoStudents(memo: StudentMemoRecord): string[] {
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
): { prompt: string; restore: (text: string) => string; applied: boolean } {
  const cleanName = normalizeName(studentName);
  if (!enabled || !cleanName) return { prompt, restore: text => text, applied: false };
  const token = pickUnusedToken(prompt);
  const escaped = cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const namePattern = new RegExp(escaped, 'g');
  return {
    prompt: prompt.replace(namePattern, token),
    restore: text => text.replace(new RegExp(token, 'g'), cleanName),
    applied: true,
  };
}

// 학생 명단의 여러 이름을 본문에서 각각 고유 토큰으로 치환한다.
// 자유 서술형 입력(수업관찰·학급경영일지 등)처럼 학생명 필드가 따로 없는 경우에 사용.
export function withStudentListPrivacy(
  prompt: string,
  studentNames: string[],
  enabled?: boolean,
): { prompt: string; restore: (text: string) => string; applied: boolean } {
  if (!enabled) return { prompt, restore: text => text, applied: false };
  const names = Array.from(new Set(studentNames.map(normalizeName)))
    // 한 글자 이름은 일반 단어와 겹칠 위험이 커서 제외하고, 토큰 형태의 이름도 제외한다
    .filter(name => name.length >= 2 && !/^학생\d*$/.test(name) && prompt.includes(name))
    // 긴 이름부터 치환해 "김민수"가 "김민"보다 먼저 처리되도록 한다
    .sort((a, b) => b.length - a.length);
  if (names.length === 0) return { prompt, restore: text => text, applied: false };
  const used = new Set<string>();
  const pairs = names.map((name): [name: string, token: string] => {
    const token = pickUnusedToken(prompt, used);
    used.add(token);
    return [name, token];
  });
  let masked = prompt;
  for (const [name, token] of pairs) masked = masked.split(name).join(token);
  return {
    prompt: masked,
    restore: text =>
      // 긴 토큰("학생10")을 짧은 토큰("학생1")보다 먼저 복원한다
      [...pairs]
        .sort((a, b) => b[1].length - a[1].length)
        .reduce((acc, [name, token]) => acc.split(token).join(name), text),
    applied: true,
  };
}

// 설정에 저장된 학생 명단(전체·남·여)과 개인정보 보호 모드 값을 함께 읽어온다.
export async function getRosterGenerationExtras(): Promise<{
  privacyModeEnabled: boolean;
  rosterNames: string[];
}> {
  const [privacyMode, allNames, maleNames, femaleNames] = await Promise.all([
    window.electronAPI.getConfig('privacyModeEnabled').catch(() => true),
    window.electronAPI.getConfig('studentNames').catch(() => ''),
    window.electronAPI.getConfig('studentMaleNames').catch(() => ''),
    window.electronAPI.getConfig('studentFemaleNames').catch(() => ''),
  ]);
  const rosterNames = [allNames, maleNames, femaleNames]
    .flatMap(value => (typeof value === 'string' ? value.split(/[\n,]+/) : []))
    .map(normalizeName)
    .filter(Boolean);
  return { privacyModeEnabled: privacyMode !== false, rosterNames };
}

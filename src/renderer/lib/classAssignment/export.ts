import { classLabel } from './criteria';
import { computeClassStats } from './metrics';
import { EXAMPLE_NAME_PREFIX, TEMPLATE_COLUMNS } from './parse';
import { writeXlsx, type Cell, type SheetSpec } from './xlsx';
import type { Assignment, AssignmentConfig, ClassStudent, ComplianceItem, Scenario } from './types';

// 엑셀 내보내기 — 양식(예시 3명 포함) / 편성 결과

const ex = (name: string) => `${EXAMPLE_NAME_PREFIX}${name}`;

/**
 * 양식의 예시 3명 — 열마다 어떤 값을 쓰는지 보여 준다(TEMPLATE_COLUMNS 순서).
 * 이름이 '(예시)'로 시작하므로 지우지 않고 올려도 편성에서 자동으로 빠진다.
 */
export const TEMPLATE_EXAMPLE_ROWS: Cell[][] = [
  [1, 1, ex('김하늘'), '여', 3, 92, 94, 90, 0, '', '', ex('박바다'), '', '', '', '', '학급 회장, 박바다와 분리 요청'],
  [1, 2, ex('박바다'), '남', 18, 61, 58, 64, 2, 'O', '', '', `${ex('이솔')}(2-5)`, '', '', '', '기초학력 지원, 이솔과 같은 반 희망'],
  [2, 5, ex('이솔'), '남', 7, 85, 82, 88, 1, '', 'O', '', '', '', '나', '가', '특수교육대상, 나반 고정·가반 제외'],
];

export async function buildTemplateWorkbook(): Promise<ArrayBuffer> {
  const header = TEMPLATE_COLUMNS.map(c => c.header);
  const guide: Cell[][] = [
    ['반편성 명단 작성 방법'],
    [],
    ['열', '작성 방법'],
    ...TEMPLATE_COLUMNS.map(c => [c.header, c.note] as Cell[]),
    [],
    ['· 한 학년 전체를 한 시트에 적거나, 전학년 반별로 시트를 나눠도 됩니다(머리글은 각 시트 첫 줄).'],
    ['· 분리요청·같은반희망·쌍생아는 상대 학생 이름을 적습니다. 동명이인이 있으면 홍길동(3-12)처럼 전학년반-번호를 함께 적으세요.'],
    [`· 명단 시트의 예시 3명(이름이 '${EXAMPLE_NAME_PREFIX}'로 시작)은 지워도 되고, 그대로 두어도 편성에서 자동으로 빠집니다.`],
    ['· 이 파일에는 학생 개인정보가 들어갑니다. 작업이 끝나면 안전하게 보관하거나 삭제하세요.'],
  ];
  return writeXlsx([
    { name: '명단', rows: [header, ...TEMPLATE_EXAMPLE_ROWS], headerRows: [0], freezeHeader: true, colWidths: header.map((h, i) => (i === 2 ? 14 : i === header.length - 1 ? 34 : Math.max(10, h.length * 2 + 2))) },
    { name: '작성방법', rows: guide, titleRows: [0], headerRows: [2], colWidths: [18, 70] },
  ]);
}

const sortByName = (a: ClassStudent, b: ClassStudent) => a.name.localeCompare(b.name, 'ko');

export function studentRow(s: ClassStudent, assigned: number | undefined, config: AssignmentConfig): Cell[] {
  return [
    assigned ? classLabel(assigned, config.labelStyle) : '',
    s.prevClass, s.prevNumber, s.name, s.gender, s.rank, s.average, s.korean, s.math, s.behavior,
    s.basicAcademic ? 'O' : '', s.specialNeeds ? 'O' : '', s.separationRaw, s.togetherRaw, s.twinsRaw,
    s.fixedClass ? classLabel(s.fixedClass, config.labelStyle) : '',
    s.excludedClasses.map(c => classLabel(c, config.labelStyle)).join(','), s.notes,
  ];
}

export async function buildResultWorkbook(
  students: ClassStudent[], assignment: Assignment, config: AssignmentConfig, scenario: Scenario | null,
  compliance: ComplianceItem[], extraColumns: string[] = [],
): Promise<ArrayBuffer> {
  const L = (c: number) => classLabel(c, config.labelStyle);
  const stats = computeClassStats(students, assignment, config);
  const pct = config.academicBasis === 'rank';
  const acad = (v: number | null) => (v === null ? '' : pct ? `상위 ${Math.round((1 - v) * 100)}%` : Math.round(v * 10) / 10);

  const report: Cell[][] = [
    ['반편성 결과 리포트'],
    ['편성안', scenario?.name ?? '직접 조정안', '', '출력일시', new Date().toLocaleString('ko-KR')],
    ['재현 시드', scenario?.report.seed ?? '', '', '전체 학생', students.length],
    [],
    ['반', '인원', '남', '여', pct ? '학업(석차 평균)' : '평균성적', '생활지도 합', '생활지도 2점+', '기초학력', '특수교육'],
    ...stats.map(s => [L(s.classNo), s.count, s.male, s.female, acad(s.academic), s.behaviorSum, s.behaviorHigh, s.basic, s.special] as Cell[]),
    [],
    ['기준', '구분', '결과', '점수', '요약'],
    ...compliance.map(c => [c.label, c.hard ? '필수' : '균형', c.status === 'pass' ? '충족' : c.status === 'warn' ? '양호' : '조정 필요', c.score, c.summary] as Cell[]),
  ];
  const statHeader = 4;
  const compHeader = statHeader + stats.length + 2;
  const specs: SheetSpec[] = [
    { name: '결과리포트', rows: report, titleRows: [0], headerRows: [statHeader, compHeader], colWidths: [26, 18, 14, 14, 18, 14, 14, 12, 12] },
  ];

  for (const st of stats) {
    const list = students.filter(s => assignment[s.id] === st.classNo).sort(sortByName);
    const rows: Cell[][] = [['번호', '이름', '성별', '전학년반', '전학년번호', '생활지도', '기초학력', '특수교육', '특이사항']];
    list.forEach((s, i) => rows.push([i + 1, s.name, s.gender, s.prevClass, s.prevNumber, s.behavior, s.basicAcademic ? 'O' : '', s.specialNeeds ? 'O' : '', s.notes]));
    specs.push({ name: L(st.classNo), rows, headerRows: [0], freezeHeader: true, colWidths: [6, 12, 6, 9, 10, 9, 9, 9, 30] });
  }

  const allHeader: Cell[] = ['배정반', ...TEMPLATE_COLUMNS.map(c => c.header), ...extraColumns];
  const allRows: Cell[][] = [allHeader];
  [...students]
    .sort((a, b) => (assignment[a.id] ?? 0) - (assignment[b.id] ?? 0) || sortByName(a, b))
    .forEach(s => {
      const base = studentRow(s, assignment[s.id], config);
      allRows.push([...base, ...extraColumns.map(col => (s.extra[col] ?? '') as Cell)]);
    });
  specs.push({ name: '전체명단', rows: allRows, headerRows: [0], freezeHeader: true });

  const prevList = [...new Set(students.map(s => s.prevClass))].sort((a, b) => a - b);
  const matrix: Cell[][] = [['전학년반 \\ 배정반', ...stats.map(s => L(s.classNo)), '합계']];
  for (const p of prevList) {
    const row: Cell[] = [`${p}반`];
    let sum = 0;
    for (const st of stats) { const n = st.prevCounts[p] ?? 0; row.push(n); sum += n; }
    row.push(sum);
    matrix.push(row);
  }
  specs.push({ name: '이동표', rows: matrix, headerRows: [0], colWidths: [18, ...stats.map(() => 8), 8] });
  return writeXlsx(specs);
}

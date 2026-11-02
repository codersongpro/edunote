import { classLabel, criterionLabel } from './criteria';
import type {
  Assignment, AssignmentConfig, CheckStatus, ClassStudent, ComplianceItem, ResolvedRelations, SoftCriterionId,
} from './types';

// 반편성 지표 — 엔진(최적화)과 화면(충족도)이 같은 정의를 쓰도록 한곳에 모은다.
// (원본 앱은 최적화는 전체석차, 평가는 반 내 석차 평균으로 서로 다른 값을 봤다)

export type MetricKind = 'mean' | 'count' | 'sum';

export interface MetricValues {
  id: SoftCriterionId;
  kind: MetricKind;
  /** 학생별 값(NaN = 자료 없음) */
  values: Float64Array;
}

export const HIGH_BEHAVIOR = 2;

/** 석차 → 반 규모와 무관한 백분위 점수(1에 가까울수록 상위) */
export function academicValues(students: ClassStudent[], basis: AssignmentConfig['academicBasis']): Float64Array {
  const out = new Float64Array(students.length).fill(NaN);
  if (basis === 'rank') {
    const maxRank = new Map<number, number>();
    for (const s of students) {
      if (s.rank !== null && s.rank > 0) maxRank.set(s.prevClass, Math.max(maxRank.get(s.prevClass) ?? 0, s.rank));
    }
    const sizeOf = new Map<number, number>();
    for (const s of students) sizeOf.set(s.prevClass, (sizeOf.get(s.prevClass) ?? 0) + 1);
    students.forEach((s, i) => {
      if (s.rank === null || s.rank <= 0) return;
      const size = Math.max(sizeOf.get(s.prevClass) ?? 1, maxRank.get(s.prevClass) ?? 1);
      out[i] = 1 - (s.rank - 0.5) / size;
    });
    return out;
  }
  students.forEach((s, i) => {
    if (s.average !== null) out[i] = s.average;
    else if (s.korean !== null && s.math !== null) out[i] = (s.korean + s.math) / 2;
    else if (s.korean !== null) out[i] = s.korean;
    else if (s.math !== null) out[i] = s.math;
  });
  return out;
}

export function metricValues(id: SoftCriterionId, students: ClassStudent[], config: AssignmentConfig): MetricValues | null {
  const n = students.length;
  const fill = (fn: (s: ClassStudent) => number) => Float64Array.from(students, fn);
  switch (id) {
    case 'gender': return { id, kind: 'count', values: fill(s => (s.gender === '남' ? 1 : s.gender === '여' ? 0 : NaN)) };
    case 'behavior': return { id, kind: 'sum', values: fill(s => s.behavior) };
    case 'behaviorHigh': return { id, kind: 'count', values: fill(s => (s.behavior >= HIGH_BEHAVIOR ? 1 : 0)) };
    case 'basic': return { id, kind: 'count', values: fill(s => (s.basicAcademic ? 1 : 0)) };
    case 'special': return { id, kind: 'count', values: fill(s => (s.specialNeeds ? 1 : 0)) };
    case 'academic': return { id, kind: 'mean', values: academicValues(students, config.academicBasis) };
    case 'korean': return { id, kind: 'mean', values: fill(s => s.korean ?? NaN) };
    case 'math': return { id, kind: 'mean', values: fill(s => s.math ?? NaN) };
    case 'isolation':
    case 'prevSpread':
      return null; // 전학년 반 분포 기반 — 엔진이 별도로 계산
    default: {
      if (!id.startsWith('extra:')) return null;
      const col = id.slice(6);
      const v = fill(s => (typeof s.extra[col] === 'number' ? (s.extra[col] as number) : NaN));
      return n > 0 ? { id, kind: 'mean', values: v } : null;
    }
  }
}

/** 전학년 반마다 "외톨이 방지" 최소 인원(몫) */
export function isolationThresholds(students: ClassStudent[], numClasses: number): Map<number, number> {
  const totals = new Map<number, number>();
  for (const s of students) totals.set(s.prevClass, (totals.get(s.prevClass) ?? 0) + 1);
  const out = new Map<number, number>();
  for (const [pc, t] of totals) out.set(pc, Math.floor(t / numClasses));
  return out;
}

export interface ClassStat {
  classNo: number;
  count: number;
  male: number;
  female: number;
  /** 석차 기준이면 0~1 백분위, 점수 기준이면 평균 점수(자료 없으면 null) */
  academic: number | null;
  korean: number | null;
  math: number | null;
  behaviorSum: number;
  behaviorHigh: number;
  basic: number;
  special: number;
  prevCounts: Record<number, number>;
}

export function computeClassStats(students: ClassStudent[], assignment: Assignment, config: AssignmentConfig): ClassStat[] {
  const acad = academicValues(students, config.academicBasis);
  const stats: ClassStat[] = Array.from({ length: config.numClasses }, (_, i) => ({
    classNo: i + 1, count: 0, male: 0, female: 0, academic: null, korean: null, math: null,
    behaviorSum: 0, behaviorHigh: 0, basic: 0, special: 0, prevCounts: {},
  }));
  const acc = stats.map(() => ({ a: 0, an: 0, k: 0, kn: 0, m: 0, mn: 0 }));
  students.forEach((s, i) => {
    const c = assignment[s.id];
    if (!c || c < 1 || c > config.numClasses) return;
    const st = stats[c - 1];
    const ac = acc[c - 1];
    st.count++;
    if (s.gender === '남') st.male++;
    else if (s.gender === '여') st.female++;
    if (!Number.isNaN(acad[i])) { ac.a += acad[i]; ac.an++; }
    if (s.korean !== null) { ac.k += s.korean; ac.kn++; }
    if (s.math !== null) { ac.m += s.math; ac.mn++; }
    st.behaviorSum += s.behavior;
    if (s.behavior >= HIGH_BEHAVIOR) st.behaviorHigh++;
    if (s.basicAcademic) st.basic++;
    if (s.specialNeeds) st.special++;
    st.prevCounts[s.prevClass] = (st.prevCounts[s.prevClass] ?? 0) + 1;
  });
  stats.forEach((st, i) => {
    const ac = acc[i];
    st.academic = ac.an ? ac.a / ac.an : null;
    st.korean = ac.kn ? ac.k / ac.kn : null;
    st.math = ac.mn ? ac.m / ac.mn : null;
  });
  return stats;
}

const range = (xs: number[]) => (xs.length ? Math.max(...xs) - Math.min(...xs) : 0);
const fmt = (x: number, d = 1) => (Math.round(x * 10 ** d) / 10 ** d).toString();
const statusByRange = (r: number, pass: number, warn: number): CheckStatus => (r <= pass ? 'pass' : r <= warn ? 'warn' : 'fail');
const scoreByRange = (r: number, pass: number, warn: number) =>
  r <= pass ? 100 : Math.max(0, Math.round(100 - ((r - pass) / Math.max(warn - pass, 1e-9)) * 30));

function std(values: Float64Array): number {
  let n = 0, s = 0, ss = 0;
  for (const v of values) if (!Number.isNaN(v)) { n++; s += v; ss += v * v; }
  if (n < 2) return 0;
  const m = s / n;
  return Math.sqrt(Math.max(0, ss / n - m * m));
}

export function hardViolations(students: ClassStudent[], assignment: Assignment, relations: ResolvedRelations, config: AssignmentConfig) {
  const nameOf = new Map(students.map(s => [s.id, s.name]));
  const separation = relations.separationPairs
    .filter(([a, b]) => assignment[a] && assignment[a] === assignment[b])
    .map(([a, b]) => `${nameOf.get(a)}–${nameOf.get(b)} 같은 반(${classLabel(assignment[a], config.labelStyle)})`);
  const together = relations.togetherGroups
    .filter(g => new Set(g.map(id => assignment[id])).size > 1)
    .map(g => `${g.map(id => nameOf.get(id)).join('·')} 서로 다른 반`);
  const fixed: string[] = [];
  const excluded: string[] = [];
  for (const s of students) {
    const c = assignment[s.id];
    if (s.fixedClass && s.fixedClass <= config.numClasses && c !== s.fixedClass) {
      fixed.push(`${s.name}: 고정반 ${classLabel(s.fixedClass, config.labelStyle)}이 아님`);
    }
    if (c && s.excludedClasses.includes(c)) excluded.push(`${s.name}: 제외반 ${classLabel(c, config.labelStyle)}에 배정됨`);
  }
  return { separation, together, fixed, excluded };
}

/** 충족도 — 필수 조건 + 활성화된 균형 기준 */
export function evaluateCompliance(
  students: ClassStudent[], assignment: Assignment, config: AssignmentConfig, relations: ResolvedRelations,
): ComplianceItem[] {
  const stats = computeClassStats(students, assignment, config);
  const items: ComplianceItem[] = [];
  const L = (c: number) => classLabel(c, config.labelStyle);
  const hard = hardViolations(students, assignment, relations, config);

  const counts = stats.map(s => s.count);
  const countRange = range(counts);
  const hasSpecialWeight = config.specialNeedsWeight > 1 && students.some(s => s.specialNeeds);
  items.push({
    id: 'count', label: '반별 인원 균형', hard: true,
    status: countRange <= 1 ? 'pass' : hasSpecialWeight && countRange <= 1 + Math.ceil(config.specialNeedsWeight - 1) ? 'warn' : 'fail',
    score: countRange <= 1 ? 100 : Math.max(0, 100 - (countRange - 1) * 25),
    summary: `반별 ${Math.min(...counts)}~${Math.max(...counts)}명`,
    issues: countRange > 1 ? stats.map(s => `${L(s.classNo)} ${s.count}명${s.special ? ` (특수 ${s.special})` : ''}`) : [],
  });
  const pushHard = (id: string, label: string, list: string[], total: number) => {
    if (total === 0) return;
    items.push({
      id, label, hard: true, status: list.length ? 'fail' : 'pass',
      score: list.length ? Math.max(0, Math.round(100 - (list.length / total) * 100)) : 100,
      summary: list.length ? `${list.length}건 미충족 / ${total}건` : `${total}건 모두 충족`,
      issues: list,
    });
  };
  pushHard('separation', '분리 요청', hard.separation, relations.separationPairs.length);
  pushHard('together', config.twinsMode === 'together' ? '같은 반 배정(희망·쌍생아)' : '같은 반 희망', hard.together, relations.togetherGroups.length);
  pushHard('fixed', '고정 배정', hard.fixed, students.filter(s => s.fixedClass && s.fixedClass <= config.numClasses).length);
  pushHard('excluded', '제외 반', hard.excluded, students.filter(s => s.excludedClasses.length).length);

  const isoThr = isolationThresholds(students, config.numClasses);
  for (const crit of config.criteria) {
    if (!crit.active) continue;
    const label = criterionLabel(crit.id);
    if (crit.id === 'gender') {
      const rm = range(stats.map(s => s.male));
      const rf = range(stats.map(s => s.female));
      const r = Math.max(rm, rf);
      items.push({
        id: crit.id, label, hard: false, status: statusByRange(r, 1, 2), score: scoreByRange(r, 1, 3),
        summary: `남 ${Math.min(...stats.map(s => s.male))}~${Math.max(...stats.map(s => s.male))}명 · 여 ${Math.min(...stats.map(s => s.female))}~${Math.max(...stats.map(s => s.female))}명`,
        issues: r > 1 ? stats.map(s => `${L(s.classNo)} 남${s.male}/여${s.female}`) : [],
      });
    } else if (crit.id === 'isolation') {
      const issues: string[] = [];
      for (const st of stats) {
        for (const [pc, cnt] of Object.entries(st.prevCounts)) {
          const thr = isoThr.get(Number(pc)) ?? 0;
          if (thr > 0 && cnt > 0 && cnt < thr) issues.push(`${L(st.classNo)}: 전학년 ${pc}반 출신 ${cnt}명 (최소 ${thr}명)`);
        }
      }
      items.push({
        id: crit.id, label, hard: false, status: issues.length === 0 ? 'pass' : issues.length <= 2 ? 'warn' : 'fail',
        score: Math.max(0, 100 - issues.length * 10),
        summary: issues.length ? `${issues.length}곳에서 몫 미만` : '모든 반에서 몫 이상',
        issues,
      });
    } else if (crit.id === 'prevSpread') {
      const totals = new Map<number, number>();
      for (const s of students) totals.set(s.prevClass, (totals.get(s.prevClass) ?? 0) + 1);
      let worst = 0;
      const issues: string[] = [];
      for (const st of stats) {
        for (const [pc, t] of totals) {
          const exp = (t * st.count) / Math.max(students.length, 1);
          const dev = (st.prevCounts[pc] ?? 0) - exp;
          worst = Math.max(worst, Math.abs(dev));
          if (dev > 2) issues.push(`${L(st.classNo)}: 전학년 ${pc}반 출신 ${st.prevCounts[pc]}명 (평균 ${fmt(exp)}명)`);
        }
      }
      items.push({
        id: crit.id, label, hard: false, status: statusByRange(worst, 1.5, 2.5), score: scoreByRange(worst, 1.5, 3.5),
        summary: `평균 대비 최대 ±${fmt(worst)}명`, issues,
      });
    } else if (crit.id === 'behavior') {
      const sums = stats.map(s => s.behaviorSum);
      const avg = sums.reduce((a, b) => a + b, 0) / Math.max(sums.length, 1);
      const r = range(sums);
      const pass = Math.max(2, Math.ceil(avg * 0.15));
      items.push({
        id: crit.id, label, hard: false, status: statusByRange(r, pass, pass * 2), score: scoreByRange(r, pass, pass * 3),
        summary: `반별 합계 ${Math.min(...sums)}~${Math.max(...sums)}점`,
        issues: r > pass ? stats.map(s => `${L(s.classNo)} ${s.behaviorSum}점`) : [],
      });
    } else if (crit.id === 'behaviorHigh' || crit.id === 'basic' || crit.id === 'special') {
      const key = crit.id === 'behaviorHigh' ? 'behaviorHigh' : crit.id;
      const vals = stats.map(s => s[key]);
      if (vals.every(v => v === 0)) continue;
      const r = range(vals);
      items.push({
        id: crit.id, label, hard: false, status: statusByRange(r, 1, 2), score: scoreByRange(r, 1, 3),
        summary: `반별 ${Math.min(...vals)}~${Math.max(...vals)}명`,
        issues: r > 1 ? stats.map(s => `${L(s.classNo)} ${s[key]}명`) : [],
      });
    } else {
      const mv = metricValues(crit.id, students, config);
      if (!mv) continue;
      const sd = std(mv.values);
      const perClass = new Array(config.numClasses).fill(0).map(() => ({ s: 0, n: 0 }));
      students.forEach((st, i) => {
        const c = assignment[st.id];
        const v = mv.values[i];
        if (c && !Number.isNaN(v)) { perClass[c - 1].s += v; perClass[c - 1].n++; }
      });
      const means = perClass.filter(p => p.n > 0).map(p => p.s / p.n);
      if (sd === 0 || means.length === 0) {
        items.push({ id: crit.id, label, hard: false, status: 'pass', score: 100, summary: '비교할 자료 없음', issues: [] });
        continue;
      }
      const r = range(means);
      const isPercentile = crit.id === 'academic' && config.academicBasis === 'rank';
      const show = (x: number) => (isPercentile ? `상위 ${fmt((1 - x) * 100, 0)}%` : fmt(x));
      items.push({
        id: crit.id, label, hard: false,
        status: statusByRange(r, sd * 0.25, sd * 0.5), score: scoreByRange(r, sd * 0.25, sd * 0.75),
        summary: isPercentile
          ? `반 평균 ${show(Math.max(...means))} ~ ${show(Math.min(...means))}`
          : `반 평균 ${show(Math.min(...means))} ~ ${show(Math.max(...means))}`,
        issues: r > sd * 0.25 ? perClass.map((p, i) => `${L(i + 1)} ${p.n ? show(p.s / p.n) : '-'}`) : [],
      });
    }
  }
  return items;
}

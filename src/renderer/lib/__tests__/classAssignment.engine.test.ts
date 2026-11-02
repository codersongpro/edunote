import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../classAssignment/criteria';
import { generateScenarios, optimize, pairSimilarity, suggestSwaps } from '../classAssignment/engine';
import { computeClassStats, evaluateCompliance } from '../classAssignment/metrics';
import { resolveRelations } from '../classAssignment/relations';
import type { Assignment, AssignmentConfig, ClassStudent } from '../classAssignment/types';
import { makeCohort, student } from './classAssignment.fixtures';

const run = (students: ClassStudent[], config: AssignmentConfig, extra: { locks?: Assignment; seed?: number } = {}) => {
  const relations = resolveRelations(students, config.twinsMode);
  const r = optimize(students, config, relations, { seed: extra.seed ?? config.seed, locks: extra.locks });
  return { ...r, relations, compliance: evaluateCompliance(students, r.assignment, config, relations) };
};
const byId = (items: ReturnType<typeof evaluateCompliance>, id: string) => items.find(i => i.id === id);

describe('반편성 엔진 — 필수 조건', () => {
  it('120명 4반: 인원 ±1, 분리요청·쌍생아 동반 모두 충족', () => {
    const students = makeCohort(120, 4, 1, { separations: 12, twins: 3 });
    const cfg = defaultConfig(4);
    const { compliance, report } = run(students, cfg);
    expect(report.hardViolations).toBe(0);
    expect(byId(compliance, 'count')?.status).toBe('pass');
    expect(byId(compliance, 'separation')?.score).toBe(100);
    expect(byId(compliance, 'together')?.score).toBe(100);
  });

  it('남·여 나머지가 한 반에 몰리지 않는다(원본 ㄹ자 배정 결함)', () => {
    // 남 61, 여 61, 4반 → 원본은 1반 32명
    const students = Array.from({ length: 122 }, (_, i) => student({ prevClass: (i % 4) + 1, prevNumber: Math.floor(i / 4) + 1, name: `학생${i}`, gender: i < 61 ? '남' : '여', rank: (i % 30) + 1 }));
    const { assignment } = run(students, defaultConfig(4));
    const counts = computeClassStats(students, assignment, defaultConfig(4)).map(s => s.count);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it('쌍생아 분리 모드에서는 다른 반에 배정', () => {
    const students = makeCohort(90, 3, 2, { twins: 4 });
    const cfg: AssignmentConfig = { ...defaultConfig(3), twinsMode: 'separate' };
    const { compliance, relations } = run(students, cfg);
    expect(relations.separationPairs.length).toBe(4);
    expect(byId(compliance, 'separation')?.score).toBe(100);
  });

  it('고정반·제외반·화면 고정을 지킨다', () => {
    const students = makeCohort(100, 4, 3);
    students[0].fixedClass = 2;
    students[1].excludedClasses = [1, 2, 3];
    const locks = { [students[2].id]: 4 };
    const { assignment, compliance } = run(students, defaultConfig(4), { locks });
    expect(assignment[students[0].id]).toBe(2);
    expect(assignment[students[1].id]).toBe(4);
    expect(assignment[students[2].id]).toBe(4);
    expect(byId(compliance, 'fixed')?.score).toBe(100);
    expect(byId(compliance, 'excluded')?.score).toBe(100);
  });

  it('같은반희망 묶음은 한 반에 모인다', () => {
    const students = makeCohort(80, 4, 4);
    students[0].togetherRaw = `${students[5].name},${students[9].name}`;
    const { assignment } = run(students, defaultConfig(4));
    expect(new Set([0, 5, 9].map(i => assignment[students[i].id])).size).toBe(1);
  });

  it('특수교육대상 가중: 특수 학생이 있는 반은 인원이 적다', () => {
    const students = makeCohort(100, 4, 5).map(s => ({ ...s, specialNeeds: false }));
    students[0].specialNeeds = true;
    students[1].specialNeeds = true;
    const cfg = { ...defaultConfig(4), specialNeedsWeight: 2 };
    const { assignment } = run(students, cfg);
    const stats = computeClassStats(students, assignment, cfg);
    const eff = stats.map(s => s.count + s.special);
    expect(Math.max(...eff) - Math.min(...eff)).toBeLessThanOrEqual(1);
    expect(stats.filter(s => s.special > 0).length).toBe(2); // 서로 다른 반
  });
});

describe('반편성 엔진 — 균형 기준', () => {
  it('성비·외톨이 방지·생활지도·학업 수준이 충족된다', () => {
    const students = makeCohort(240, 8, 6, { separations: 10 });
    const { compliance } = run(students, defaultConfig(8));
    for (const id of ['gender', 'isolation', 'prevSpread', 'behavior', 'behaviorHigh', 'academic']) {
      expect(byId(compliance, id)?.status, id).toBe('pass');
    }
  });

  it('무작위 30개 학년 집단에서 필수 조건 위반 0건', () => {
    for (let seed = 100; seed < 130; seed++) {
      const n = 60 + (seed % 7) * 25;
      const C = 2 + (seed % 5);
      const students = makeCohort(n, 3 + (seed % 4), seed, { separations: Math.floor(n / 15), twins: 2 });
      const cfg = { ...defaultConfig(C), seed };
      const relations = resolveRelations(students, cfg.twinsMode);
      const r = optimize(students, cfg, relations, { seed, iterations: 15_000 });
      const c = evaluateCompliance(students, r.assignment, cfg, relations);
      expect(r.report.hardViolations, `seed ${seed}`).toBe(0);
      // 특수교육대상 가중(2명으로 계산) 때문에 실제 인원 차가 2명인 경우는 '양호'로 허용
      expect(byId(c, 'count')?.status, `seed ${seed}`).not.toBe('fail');
    }
  });

  it('석차 기준은 반 규모 차이를 보정한다(25명 반의 5등 ≈ 30명 반의 6등)', () => {
    const students = [
      ...Array.from({ length: 25 }, (_, i) => student({ prevClass: 1, prevNumber: i + 1, name: `가${i}`, rank: i + 1 })),
      ...Array.from({ length: 30 }, (_, i) => student({ prevClass: 2, prevNumber: i + 1, name: `나${i}`, rank: i + 1 })),
    ];
    const cfg = defaultConfig(2);
    const { assignment } = run(students, cfg);
    const stats = computeClassStats(students, assignment, cfg);
    expect(Math.abs((stats[0].academic ?? 0) - (stats[1].academic ?? 0))).toBeLessThan(0.05);
  });
});

describe('반편성 엔진 — 재현성·시나리오', () => {
  it('같은 시드면 같은 결과, 다른 시드면 다른 결과', () => {
    const students = makeCohort(100, 4, 7, { separations: 5 });
    const cfg = defaultConfig(4);
    const a = run(students, cfg, { seed: 42 }).assignment;
    const b = run(students, cfg, { seed: 42 }).assignment;
    const c = run(students, cfg, { seed: 43 }).assignment;
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('3개 안은 서로 실제로 다르다', () => {
    const students = makeCohort(120, 4, 8);
    const cfg = defaultConfig(4);
    const scenarios = generateScenarios(students, cfg, resolveRelations(students, cfg.twinsMode));
    const ids = students.map(s => s.id);
    expect(scenarios).toHaveLength(3);
    expect(pairSimilarity(scenarios[0].assignment, scenarios[1].assignment, ids)).toBeLessThan(0.9);
    expect(pairSimilarity(scenarios[0].assignment, scenarios[2].assignment, ids)).toBeLessThan(0.9);
  });

  it('300명 10반을 3초 안에 처리', () => {
    const students = makeCohort(300, 10, 9, { separations: 20, twins: 3 });
    const cfg = defaultConfig(10);
    const t = Date.now();
    const { report } = run(students, cfg);
    expect(Date.now() - t).toBeLessThan(3000);
    expect(report.hardViolations).toBe(0);
  });
});

describe('개선 제안', () => {
  it('나쁜 배정에서는 벌점을 줄이는 교환을 제안하고, 고정 학생은 제외한다', () => {
    const students = makeCohort(40, 2, 10);
    const cfg = defaultConfig(2);
    const relations = resolveRelations(students, cfg.twinsMode);
    // 남학생을 모두 1반에 몰아넣은 배정
    const bad: Assignment = {};
    const sorted = [...students].sort((a, b) => (a.gender === b.gender ? 0 : a.gender === '남' ? -1 : 1));
    sorted.forEach((s, i) => { bad[s.id] = i < 20 ? 1 : 2; });
    const locked = sorted[0].id;
    const tips = suggestSwaps(students, cfg, relations, bad, { locks: { [locked]: 1 } });
    expect(tips.length).toBeGreaterThan(0);
    expect(tips[0].gain).toBeGreaterThan(0);
    expect(tips.some(t => t.studentA === locked || t.studentB === locked)).toBe(false);
  });
});

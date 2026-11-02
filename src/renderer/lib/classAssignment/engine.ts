import { metricValues, isolationThresholds, type MetricKind } from './metrics';
import { criterionLabel } from './criteria';
import type {
  Assignment, AssignmentConfig, ClassStudent, ResolvedRelations, Scenario, ScenarioReport, SoftCriterionId, SwapSuggestion,
} from './types';

// 반편성 최적화 엔진
// - 원본 앱: 기준별 탐욕 스왑(기준당 최대 ~20회) + 버그로 대부분의 스왑이 거부됨
// - 새 엔진: 하나의 벌점 함수(필수 조건 = 큰 벌점, 균형 기준 = 우선순위 가중치) + 시뮬레이티드 어닐링 + 마무리 국소 탐색
// - 시드 고정 난수 → 같은 입력·같은 시드면 항상 같은 결과(학부모 문의 시 재현 가능)
// - 반 2곳만 다시 계산하는 증분 비용으로 300명도 1초 안팎에 처리

const HARD = 1e4;

/** 「이 기준 다시 다듬기」에서 선택한 기준의 가중치 배율과 반복 수 */
export const REFINE_BOOST = 6;
export const refineIterations = (n: number) => Math.min(60_000, Math.max(10_000, n * 120));

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Metric {
  id: SoftCriterionId;
  kind: MetricKind;
  values: Float64Array; // NaN → 0 처리 + valid 마스크
  valid: Uint8Array;
  weight: number;
  /** mean: 전체 평균, count: 비율 p, sum: 1인 평균 */
  center: number;
  /** 무작위 배정일 때 반별 편차 제곱의 기댓값(정규화용) */
  scale: number;
}

export interface Model {
  n: number;
  C: number;
  ids: string[];
  metrics: Metric[];
  P: number;
  prevIdx: Int32Array;
  prevShare: Float64Array; // t_p / N
  isoThr: Int32Array;
  spreadWeight: number;
  spreadScale: number;
  isoWeight: number;
  special: Uint8Array;
  loadExtra: number; // 특수교육대상 1명당 추가 부담(w-1)
  loadWeight: number;
  effMean: number;
  lo: number;
  hi: number;
  sep: Int32Array[];
  excluded: Uint8Array; // n*C
  units: Int32Array[];
  unitOf: Int32Array;
  unitFixed: Int32Array; // -1 = 이동 가능
  freeUnits: Int32Array;
  freeSingles: Int32Array;
}

export interface BuildOptions {
  locks?: Assignment;
  weightMultipliers?: Partial<Record<string, number>>;
}

export function buildModel(
  students: ClassStudent[], config: AssignmentConfig, relations: ResolvedRelations, opts: BuildOptions = {},
): Model {
  const n = students.length;
  const C = Math.max(1, Math.floor(config.numClasses));
  const ids = students.map(s => s.id);
  const idx = new Map(ids.map((id, i) => [id, i]));

  // 우선순위 가중치: 1순위가 가장 크고, 아래로 갈수록 1.6배씩 작아진다(하위 기준도 무시되지 않게).
  const active = config.criteria.filter(c => c.active);
  const weightOf = new Map<string, number>();
  active.forEach((c, k) => weightOf.set(c.id, Math.pow(1.6, active.length - 1 - k) * (opts.weightMultipliers?.[c.id] ?? 1)));

  const metrics: Metric[] = [];
  for (const c of active) {
    const mv = metricValues(c.id, students, config);
    if (!mv) continue;
    const valid = new Uint8Array(n);
    const values = new Float64Array(n);
    let cnt = 0, s = 0, ss = 0;
    for (let i = 0; i < n; i++) {
      const v = mv.values[i];
      if (Number.isNaN(v)) continue;
      valid[i] = 1; values[i] = v; cnt++; s += v; ss += v * v;
    }
    if (cnt < 2) continue;
    const mean = s / cnt;
    const variance = Math.max(0, ss / cnt - mean * mean);
    if (variance < 1e-12) continue;
    const per = n / C;
    const scale = mv.kind === 'mean' ? variance / per : per * variance; // count: p(1-p) = variance
    metrics.push({ id: c.id, kind: mv.kind, values, valid, weight: weightOf.get(c.id)!, center: mean, scale: Math.max(scale, 1e-9) });
  }

  // 전학년 반
  const prevList = [...new Set(students.map(s => s.prevClass))].sort((a, b) => a - b);
  const prevPos = new Map(prevList.map((p, i) => [p, i]));
  const P = prevList.length;
  const prevIdx = Int32Array.from(students, s => prevPos.get(s.prevClass)!);
  const prevShare = new Float64Array(P);
  for (let i = 0; i < n; i++) prevShare[prevIdx[i]] += 1 / Math.max(n, 1);
  const thrMap = isolationThresholds(students, C);
  const isoThr = Int32Array.from(prevList, p => thrMap.get(p) ?? 0);
  let spreadScale = 0;
  for (let p = 0; p < P; p++) spreadScale += (n / C) * prevShare[p] * (1 - prevShare[p]);

  // 특수교육대상 부담 균형
  const special = Uint8Array.from(students, s => (s.specialNeeds ? 1 : 0));
  const S = special.reduce((a, b) => a + b, 0);
  const loadExtra = Math.max(0, (config.specialNeedsWeight || 1) - 1);
  const useLoad = S > 0 && loadExtra > 0;
  const effMean = (n + loadExtra * S) / C;
  const lo = useLoad ? Math.floor(n / C) - Math.ceil(loadExtra * Math.ceil(S / C)) : Math.floor(n / C);
  const hi = Math.ceil(n / C);

  // 분리 쌍
  const sepLists: number[][] = Array.from({ length: n }, () => []);
  for (const [a, b] of relations.separationPairs) {
    const ia = idx.get(a), ib = idx.get(b);
    if (ia === undefined || ib === undefined) continue;
    sepLists[ia].push(ib); sepLists[ib].push(ia);
  }

  // 제외 반
  const excluded = new Uint8Array(n * C);
  students.forEach((s, i) => s.excludedClasses.forEach(c => { if (c >= 1 && c <= C) excluded[i * C + c - 1] = 1; }));

  // 묶음(같은 반) 단위
  const unitOf = new Int32Array(n).fill(-1);
  const units: Int32Array[] = [];
  for (const g of relations.togetherGroups) {
    const members = g.map(id => idx.get(id)).filter((i): i is number => i !== undefined && unitOf[i] === -1);
    if (members.length < 2) continue;
    members.forEach(i => (unitOf[i] = units.length));
    units.push(Int32Array.from(members));
  }
  for (let i = 0; i < n; i++) if (unitOf[i] === -1) { unitOf[i] = units.length; units.push(Int32Array.of(i)); }

  // 고정: 파일의 고정반 + 화면에서 고정한 학생
  const unitFixed = new Int32Array(units.length).fill(-1);
  students.forEach((s, i) => {
    const lock = opts.locks?.[s.id] ?? (s.fixedClass && s.fixedClass <= C ? s.fixedClass : null);
    if (lock && lock >= 1 && lock <= C && unitFixed[unitOf[i]] === -1) unitFixed[unitOf[i]] = lock - 1;
  });
  const freeUnits: number[] = [];
  const freeSingles: number[] = [];
  units.forEach((u, k) => {
    if (unitFixed[k] !== -1) return;
    freeUnits.push(k);
    if (u.length === 1) freeSingles.push(u[0]);
  });

  return {
    n, C, ids, metrics, P, prevIdx, prevShare, isoThr,
    spreadWeight: weightOf.get('prevSpread') ?? 0, spreadScale: Math.max(spreadScale, 1e-9),
    isoWeight: weightOf.get('isolation') ?? 0,
    special, loadExtra, loadWeight: useLoad ? Math.pow(1.6, active.length + 1) : 0, effMean, lo, hi,
    sep: sepLists.map(l => Int32Array.from(l)), excluded, units, unitOf, unitFixed,
    freeUnits: Int32Array.from(freeUnits), freeSingles: Int32Array.from(freeSingles),
  };
}

/** 배정 상태 + 반별 누적값(증분 계산용) */
export class State {
  readonly m: Model;
  cls: Int32Array;
  size: Float64Array;
  msum: Float64Array; // metric*C
  mcnt: Float64Array;
  prevCnt: Int32Array; // C*P
  eff: Float64Array;
  classCost: Float64Array;
  hard = 0;
  total = 0;
  private mark: Uint8Array;

  constructor(m: Model, cls: Int32Array) {
    this.m = m;
    this.cls = cls;
    const M = m.metrics.length;
    this.size = new Float64Array(m.C);
    this.msum = new Float64Array(M * m.C);
    this.mcnt = new Float64Array(M * m.C);
    this.prevCnt = new Int32Array(m.C * m.P);
    this.eff = new Float64Array(m.C);
    this.classCost = new Float64Array(m.C);
    this.mark = new Uint8Array(m.n);
    for (let i = 0; i < m.n; i++) this.add(i, cls[i], 1);
    this.recomputeAll();
  }

  private add(i: number, c: number, sign: 1 | -1) {
    const m = this.m;
    this.size[c] += sign;
    this.eff[c] += sign * (1 + m.special[i] * m.loadExtra);
    this.prevCnt[c * m.P + m.prevIdx[i]] += sign;
    for (let k = 0; k < m.metrics.length; k++) {
      const mt = m.metrics[k];
      if (!mt.valid[i]) continue;
      this.msum[k * m.C + c] += sign * mt.values[i];
      this.mcnt[k * m.C + c] += sign;
    }
  }

  costOf(c: number): number {
    const m = this.m;
    const sz = this.size[c];
    let cost = 0;
    for (let k = 0; k < m.metrics.length; k++) {
      const mt = m.metrics[k];
      const s = this.msum[k * m.C + c];
      let d: number;
      if (mt.kind === 'mean') {
        const n = this.mcnt[k * m.C + c];
        if (n === 0) continue;
        d = s / n - mt.center;
      } else {
        d = s - mt.center * sz;
      }
      cost += (mt.weight * d * d) / mt.scale;
    }
    if (m.spreadWeight > 0) {
      let sp = 0;
      for (let p = 0; p < m.P; p++) {
        const d = this.prevCnt[c * m.P + p] - sz * m.prevShare[p];
        sp += d * d;
      }
      cost += (m.spreadWeight * sp) / m.spreadScale;
    }
    cost /= m.C;
    if (m.isoWeight > 0) {
      let iso = 0;
      for (let p = 0; p < m.P; p++) {
        const cnt = this.prevCnt[c * m.P + p];
        const thr = m.isoThr[p];
        if (cnt > 0 && cnt < thr) iso += thr - cnt;
      }
      cost += (m.isoWeight * iso) / 2;
    }
    if (m.loadWeight > 0) {
      const d = this.eff[c] - m.effMean;
      cost += (m.loadWeight * d * d) / m.C;
    }
    if (sz < m.lo) cost += HARD * (m.lo - sz);
    if (sz > m.hi) cost += HARD * (sz - m.hi);
    return cost;
  }

  /** 필수 조건 위반(분리 쌍 + 제외 반) — 이동하는 학생 기준 */
  private hardFor(list: ArrayLike<number>): number {
    const m = this.m;
    let v = 0;
    for (let a = 0; a < list.length; a++) {
      const i = list[a];
      const ci = this.cls[i];
      v += m.excluded[i * m.C + ci];
      const adj = m.sep[i];
      for (let b = 0; b < adj.length; b++) {
        const q = adj[b];
        if (this.mark[q] && q < i) continue;
        if (this.cls[q] === ci) v++;
      }
    }
    return v;
  }

  recomputeAll() {
    let t = 0;
    for (let c = 0; c < this.m.C; c++) { this.classCost[c] = this.costOf(c); t += this.classCost[c]; }
    const all = new Int32Array(this.m.n).map((_, i) => i);
    for (let i = 0; i < this.m.n; i++) this.mark[i] = 1;
    this.hard = this.hardFor(all);
    this.mark.fill(0);
    this.total = t + HARD * this.hard;
  }

  // 되돌리기용 버퍼
  private movedIdx: number[] = [];
  private movedFrom: number[] = [];
  private touched: number[] = [];
  private touchedCost: number[] = [];
  private prevHard = 0;
  private prevTotal = 0;

  /** 학생들을 지정한 반으로 옮기고 비용 변화량을 돌려준다. accept/reject 중 하나를 꼭 호출. */
  apply(students: ArrayLike<number>, targets: ArrayLike<number>): number {
    this.movedIdx.length = 0; this.movedFrom.length = 0; this.touched.length = 0; this.touchedCost.length = 0;
    this.prevHard = this.hard; this.prevTotal = this.total;
    for (let a = 0; a < students.length; a++) this.mark[students[a]] = 1;
    const hb = this.hardFor(students);
    for (let a = 0; a < students.length; a++) {
      const i = students[a];
      const from = this.cls[i];
      const to = targets[a];
      this.movedIdx.push(i); this.movedFrom.push(from);
      if (from === to) continue;
      if (!this.touched.includes(from)) { this.touched.push(from); this.touchedCost.push(this.classCost[from]); }
      if (!this.touched.includes(to)) { this.touched.push(to); this.touchedCost.push(this.classCost[to]); }
      this.add(i, from, -1);
      this.add(i, to, 1);
      this.cls[i] = to;
    }
    const ha = this.hardFor(students);
    for (let a = 0; a < students.length; a++) this.mark[students[a]] = 0;
    let delta = HARD * (ha - hb);
    for (let t = 0; t < this.touched.length; t++) {
      const c = this.touched[t];
      const nc = this.costOf(c);
      delta += nc - this.classCost[c];
      this.classCost[c] = nc;
    }
    this.hard += ha - hb;
    this.total += delta;
    return delta;
  }

  reject() {
    for (let a = this.movedIdx.length - 1; a >= 0; a--) {
      const i = this.movedIdx[a];
      const from = this.movedFrom[a];
      const cur = this.cls[i];
      if (cur === from) continue;
      this.add(i, cur, -1);
      this.add(i, from, 1);
      this.cls[i] = from;
    }
    for (let t = 0; t < this.touched.length; t++) this.classCost[this.touched[t]] = this.touchedCost[t];
    this.hard = this.prevHard;
    this.total = this.prevTotal;
  }
}

/** 초기해: 고정 먼저 → 남·여를 이어지는 ㄹ자로 배정(원본은 남·여 모두 1반부터 시작해 1반에 나머지가 몰림) */
export function initialAssignment(model: Model, students: ClassStudent[], config: AssignmentConfig, start?: Assignment): Int32Array {
  const { C, n, units, unitFixed } = model;
  const cls = new Int32Array(n).fill(-1);
  const size = new Int32Array(C);
  const place = (u: number, c: number) => { for (const i of units[u]) { cls[i] = c; size[c]++; } };

  units.forEach((_, u) => { if (unitFixed[u] !== -1) place(u, unitFixed[u]); });

  if (start) {
    units.forEach((u, k) => {
      if (unitFixed[k] !== -1) return;
      const c = start[model.ids[u[0]]];
      if (c && c >= 1 && c <= C) place(k, c - 1);
    });
  }

  const acad = model.metrics.find(m => m.id === 'academic');
  const keyOf = (u: Int32Array) => {
    let s = 0, k = 0;
    for (const i of u) if (acad?.valid[i]) { s += acad.values[i]; k++; }
    return k ? s / k : acad ? acad.center : 0;
  };
  const pending = units.map((u, k) => k).filter(k => cls[units[k][0]] === -1);
  const genderOf = (k: number) => students[units[k][0]].gender === '남' ? 0 : 1;
  pending.sort((a, b) => genderOf(a) - genderOf(b) || keyOf(units[b]) - keyOf(units[a]) || a - b);

  let pos = size.reduce((a, b) => a + b, 0) % (2 * C);
  for (const k of pending) {
    const cycle = Math.floor(pos / C) % 2;
    const target = cycle === 0 ? pos % C : C - 1 - (pos % C);
    let best = -1;
    for (let d = 0; d < C; d++) {
      const c = (target + d) % C;
      if (size[c] + units[k].length <= model.hi) { best = c; break; }
    }
    if (best === -1) best = size.indexOf(Math.min(...size));
    place(k, best);
    pos += units[k].length;
  }
  return cls;
}

export interface OptimizeOptions extends BuildOptions {
  seed: number;
  iterations?: number;
  start?: Assignment;
  /** 초기 온도 배율 — 기존 배정을 다듬을 때는 작게(크게 흐트러뜨리지 않음) */
  temperatureScale?: number;
  onProgress?: (fraction: number) => void;
}

export interface OptimizeResult {
  assignment: Assignment;
  report: ScenarioReport;
}

function toAssignment(model: Model, cls: Int32Array): Assignment {
  const out: Assignment = {};
  for (let i = 0; i < model.n; i++) out[model.ids[i]] = cls[i] + 1;
  return out;
}

export function optimize(
  students: ClassStudent[], config: AssignmentConfig, relations: ResolvedRelations, opts: OptimizeOptions,
): OptimizeResult {
  const t0 = Date.now();
  const model = buildModel(students, config, relations, opts);
  const rand = mulberry32(opts.seed);
  const state = new State(model, initialAssignment(model, students, config, opts.start));
  const initialCost = state.total;
  const { C, units, unitOf, freeUnits, freeSingles } = model;
  const iterations = opts.iterations ?? Math.min(150_000, Math.max(20_000, model.n * 300));

  const gatherMove = (moveS: number[], moveT: number[]): boolean => {
    const i = freeSingles[Math.floor(rand() * freeSingles.length)];
    const p = model.prevIdx[i];
    const k = Math.max(1, model.isoThr[p]);
    const P = model.P;
    const empty: number[] = [];
    for (let c = 0; c < C; c++) if (state.prevCnt[c * P + p] === 0) empty.push(c);
    if (empty.length === 0) return false;
    const b = empty[Math.floor(rand() * empty.length)];
    const spare = new Int32Array(C);
    for (let c = 0; c < C; c++) spare[c] = Math.max(0, state.prevCnt[c * P + p] - Math.max(k, 1));
    const takeFrom: number[] = [];
    const start = Math.floor(rand() * freeSingles.length);
    for (let t = 0; t < freeSingles.length && takeFrom.length < k; t++) {
      const v = freeSingles[(start + t) % freeSingles.length];
      const c = state.cls[v];
      if (model.prevIdx[v] === p && c !== b && spare[c] > 0) { spare[c]--; takeFrom.push(v); }
    }
    if (takeFrom.length < k) return false;
    // 되돌려 보낼 학생은 b반에서 몫보다 여유 있는 전학년 반 출신을 우선(새 외톨이를 만들지 않게)
    const spareB = new Int32Array(P);
    for (let q = 0; q < P; q++) spareB[q] = state.prevCnt[b * P + q] - model.isoThr[q];
    const back: number[] = [];
    const loose: number[] = [];
    for (let t = 0; t < freeSingles.length && back.length < k; t++) {
      const v = freeSingles[(start + 7 + t) % freeSingles.length];
      const q = model.prevIdx[v];
      if (state.cls[v] !== b || q === p) continue;
      if (spareB[q] > 0) { spareB[q]--; back.push(v); } else if (loose.length < k) loose.push(v);
    }
    while (back.length < k && loose.length) back.push(loose.shift()!);
    if (back.length < k) return false;
    takeFrom.forEach((v, x) => {
      moveS.push(v); moveT.push(b);
      moveS.push(back[x]); moveT.push(state.cls[v]);
    });
    return true;
  };

  const pickMove = (moveS: number[], moveT: number[]): boolean => {
    moveS.length = 0; moveT.length = 0;
    if (freeUnits.length === 0 || C < 2) return false;
    // 묶음 이동: 같은 전학년 반 학생 k명을 한꺼번에 교환한다.
    // 외톨이 방지(몫 k명) 때문에 1명씩 옮기면 중간 상태(1~k-1명)에 큰 벌점이 생겨 갇히는 것을 뛰어넘는다.
    if (model.isoWeight > 0 && freeSingles.length > 4 && rand() < 0.12) {
      const i = freeSingles[Math.floor(rand() * freeSingles.length)];
      const p = model.prevIdx[i];
      const k = model.isoThr[p];
      if (k >= 2) {
        const a = state.cls[i];
        let b = Math.floor(rand() * (C - 1));
        if (b >= a) b++;
        const out: number[] = [];
        const back: number[] = [];
        const start = Math.floor(rand() * freeSingles.length);
        for (let t = 0; t < freeSingles.length && (out.length < k || back.length < k); t++) {
          const v = freeSingles[(start + t) % freeSingles.length];
          if (state.cls[v] === a && model.prevIdx[v] === p && out.length < k) out.push(v);
          else if (state.cls[v] === b && model.prevIdx[v] !== p && back.length < k) back.push(v);
        }
        if (out.length === k && back.length === k) {
          for (const v of out) { moveS.push(v); moveT.push(b); }
          for (const v of back) { moveS.push(v); moveT.push(a); }
          return true;
        }
      }
    }
    // 모으기 이동: 어떤 전학년 반 출신이 0명인 반에, 여유 있는 여러 반에서 1명씩 k명을 모아 온다.
    if (model.isoWeight + model.spreadWeight > 0 && freeSingles.length > 4 && rand() < 0.08 && gatherMove(moveS, moveT)) return true;
    const u = freeUnits[Math.floor(rand() * freeUnits.length)];
    const members = units[u];
    const a = state.cls[members[0]];
    if (members.length === 1 && freeSingles.length > 1 && rand() < 0.8) {
      for (let tries = 0; tries < 6; tries++) {
        const v = freeSingles[Math.floor(rand() * freeSingles.length)];
        const b = state.cls[v];
        if (b === a) continue;
        moveS.push(members[0], v); moveT.push(b, a);
        return true;
      }
    }
    let b = Math.floor(rand() * (C - 1));
    if (b >= a) b++;
    if (members.length > 1 && rand() < 0.7) {
      // 묶음 ↔ 상대 반의 단독 학생 같은 수만큼 교환
      const need = members.length;
      const start = Math.floor(rand() * Math.max(freeSingles.length, 1));
      const picked: number[] = [];
      for (let k = 0; k < freeSingles.length && picked.length < need; k++) {
        const v = freeSingles[(start + k) % freeSingles.length];
        if (state.cls[v] === b && unitOf[v] !== u) picked.push(v);
      }
      if (picked.length === need) {
        for (const i of members) { moveS.push(i); moveT.push(b); }
        for (const v of picked) { moveS.push(v); moveT.push(a); }
        return true;
      }
    }
    for (const i of members) { moveS.push(i); moveT.push(b); }
    return true;
  };

  // 초기 온도: 무작위 이동 비용 변화의 평균
  const ms: number[] = [];
  const mt: number[] = [];
  let sample = 0, sampleN = 0;
  for (let k = 0; k < 200; k++) {
    if (!pickMove(ms, mt)) break;
    const d = state.apply(ms, mt);
    state.reject();
    if (d > 0 && d < HARD) { sample += d; sampleN++; }
  }
  const T0 = (sampleN ? sample / sampleN : 1) * (opts.temperatureScale ?? 1);
  const Tend = T0 * 1e-4;

  let best = state.cls.slice();
  let bestCost = state.total;
  let accepted = 0;
  const progressEvery = Math.max(1, Math.floor(iterations / 50));
  for (let it = 0; it < iterations; it++) {
    if (!pickMove(ms, mt)) break;
    const T = T0 * Math.pow(Tend / T0, it / iterations);
    const d = state.apply(ms, mt);
    if (d <= 0 || rand() < Math.exp(-d / T)) {
      accepted++;
      if (state.total < bestCost - 1e-12) { bestCost = state.total; best = state.cls.slice(); }
    } else state.reject();
    if (opts.onProgress && it % progressEvery === 0) opts.onProgress((it / iterations) * 0.9);
  }

  // 마무리: 가장 좋았던 배정에서 단독 학생 1:1 교환으로 더 나아질 곳이 없을 때까지
  const final = new State(model, best);
  const singles = freeSingles;
  const passes = model.n > 600 ? 1 : 3;
  const pair = [0, 0];
  const tg = [0, 0];
  for (let pass = 0; pass < passes; pass++) {
    let improved = false;
    for (let x = 0; x < singles.length; x++) {
      for (let y = x + 1; y < singles.length; y++) {
        const i = singles[x], j = singles[y];
        const ci = final.cls[i], cj = final.cls[j];
        if (ci === cj) continue;
        pair[0] = i; pair[1] = j; tg[0] = cj; tg[1] = ci;
        const d = final.apply(pair, tg);
        if (d < -1e-9) { improved = true; accepted++; } else final.reject();
      }
    }
    opts.onProgress?.(0.9 + (0.1 * (pass + 1)) / passes);
    if (!improved) break;
  }
  final.recomputeAll();

  return {
    assignment: toAssignment(model, final.cls),
    report: {
      iterations, acceptedMoves: accepted, elapsedMs: Date.now() - t0, seed: opts.seed,
      initialCost: Math.round(initialCost * 1000) / 1000, finalCost: Math.round(final.total * 1000) / 1000, hardViolations: final.hard,
    },
  };
}

/** 두 배정안이 같은 반으로 묶은 학생 쌍이 얼마나 겹치는지(1 = 동일, 반 이름 바뀜과 무관) */
export function pairSimilarity(a: Assignment, b: Assignment, ids: string[]): number {
  let same = 0, both = 0;
  for (let x = 0; x < ids.length; x++) {
    for (let y = x + 1; y < ids.length; y++) {
      if (a[ids[x]] === a[ids[y]]) { same++; if (b[ids[x]] === b[ids[y]]) both++; }
    }
  }
  return same ? both / same : 1;
}

const PROFILES: Array<{ name: string; tag: string; description: string; mult: Partial<Record<string, number>> }> = [
  { name: '제1안 · 균형형', tag: '추천', description: '설정한 우선순위를 그대로 반영한 안입니다.', mult: {} },
  {
    name: '제2안 · 학업 균형형', tag: '학업중시', description: '학업 수준·기초학력 균형의 비중을 3배로 높인 안입니다.',
    mult: { academic: 3, korean: 3, math: 3, basic: 2 },
  },
  {
    name: '제3안 · 새 친구 구성형', tag: '관계중시', description: '전학년 반 출신이 고르게 섞이도록 비중을 높인 안입니다(외톨이 방지는 유지).',
    mult: { prevSpread: 3, isolation: 1.5 },
  },
];

export function generateScenarios(
  students: ClassStudent[], config: AssignmentConfig, relations: ResolvedRelations,
  opts: { locks?: Assignment; onProgress?: (f: number) => void } = {},
): Scenario[] {
  const ids = students.map(s => s.id);
  const out: Scenario[] = [];
  PROFILES.forEach((p, k) => {
    let seed = config.seed + k * 7919;
    let result: OptimizeResult | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      result = optimize(students, config, relations, {
        seed, locks: opts.locks, weightMultipliers: p.mult,
        onProgress: f => opts.onProgress?.((k + f) / PROFILES.length),
      });
      // 앞선 안과 90% 넘게 같으면 다른 시드로 다시 찾아 실제로 다른 선택지를 만든다
      const tooSimilar = out.some(o => pairSimilarity(o.assignment, result!.assignment, ids) > 0.9);
      if (!tooSimilar) break;
      seed += 104729;
    }
    out.push({ id: `s${k + 1}`, name: p.name, tag: p.tag, description: p.description, assignment: result!.assignment, report: result!.report });
  });
  return out;
}

/** 현재 배정에서 벌점을 가장 많이 줄이는 1:1 교환 */
export function suggestSwaps(
  students: ClassStudent[], config: AssignmentConfig, relations: ResolvedRelations, assignment: Assignment,
  opts: { locks?: Assignment; limit?: number } = {},
): SwapSuggestion[] {
  const model = buildModel(students, config, relations, opts);
  const cls = Int32Array.from(model.ids, id => Math.min(model.C, Math.max(1, assignment[id] ?? 1)) - 1);
  const state = new State(model, cls);
  const singles = model.freeSingles;
  const found: Array<{ i: number; j: number; d: number }> = [];
  const pair = [0, 0];
  const tg = [0, 0];
  for (let x = 0; x < singles.length; x++) {
    for (let y = x + 1; y < singles.length; y++) {
      const i = singles[x], j = singles[y];
      if (state.cls[i] === state.cls[j]) continue;
      pair[0] = i; pair[1] = j; tg[0] = state.cls[j]; tg[1] = state.cls[i];
      const d = state.apply(pair, tg);
      state.reject();
      if (d < -1e-6) found.push({ i, j, d });
    }
  }
  found.sort((a, b) => a.d - b.d);
  const limit = opts.limit ?? 3;
  const picked: typeof found = [];
  const used = new Set<number>();
  for (const f of found) {
    if (used.has(f.i) || used.has(f.j)) continue;
    picked.push(f); used.add(f.i); used.add(f.j);
    if (picked.length >= limit) break;
  }
  return picked.map(f => ({
    studentA: model.ids[f.i], studentB: model.ids[f.j], gain: Math.round(-f.d * 1000) / 1000,
    effects: describeEffects(state, f.i, f.j),
  }));
}

function describeEffects(state: State, i: number, j: number): string[] {
  const before = metricSnapshot(state);
  const pair = [i, j];
  const tg = [state.cls[j], state.cls[i]];
  state.apply(pair, tg);
  const after = metricSnapshot(state);
  const hardAfter = state.hard;
  state.reject();
  const out: string[] = [];
  if (hardAfter < state.hard) out.push('필수 조건 위반 해소');
  const keys = Object.keys(before);
  keys.sort((a, b) => (before[b] - after[b]) - (before[a] - after[a]));
  for (const k of keys) {
    const diff = before[k] - after[k];
    if (Math.abs(diff) < 0.01) continue;
    out.push(`${criterionLabel(k)} ${diff > 0 ? '개선' : '약간 악화'}`);
    if (out.length >= 3) break;
  }
  return out;
}

/** 기준별 정규화 편차(가중치 제외) */
function metricSnapshot(state: State): Record<string, number> {
  const m = state.m;
  const out: Record<string, number> = {};
  m.metrics.forEach((mt, k) => {
    let v = 0;
    for (let c = 0; c < m.C; c++) {
      const s = state.msum[k * m.C + c];
      let d: number;
      if (mt.kind === 'mean') {
        const n = state.mcnt[k * m.C + c];
        if (!n) continue;
        d = s / n - mt.center;
      } else d = s - mt.center * state.size[c];
      v += (d * d) / mt.scale;
    }
    out[mt.id] = v / m.C;
  });
  if (m.spreadWeight > 0 || m.isoWeight > 0) {
    let sp = 0, iso = 0;
    for (let c = 0; c < m.C; c++) {
      for (let p = 0; p < m.P; p++) {
        const cnt = state.prevCnt[c * m.P + p];
        const d = cnt - state.size[c] * m.prevShare[p];
        sp += d * d;
        if (cnt > 0 && cnt < m.isoThr[p]) iso += m.isoThr[p] - cnt;
      }
    }
    if (m.spreadWeight > 0) out.prevSpread = sp / m.spreadScale / m.C;
    if (m.isoWeight > 0) out.isolation = iso;
  }
  return out;
}

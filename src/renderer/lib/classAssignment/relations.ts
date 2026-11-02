import type { ClassStudent, Diagnostic, ResolvedRelations, TwinsMode } from './types';

// 분리요청·같은반희망·쌍생아 셀을 학생 ID로 해석한다.
// 원본 앱의 부분 문자열 매칭("이준"⊂"이준호")과 동명이인 오배정을 막기 위해 정확 일치만 허용한다.
// 허용 형식: "홍길동", "홍길동(3-12)", "3-12" — 쉼표·세미콜론·줄바꿈으로 여러 명.

const normalizeName = (s: string) => s.replace(/\s/g, '');

export function splitRefs(raw: string): string[] {
  return raw.split(/[,;\n·/]/).map(t => t.trim()).filter(Boolean);
}

type RefResult = { id: string } | { error: string };

export function buildResolver(students: ClassStudent[]) {
  const byKey = new Map<string, ClassStudent>();
  const byName = new Map<string, ClassStudent[]>();
  for (const s of students) {
    byKey.set(`${s.prevClass}-${s.prevNumber}`, s);
    const key = normalizeName(s.name);
    byName.set(key, [...(byName.get(key) ?? []), s]);
  }
  return (token: string): RefResult => {
    const keyOnly = token.match(/^(\d+)\s*-\s*(\d+)$/);
    const withKey = token.match(/^(.+?)\s*\(\s*(\d+)\s*-\s*(\d+)\s*\)$/);
    if (keyOnly || withKey) {
      const [pc, num] = keyOnly ? [keyOnly[1], keyOnly[2]] : [withKey![2], withKey![3]];
      const hit = byKey.get(`${Number(pc)}-${Number(num)}`);
      if (!hit) return { error: `'${token}'에 해당하는 학생(전반-번호)이 명단에 없습니다` };
      if (withKey && normalizeName(withKey[1]) !== normalizeName(hit.name)) {
        return { error: `'${token}'의 이름과 번호가 일치하지 않습니다(명단: ${hit.name})` };
      }
      return { id: hit.id };
    }
    const hits = byName.get(normalizeName(token)) ?? [];
    if (hits.length === 0) return { error: `'${token}' 학생이 명단에 없습니다` };
    if (hits.length > 1) {
      return { error: `'${token}' 동명이인이 ${hits.length}명입니다. '${token}(전반-번호)' 형식으로 적어 주세요` };
    }
    return { id: hits[0].id };
  };
}

/** Union-Find로 겹치는 묶음을 합친다(예: 쌍생아 + 같은반희망) */
function mergeGroups(groups: string[][]): string[][] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    const p = parent.get(x) ?? x;
    if (p === x) return x;
    const r = find(p);
    parent.set(x, r);
    return r;
  };
  for (const g of groups) {
    for (const id of g) if (!parent.has(id)) parent.set(id, id);
    for (let i = 1; i < g.length; i++) parent.set(find(g[i]), find(g[0]));
  }
  const out = new Map<string, string[]>();
  for (const id of parent.keys()) {
    const r = find(id);
    out.set(r, [...(out.get(r) ?? []), id]);
  }
  return [...out.values()].filter(g => g.length > 1);
}

export function resolveRelations(students: ClassStudent[], twinsMode: TwinsMode): ResolvedRelations {
  const resolve = buildResolver(students);
  const diagnostics: Diagnostic[] = [];
  const nameOf = new Map(students.map(s => [s.id, s.name]));
  const pairSet = new Set<string>();
  const separationPairs: Array<[string, string]> = [];
  const addPair = (a: string, b: string) => {
    const [x, y] = a < b ? [a, b] : [b, a];
    const key = `${x}|${y}`;
    if (!pairSet.has(key)) { pairSet.add(key); separationPairs.push([x, y]); }
  };
  const togetherRaw: string[][] = [];
  const twinRaw: string[][] = [];

  const collect = (s: ClassStudent, raw: string, kind: string): string[] => {
    const ids: string[] = [];
    for (const token of splitRefs(raw)) {
      const r = resolve(token);
      if ('error' in r) {
        diagnostics.push({ level: 'warning', message: `${s.name}의 ${kind}: ${r.error}`, studentIds: [s.id] });
      } else if (r.id === s.id) {
        diagnostics.push({ level: 'warning', message: `${s.name}의 ${kind}에 자기 자신이 적혀 있어 무시합니다`, studentIds: [s.id] });
      } else ids.push(r.id);
    }
    return ids;
  };

  for (const s of students) {
    for (const id of collect(s, s.separationRaw, '분리요청')) addPair(s.id, id);
    const tg = collect(s, s.togetherRaw, '같은반희망');
    if (tg.length) togetherRaw.push([s.id, ...tg]);
    const tw = collect(s, s.twinsRaw, '쌍생아');
    if (tw.length) twinRaw.push([s.id, ...tw]);
  }

  const twinGroups = mergeGroups(twinRaw);
  const togetherGroups = mergeGroups(twinsMode === 'together' ? [...togetherRaw, ...twinGroups] : togetherRaw);
  if (twinsMode === 'separate') {
    for (const g of twinGroups) for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) addPair(g[i], g[j]);
  }

  // 모순 진단: 같은 반이어야 하는 묶음 안에 분리 쌍이 있으면 동시에 만족할 수 없다.
  const groupOf = new Map<string, number>();
  togetherGroups.forEach((g, i) => g.forEach(id => groupOf.set(id, i)));
  for (const [a, b] of separationPairs) {
    if (groupOf.has(a) && groupOf.get(a) === groupOf.get(b)) {
      diagnostics.push({
        level: 'error',
        message: `${nameOf.get(a)}–${nameOf.get(b)}: 분리요청과 같은반(쌍생아/희망)이 동시에 걸려 있습니다. 둘 중 하나를 지워 주세요`,
        studentIds: [a, b],
      });
    }
  }
  return { separationPairs, togetherGroups, twinGroups, diagnostics };
}

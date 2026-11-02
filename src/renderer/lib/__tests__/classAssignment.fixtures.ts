import { mulberry32 } from '../classAssignment/engine';
import type { ClassStudent } from '../classAssignment/types';

// 테스트용 합성 학년 명단(시드 고정)
const FAM = '김이박최정강조윤장임한오서신권황안송류홍';
const GIV = ['민준', '서연', '도윤', '하은', '시우', '지우', '예준', '수아', '주원', '지호', '하린', '준서', '유나', '건우', '서윤', '현우', '채원', '우진', '지민', '선우'];

export function student(over: Partial<ClassStudent> & { prevClass: number; prevNumber: number; name: string }): ClassStudent {
  return {
    id: `${over.prevClass}-${over.prevNumber}`, gender: '남', korean: null, math: null, average: null, rank: null,
    behavior: 0, basicAcademic: false, specialNeeds: false, separationRaw: '', togetherRaw: '', twinsRaw: '',
    fixedClass: null, excludedClasses: [], notes: '', extra: {}, importedClass: null, ...over,
  };
}

export function makeCohort(n: number, prevClasses: number, seed: number, opts: { separations?: number; twins?: number } = {}): ClassStudent[] {
  const r = mulberry32(seed);
  const used = new Set<string>();
  const out: ClassStudent[] = [];
  for (let i = 0; i < n; i++) {
    const prevClass = (i % prevClasses) + 1;
    const prevNumber = Math.floor(i / prevClasses) + 1;
    let name = '';
    do {
      name = FAM[Math.floor(r() * FAM.length)] + GIV[Math.floor(r() * GIV.length)] + String.fromCharCode(44032 + Math.floor(r() * 400));
    } while (used.has(name));
    used.add(name);
    const score = Math.round(40 + r() * 60);
    out.push(student({
      prevClass, prevNumber, name, gender: r() < 0.5 ? '남' : '여', average: score, korean: score,
      math: Math.round(Math.max(0, Math.min(100, score + (r() - 0.5) * 30))),
      behavior: r() < 0.7 ? 0 : r() < 0.6 ? 1 : r() < 0.6 ? 2 : 3, basicAcademic: r() < 0.08, specialNeeds: r() < 0.02,
    }));
  }
  for (let p = 1; p <= prevClasses; p++) {
    out.filter(s => s.prevClass === p).sort((a, b) => (b.average ?? 0) - (a.average ?? 0)).forEach((s, i) => { s.rank = i + 1; });
  }
  for (let k = 0; k < (opts.separations ?? 0); k++) {
    const a = out[Math.floor(r() * n)];
    const b = out[Math.floor(r() * n)];
    if (a !== b) a.separationRaw = a.separationRaw ? `${a.separationRaw},${b.name}` : b.name;
  }
  for (let k = 0; k < (opts.twins ?? 0); k++) {
    const a = out[k * 7 + 1];
    const b = out[k * 7 + 4];
    a.twinsRaw = b.name;
    b.twinsRaw = a.name;
  }
  return out;
}

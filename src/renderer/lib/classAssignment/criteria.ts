import type { AssignmentConfig, ClassLabelStyle, CriterionSetting, SoftCriterionId } from './types';

// 균형 기준 메타데이터 — 화면 라벨·설명과 기본 우선순위
export const CRITERION_META: Record<string, { label: string; help: string }> = {
  gender: { label: '남녀 성비 균형', help: '반마다 남학생 수가 고르게(차이 1명 이내)' },
  isolation: { label: '외톨이 방지', help: '같은 전학년 반 친구를 몫(전반 인원÷반 수) 이상 함께 배정' },
  prevSpread: { label: '전학년 반 고르게 섞기', help: '한 반에 같은 전학년 반 출신이 몰리지 않게' },
  behavior: { label: '생활지도 분산', help: '반별 생활지도 점수 합이 고르게' },
  behaviorHigh: { label: '생활지도 집중학생 분산', help: '생활지도 2점 이상 학생 수가 고르게' },
  academic: { label: '학업 수준 평준화', help: '석차 백분위(또는 평균성적) 반 평균이 고르게' },
  basic: { label: '기초학력 학생 분산', help: '기초학력 지원 학생 수가 고르게' },
  special: { label: '특수교육대상 분산', help: '특수교육대상 학생이 한 반에 몰리지 않게' },
  korean: { label: '국어 성적 평준화', help: '반별 국어 평균이 고르게' },
  math: { label: '수학 성적 평준화', help: '반별 수학 평균이 고르게' },
};

export function criterionLabel(id: SoftCriterionId | string): string {
  if (id.startsWith('extra:')) return `${id.slice(6)} 평준화`;
  return CRITERION_META[id]?.label ?? id;
}

export const DEFAULT_CRITERIA: CriterionSetting[] = [
  { id: 'gender', active: true },
  { id: 'isolation', active: true },
  { id: 'prevSpread', active: true },
  { id: 'behavior', active: true },
  { id: 'behaviorHigh', active: true },
  { id: 'academic', active: true },
  { id: 'basic', active: true },
  { id: 'special', active: true },
  { id: 'korean', active: false },
  { id: 'math', active: false },
];

export function defaultConfig(numClasses = 4): AssignmentConfig {
  return {
    numClasses,
    criteria: DEFAULT_CRITERIA.map(c => ({ ...c })),
    twinsMode: 'together',
    academicBasis: 'rank',
    specialNeedsWeight: 2,
    labelStyle: 'korean',
    seed: 20260301,
  };
}

const KOREAN_LABELS = ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하'];

/** 1 → 가반 / 1반 */
export function classLabel(classNo: number, style: ClassLabelStyle = 'korean'): string {
  if (style === 'number' || classNo < 1) return `${classNo}반`;
  const n = KOREAN_LABELS.length;
  const head = Math.floor((classNo - 1) / n);
  const tail = (classNo - 1) % n;
  return `${head > 0 ? KOREAN_LABELS[head - 1] : ''}${KOREAN_LABELS[tail]}반`;
}

/** "가", "가반", "3", "3반" → 3 (모르면 null) */
export function parseClassLabel(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isInteger(raw) && raw > 0 ? raw : null;
  const text = String(raw).replace(/\s/g, '').replace(/반$/, '');
  if (!text) return null;
  if (/^\d+$/.test(text)) {
    const n = Number(text);
    return n > 0 ? n : null;
  }
  const n = KOREAN_LABELS.length;
  if (text.length === 1) {
    const i = KOREAN_LABELS.indexOf(text);
    return i >= 0 ? i + 1 : null;
  }
  if (text.length === 2) {
    const h = KOREAN_LABELS.indexOf(text[0]);
    const t = KOREAN_LABELS.indexOf(text[1]);
    if (h >= 0 && t >= 0) return (h + 1) * n + t + 1;
  }
  return null;
}

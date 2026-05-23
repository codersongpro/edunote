// 2022 개정 교육과정 기반 학년별 교과목 및 성취수준 데이터

export interface AchievementLevel {
  code: string;   // A, B, C, D, E
  label: string;  // 아주잘함, 잘함, 보통, 노력요함 등
  description: string;
}

export interface SubjectInfo {
  name: string;
  achievementLevels: AchievementLevel[];
}

export interface GradeInfo {
  label: string;      // 예: 초등학교 1학년
  short: string;      // 예: 초1
  school: 'elementary' | 'middle' | 'high';
  subjects: SubjectInfo[];
}

// ── 공통 성취수준 (초등 3학년~중학교) ─────────────────────────────
const STANDARD_LEVELS: AchievementLevel[] = [
  { code: 'A', label: '매우잘함 (A)', description: '교육과정의 핵심 내용을 완벽히 이해하고 다양한 상황에 창의적으로 응용할 수 있음' },
  { code: 'B', label: '잘함 (B)', description: '교육과정의 핵심 내용을 잘 이해하고 주어진 상황에 적절히 적용할 수 있음' },
  { code: 'C', label: '보통 (C)', description: '교육과정의 핵심 내용을 대체로 이해하며 기본적인 과제를 수행할 수 있음' },
  { code: 'D', label: '노력요함 (D)', description: '교육과정의 핵심 내용 일부를 이해하나 과제 수행에 어려움이 있음' },
  { code: 'E', label: '매우노력요함 (E)', description: '교육과정의 핵심 내용 이해에 상당한 어려움이 있으며 기초 학습 지원이 필요함' },
];

// 초등 1-2학년 성취수준 (3단계)
const ELEM_LOW_LEVELS: AchievementLevel[] = [
  { code: 'A', label: '잘함', description: '기본 개념과 원리를 잘 이해하고 생활에서 즐겁게 활용할 수 있음' },
  { code: 'B', label: '보통', description: '기본 개념과 원리를 대체로 이해하며 도움을 받아 활용할 수 있음' },
  { code: 'C', label: '노력요함', description: '기본 개념과 원리 이해에 어려움이 있으며 반복 지도가 필요함' },
];

// 고등학교 성취수준 (5등급)
const HIGH_LEVELS: AchievementLevel[] = [
  { code: 'A', label: '1등급 수준 (A)', description: '과목의 핵심 역량을 탁월하게 발휘하며 심화·확장 과제를 자기주도적으로 수행함' },
  { code: 'B', label: '2등급 수준 (B)', description: '과목의 핵심 역량을 충분히 발휘하며 대부분의 과제를 능숙하게 수행함' },
  { code: 'C', label: '3등급 수준 (C)', description: '과목의 핵심 역량을 적절히 발휘하며 주어진 과제를 무리 없이 수행함' },
  { code: 'D', label: '4등급 수준 (D)', description: '과목의 기본 개념을 부분적으로 이해하며 과제 수행에 도움이 필요함' },
  { code: 'E', label: '5등급 수준 (E)', description: '과목의 기본 개념 이해에 어려움이 있어 집중적인 보충 지도가 필요함' },
];

// ── 초등학교 1학년 ──────────────────────────────────────────────────
const ELEM1_SUBJECTS: SubjectInfo[] = [
  { name: '국어', achievementLevels: ELEM_LOW_LEVELS },
  { name: '수학', achievementLevels: ELEM_LOW_LEVELS },
  { name: '바른 생활', achievementLevels: ELEM_LOW_LEVELS },
  { name: '슬기로운 생활', achievementLevels: ELEM_LOW_LEVELS },
  { name: '즐거운 생활', achievementLevels: ELEM_LOW_LEVELS },
  { name: '안전한 생활', achievementLevels: ELEM_LOW_LEVELS },
];

// ── 초등학교 2학년 ──────────────────────────────────────────────────
const ELEM2_SUBJECTS: SubjectInfo[] = [...ELEM1_SUBJECTS];

// ── 초등학교 3학년 ──────────────────────────────────────────────────
const ELEM3_SUBJECTS: SubjectInfo[] = [
  { name: '국어', achievementLevels: STANDARD_LEVELS },
  { name: '수학', achievementLevels: STANDARD_LEVELS },
  { name: '도덕', achievementLevels: STANDARD_LEVELS },
  { name: '사회', achievementLevels: STANDARD_LEVELS },
  { name: '과학', achievementLevels: STANDARD_LEVELS },
  { name: '체육', achievementLevels: STANDARD_LEVELS },
  { name: '음악', achievementLevels: STANDARD_LEVELS },
  { name: '미술', achievementLevels: STANDARD_LEVELS },
  { name: '영어', achievementLevels: STANDARD_LEVELS },
];

// ── 초등학교 4학년 ──────────────────────────────────────────────────
const ELEM4_SUBJECTS: SubjectInfo[] = [...ELEM3_SUBJECTS];

// ── 초등학교 5학년 ──────────────────────────────────────────────────
const ELEM5_SUBJECTS: SubjectInfo[] = [
  { name: '국어', achievementLevels: STANDARD_LEVELS },
  { name: '수학', achievementLevels: STANDARD_LEVELS },
  { name: '도덕', achievementLevels: STANDARD_LEVELS },
  { name: '사회', achievementLevels: STANDARD_LEVELS },
  { name: '과학', achievementLevels: STANDARD_LEVELS },
  { name: '실과', achievementLevels: STANDARD_LEVELS },
  { name: '체육', achievementLevels: STANDARD_LEVELS },
  { name: '음악', achievementLevels: STANDARD_LEVELS },
  { name: '미술', achievementLevels: STANDARD_LEVELS },
  { name: '영어', achievementLevels: STANDARD_LEVELS },
];

// ── 초등학교 6학년 ──────────────────────────────────────────────────
const ELEM6_SUBJECTS: SubjectInfo[] = [...ELEM5_SUBJECTS];

// ── 중학교 공통 교과 ─────────────────────────────────────────────────
const MIDDLE_SUBJECTS: SubjectInfo[] = [
  { name: '국어', achievementLevels: STANDARD_LEVELS },
  { name: '수학', achievementLevels: STANDARD_LEVELS },
  { name: '영어', achievementLevels: STANDARD_LEVELS },
  { name: '도덕', achievementLevels: STANDARD_LEVELS },
  { name: '사회', achievementLevels: STANDARD_LEVELS },
  { name: '역사', achievementLevels: STANDARD_LEVELS },
  { name: '과학', achievementLevels: STANDARD_LEVELS },
  { name: '기술·가정', achievementLevels: STANDARD_LEVELS },
  { name: '정보', achievementLevels: STANDARD_LEVELS },
  { name: '체육', achievementLevels: STANDARD_LEVELS },
  { name: '음악', achievementLevels: STANDARD_LEVELS },
  { name: '미술', achievementLevels: STANDARD_LEVELS },
  { name: '한문', achievementLevels: STANDARD_LEVELS },
  { name: '진로와 직업', achievementLevels: STANDARD_LEVELS },
];

// ── 고등학교 1학년 (공통과목) ──────────────────────────────────────
const HIGH1_SUBJECTS: SubjectInfo[] = [
  { name: '공통국어1', achievementLevels: HIGH_LEVELS },
  { name: '공통국어2', achievementLevels: HIGH_LEVELS },
  { name: '공통수학1', achievementLevels: HIGH_LEVELS },
  { name: '공통수학2', achievementLevels: HIGH_LEVELS },
  { name: '공통영어1', achievementLevels: HIGH_LEVELS },
  { name: '공통영어2', achievementLevels: HIGH_LEVELS },
  { name: '통합사회1', achievementLevels: HIGH_LEVELS },
  { name: '통합사회2', achievementLevels: HIGH_LEVELS },
  { name: '통합과학1', achievementLevels: HIGH_LEVELS },
  { name: '통합과학2', achievementLevels: HIGH_LEVELS },
  { name: '한국사1', achievementLevels: HIGH_LEVELS },
  { name: '한국사2', achievementLevels: HIGH_LEVELS },
  { name: '체육1', achievementLevels: HIGH_LEVELS },
  { name: '음악', achievementLevels: HIGH_LEVELS },
  { name: '미술', achievementLevels: HIGH_LEVELS },
];

// ── 고등학교 2학년 (일반 선택과목) ─────────────────────────────────
const HIGH2_SUBJECTS: SubjectInfo[] = [
  // 국어 영역
  { name: '화법과 언어', achievementLevels: HIGH_LEVELS },
  { name: '독서와 작문', achievementLevels: HIGH_LEVELS },
  { name: '문학', achievementLevels: HIGH_LEVELS },
  // 수학 영역
  { name: '대수', achievementLevels: HIGH_LEVELS },
  { name: '미적분I', achievementLevels: HIGH_LEVELS },
  { name: '확률과 통계', achievementLevels: HIGH_LEVELS },
  // 영어 영역
  { name: '영어I', achievementLevels: HIGH_LEVELS },
  { name: '영어II', achievementLevels: HIGH_LEVELS },
  { name: '영어 독해와 작문', achievementLevels: HIGH_LEVELS },
  // 사회 영역
  { name: '한국지리 탐구', achievementLevels: HIGH_LEVELS },
  { name: '세계지리 탐구', achievementLevels: HIGH_LEVELS },
  { name: '세계사', achievementLevels: HIGH_LEVELS },
  { name: '사회와 문화', achievementLevels: HIGH_LEVELS },
  { name: '현대사회와 윤리', achievementLevels: HIGH_LEVELS },
  // 과학 영역
  { name: '물리학', achievementLevels: HIGH_LEVELS },
  { name: '화학', achievementLevels: HIGH_LEVELS },
  { name: '생명과학', achievementLevels: HIGH_LEVELS },
  { name: '지구과학', achievementLevels: HIGH_LEVELS },
  // 예체능
  { name: '체육', achievementLevels: HIGH_LEVELS },
  { name: '음악', achievementLevels: HIGH_LEVELS },
  { name: '미술', achievementLevels: HIGH_LEVELS },
  // 기술·가정/정보
  { name: '기술·가정', achievementLevels: HIGH_LEVELS },
  { name: '정보', achievementLevels: HIGH_LEVELS },
];

// ── 고등학교 3학년 (심화·융합 선택과목) ────────────────────────────
const HIGH3_SUBJECTS: SubjectInfo[] = [
  // 국어
  { name: '주제 탐구 독서', achievementLevels: HIGH_LEVELS },
  { name: '문학과 영상', achievementLevels: HIGH_LEVELS },
  { name: '직무 의사소통', achievementLevels: HIGH_LEVELS },
  // 수학
  { name: '미적분II', achievementLevels: HIGH_LEVELS },
  { name: '기하', achievementLevels: HIGH_LEVELS },
  { name: '경제 수학', achievementLevels: HIGH_LEVELS },
  { name: '인공지능 수학', achievementLevels: HIGH_LEVELS },
  // 영어
  { name: '심화 영어I', achievementLevels: HIGH_LEVELS },
  { name: '심화 영어II', achievementLevels: HIGH_LEVELS },
  { name: '영어 발표와 토론', achievementLevels: HIGH_LEVELS },
  // 사회·과학 융합
  { name: '융합과학 탐구', achievementLevels: HIGH_LEVELS },
  { name: '사회문제 탐구', achievementLevels: HIGH_LEVELS },
  { name: '윤리와 사상', achievementLevels: HIGH_LEVELS },
  { name: '경제', achievementLevels: HIGH_LEVELS },
  { name: '정치와 법', achievementLevels: HIGH_LEVELS },
  // 과학 심화
  { name: '역학과 에너지', achievementLevels: HIGH_LEVELS },
  { name: '물질과 에너지', achievementLevels: HIGH_LEVELS },
  { name: '세포와 물질대사', achievementLevels: HIGH_LEVELS },
  { name: '지구시스템과학', achievementLevels: HIGH_LEVELS },
  // 기타
  { name: '체육', achievementLevels: HIGH_LEVELS },
  { name: '음악', achievementLevels: HIGH_LEVELS },
  { name: '미술', achievementLevels: HIGH_LEVELS },
  { name: '정보', achievementLevels: HIGH_LEVELS },
];

// ── 전체 학년 목록 ────────────────────────────────────────────────
export const GRADES: GradeInfo[] = [
  { label: '초등학교 1학년', short: '초1', school: 'elementary', subjects: ELEM1_SUBJECTS },
  { label: '초등학교 2학년', short: '초2', school: 'elementary', subjects: ELEM2_SUBJECTS },
  { label: '초등학교 3학년', short: '초3', school: 'elementary', subjects: ELEM3_SUBJECTS },
  { label: '초등학교 4학년', short: '초4', school: 'elementary', subjects: ELEM4_SUBJECTS },
  { label: '초등학교 5학년', short: '초5', school: 'elementary', subjects: ELEM5_SUBJECTS },
  { label: '초등학교 6학년', short: '초6', school: 'elementary', subjects: ELEM6_SUBJECTS },
  { label: '중학교 1학년', short: '중1', school: 'middle', subjects: MIDDLE_SUBJECTS },
  { label: '중학교 2학년', short: '중2', school: 'middle', subjects: MIDDLE_SUBJECTS },
  { label: '중학교 3학년', short: '중3', school: 'middle', subjects: MIDDLE_SUBJECTS },
  { label: '고등학교 1학년', short: '고1', school: 'high', subjects: HIGH1_SUBJECTS },
  { label: '고등학교 2학년', short: '고2', school: 'high', subjects: HIGH2_SUBJECTS },
  { label: '고등학교 3학년', short: '고3', school: 'high', subjects: HIGH3_SUBJECTS },
];

export const getSubjectsForGrade = (gradeLabel: string): SubjectInfo[] => {
  return GRADES.find(g => g.label === gradeLabel)?.subjects ?? [];
};

export const getAchievementLevels = (gradeLabel: string, subjectName: string): AchievementLevel[] => {
  const subjects = getSubjectsForGrade(gradeLabel);
  return subjects.find(s => s.name === subjectName)?.achievementLevels ?? STANDARD_LEVELS;
};

// 반편성 — 공용 타입
// 이 기능은 AI를 호출하지 않으며 학생 정보는 PC 안에서만 처리된다.

export type Gender = '남' | '여';

export interface ClassStudent {
  /** 안정 ID: `전학년반-전학년번호` (중복 시 접미사) */
  id: string;
  prevClass: number;
  prevNumber: number;
  name: string;
  gender: Gender | '';
  korean: number | null;
  math: number | null;
  average: number | null;
  /** 전학년 반 내 석차(1 = 최상위) */
  rank: number | null;
  /** 생활지도 0~3 */
  behavior: number;
  basicAcademic: boolean;
  specialNeeds: boolean;
  /** 원본 셀 값(참조는 엔진 실행 전에 ID로 해석) */
  separationRaw: string;
  togetherRaw: string;
  twinsRaw: string;
  fixedClass: number | null;
  excludedClasses: number[];
  notes: string;
  /** 양식 외 열 — 숫자 값은 사용자 정의 기준으로 쓸 수 있다 */
  extra: Record<string, number | string>;
  /** 업로드 파일에 이미 있던 배정반(결과 파일 재업로드 시) */
  importedClass: number | null;
}

/** 균형(soft) 기준 ID. 사용자 정의 숫자열은 `extra:열이름` */
export type SoftCriterionId =
  | 'gender'
  | 'prevSpread'
  | 'isolation'
  | 'academic'
  | 'korean'
  | 'math'
  | 'behavior'
  | 'behaviorHigh'
  | 'basic'
  | 'special'
  | `extra:${string}`;

export interface CriterionSetting {
  id: SoftCriterionId;
  active: boolean;
}

export type TwinsMode = 'together' | 'separate' | 'ignore';
export type AcademicBasis = 'rank' | 'score';
export type ClassLabelStyle = 'korean' | 'number';

export interface AssignmentConfig {
  numClasses: number;
  /** 배열 순서 = 우선순위 */
  criteria: CriterionSetting[];
  twinsMode: TwinsMode;
  academicBasis: AcademicBasis;
  /** 특수교육대상 학생 1명을 몇 명으로 셀지(학급 부담 균형용) */
  specialNeedsWeight: number;
  labelStyle: ClassLabelStyle;
  seed: number;
}

/** 학생 ID → 배정반(1부터) */
export type Assignment = Record<string, number>;

export type DiagnosticLevel = 'error' | 'warning' | 'info';

export interface Diagnostic {
  level: DiagnosticLevel;
  message: string;
  studentIds?: string[];
}

export interface ResolvedRelations {
  /** 분리해야 하는 쌍(정렬된 ID 쌍, 중복 없음) */
  separationPairs: Array<[string, string]>;
  /** 같은 반이어야 하는 묶음(같은반희망 + 쌍생아 동반 모드) */
  togetherGroups: string[][];
  /** 쌍생아 묶음(모드와 무관하게 해석 결과) */
  twinGroups: string[][];
  diagnostics: Diagnostic[];
}

export type CheckStatus = 'pass' | 'warn' | 'fail';

export interface ComplianceItem {
  id: string;
  label: string;
  /** 필수 조건 여부 */
  hard: boolean;
  status: CheckStatus;
  /** 0~100. 필수 조건은 위반 0건이면 100 */
  score: number;
  /** 한 줄 요약(예: "반별 남학생 14~15명") */
  summary: string;
  issues: string[];
}

export interface SwapSuggestion {
  studentA: string;
  studentB: string;
  /** 낮아진 벌점(클수록 좋음) */
  gain: number;
  /** 변화가 큰 기준 라벨과 방향 */
  effects: string[];
}

export interface ScenarioReport {
  iterations: number;
  acceptedMoves: number;
  elapsedMs: number;
  seed: number;
  initialCost: number;
  finalCost: number;
  hardViolations: number;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  tag: string;
  assignment: Assignment;
  report: ScenarioReport;
}

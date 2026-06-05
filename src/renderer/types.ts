import React from 'react';

// ─── School Level ──────────────────────────────────────────────────
export enum SchoolLevel {
  ELEMENTARY = '초등학교',
  MIDDLE = '중학교',
  HIGH = '고등학교',
}

// ─── App Mode ─────────────────────────────────────────────────────
export enum AppMode {
  // System
  HOME = 'HOME',
  USAGE_GUIDE = 'USAGE_GUIDE',
  SETTINGS = 'SETTINGS',
  ABOUT = 'ABOUT',
  // 학생기록 AI
  RECORD_CHATBOT = 'RECORD_CHATBOT',
  GUIDELINE_QA = 'GUIDELINE_QA',
  GENERATOR = 'GENERATOR',
  SUBJECT_GENERATOR = 'SUBJECT_GENERATOR',
  SPORTS_CLUB_GENERATOR = 'SPORTS_CLUB_GENERATOR',
  CREATIVE_ACTIVITY_GENERATOR = 'CREATIVE_ACTIVITY_GENERATOR',
  // 교무 AI
  EDUCATION_QA = 'EDUCATION_QA',
  OFFICIAL_DOC_ANALYZER = 'OFFICIAL_DOC_ANALYZER',
  SCHOOL_DOC = 'SCHOOL_DOC',
  LESSON_OBSERVATION = 'LESSON_OBSERVATION',
  COUNSELING_LOG = 'COUNSELING_LOG',
  CLASS_LOG = 'CLASS_LOG',
  STUDENT_MEMO = 'STUDENT_MEMO',
  // 수업 AI
  LESSON_MATERIAL = 'LESSON_MATERIAL',
  QR_MAKER = 'QR_MAKER',
  MY_RESOURCES = 'MY_RESOURCES',
  LUCKY_DRAW = 'LUCKY_DRAW',
  // 통합 패널
  TEACHER_RECORD = 'TEACHER_RECORD',
  CLASS_TOOLS = 'CLASS_TOOLS',
  // 그룹 노드 (패널 없음 — 사이드바 트리 부모용)
  STUDENT_RECORD_GROUP = 'STUDENT_RECORD_GROUP',
  // 유틸리티
  DEMO_SAMPLES = 'DEMO_SAMPLES',
  // 나만의AI
  MY_AI_TOOLS = 'MY_AI_TOOLS',
  MY_AI_TOOLS_SHARED = 'MY_AI_TOOLS_SHARED',
  // 예산사용계획
  BUDGET_PLANNER = 'BUDGET_PLANNER',
  // 공문 보관함
  DOC_ARCHIVE = 'DOC_ARCHIVE',
  // 양식 인쇄
  PRINT_FORM = 'PRINT_FORM',
}

// ─── Custom Tool ───────────────────────────────────────────────────
export interface CustomToolInput {
  id: string;
  label: string;
  placeholder?: string;
  type: 'text' | 'textarea' | 'file-upload';
  required?: boolean;
}

export interface CustomTool {
  id: string;
  name: string;
  description: string;
  category: 'admin' | 'lesson' | 'student' | 'other';
  toolType?: 'prompt' | 'html-app';
  inputs: CustomToolInput[];
  promptTemplate: string;
  htmlContent?: string;
  author?: string;
  createdAt: string;
  updatedAt: string;
  pinned?: boolean;
  pinnedAt?: number;
}

// ─── Prompt Coach ─────────────────────────────────────────────────
export interface PromptCoachIssue {
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  suggestion: string;
}

export interface PromptCoachResult {
  score: number;            // 0~100
  summary: string;          // 한 줄 총평
  issues: PromptCoachIssue[];
  improvedPrompt?: string;  // 선택: 개선된 전체 프롬프트
}

// ─── Chat ─────────────────────────────────────────────────────────
export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

// ─── Tag ──────────────────────────────────────────────────────────
export interface TagOption {
  id: string;
  label: string;
  category: 'positive' | 'negative' | 'role' | 'activity' | 'competency';
}

// ─── Length ───────────────────────────────────────────────────────
export type LengthOption = '100' | '200' | '300' | '400' | '500' | 'custom';
export type LengthUnit = '자' | 'byte';

// ─── Assessment ───────────────────────────────────────────────────
export interface AssessmentTask {
  id: string;
  task: string;
  level: '상' | '중' | '하';
}

export interface ParsedTaskData {
  subject?: string;
  tasks: AssessmentTask[];
}

export interface NeisAnalyzedData {
  semester: string;
  subject: string;
  tasks: string[];
  students: {
    name: string;
    evaluations: ('상' | '중' | '하')[];
  }[];
}

// ─── Student Data ─────────────────────────────────────────────────
export interface Student {
  id: string;
  name: string;
}

export interface StudentOpinionData extends Student {
  positiveTags: string[];
  negativeTags: string[];
  additionalContext: string;
  generatedContent?: string;
  selected?: boolean;
}

export interface StudentEvaluation {
  id: string;
  level: '상' | '중' | '하';
}

export interface ObservationDetails {
  process: string;
  attitude: string;
  skill: string;
  example: string;
}

export interface StudentSubjectData extends Student {
  additionalContext: string;
  observationDetails?: ObservationDetails;
  evaluations?: StudentEvaluation[];
  generatedContent?: string;
  selected?: boolean;
}

export interface StudentSportsData extends Student {
  additionalContext: string;
  generatedContent?: string;
  selected?: boolean;
}

export interface StudentCreativeActivityData extends Student {
  selectedTags: string[];
  additionalContext: string;
  generatedContent?: string;
  selected?: boolean;
}

// ─── Generation Requests ──────────────────────────────────────────
export interface GenerationRequest {
  schoolLevel: SchoolLevel;
  studentName: string;
  positiveTags: string[];
  negativeTags: string[];
  additionalContext: string;
  lengthOption: LengthOption;
  customLength?: number;
  lengthUnit: LengthUnit;
  avoidPhrases?: string[];
  privacyModeEnabled?: boolean;
  studentMemos?: string[];
}

export interface SubjectGenerationRequest {
  schoolLevel: SchoolLevel;
  studentName: string;
  subject: string;
  tasks: AssessmentTask[];
  additionalContext: string;
  lengthOption: LengthOption;
  customLength?: number;
  lengthUnit: LengthUnit;
  avoidPhrases?: string[];
  privacyModeEnabled?: boolean;
  studentMemos?: string[];
}

export interface SportsGenerationRequest {
  schoolLevel: SchoolLevel;
  studentName: string;
  sportName: string;
  clubName: string;
  additionalContext: string;
  lengthOption: LengthOption;
  customLength?: number;
  lengthUnit: LengthUnit;
  avoidPhrases?: string[];
  privacyModeEnabled?: boolean;
  studentMemos?: string[];
}

export interface CreativeActivityGenerationRequest {
  schoolLevel: SchoolLevel;
  studentName: string;
  activityName: string;
  activityType: string;
  annualPlan: string;
  keywords: string[];
  additionalContext: string;
  lengthOption: LengthOption;
  customLength?: number;
  lengthUnit: LengthUnit;
  avoidPhrases?: string[];
  privacyModeEnabled?: boolean;
  studentMemos?: string[];
}

// ─── Global State ─────────────────────────────────────────────────
export interface GlobalState {
  guidelineQA: { messages: ChatMessage[] };
  recordChatbot: { messages: ChatMessage[] };
  opinion: {
    step: 'SETUP' | 'CONFIG' | 'RESULT';
    studentCount: number;
    nameInput: string;
    students: StudentOpinionData[];
    currentStudentIndex: number;
    lengthOption: LengthOption;
    customLength: number;
    lengthUnit: LengthUnit;
  };
  subject: {
    step: 'STUDENT_SETUP' | 'GLOBAL_SETUP' | 'INDIVIDUAL_CONTEXT' | 'RESULT';
    commonStudents: Student[];
    studentCount: number;
    nameInput: string;
    dataStore: Record<string, { tasks: AssessmentTask[]; students: StudentSubjectData[] }>;
    currentSubject: string;
    activeTasks: AssessmentTask[];
    activeStudents: StudentSubjectData[];
    currentStudentIndex: number;
    isDirectInput: boolean;
    lengthOption: LengthOption;
    customLength: number;
    lengthUnit: LengthUnit;
  };
  sports: {
    step: 'SETUP' | 'CONFIG' | 'RESULT';
    studentCount: number;
    nameInput: string;
    students: StudentSportsData[];
    sportName: string;
    clubName: string;
    currentStudentIndex: number;
    lengthOption: LengthOption;
    customLength: number;
    lengthUnit: LengthUnit;
  };
  creative: {
    step: 'STUDENT_SETUP' | 'ACTIVITY_SETUP' | 'INDIVIDUAL_CONTEXT' | 'RESULT';
    studentCount: number;
    nameInput: string;
    commonStudents: Student[];
    dataStore: Record<string, { type: string; annualPlan: string; students: StudentCreativeActivityData[] }>;
    currentActivityName: string;
    currentActivityType: string;
    currentAnnualPlan: string;
    activeStudents: StudentCreativeActivityData[];
    currentStudentIndex: number;
    lengthOption: LengthOption;
    customLength: number;
    lengthUnit: LengthUnit;
  };
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  description?: string;
}

export type ApiKeyAvailability = 'unknown' | 'usable' | 'wait';

export interface GlobalStateContextType {
  state: GlobalState;
  setState: React.Dispatch<React.SetStateAction<GlobalState>>;
  isGlobalGenerating: boolean;
  setIsGlobalGenerating: (v: boolean) => void;
  globalProgress: number;
  setGlobalProgress: (v: number) => void;
  generatingModes: Map<string, number>;       // AppMode string → progress (-1=indeterminate, 0-100)
  setGeneratingMode: (mode: string, progress: number | null) => void;  // null = done
  // 생성 중단 요청 관리 — modeKey별로 사용자 중단 요청 플래그
  requestCancel: (modeKey: string) => void;
  isCancelled: (modeKey: string) => boolean;
  clearCancel: (modeKey: string) => void;
  // AI 호출 즉시 중단을 위한 AbortSignal 공급
  getCancelSignal: () => AbortSignal;
  // API 키 실제 사용 가능 여부 (단순 저장 여부와 구분)
  apiKeyAvailability: ApiKeyAvailability;
  setApiKeyAvailability: (v: ApiKeyAvailability) => void;
  // API 키 활성화 성공 팝업
  showActivationModal: () => void;
  // 토스트 알림
  showToast: (toast: Omit<ToastMessage, 'id'>) => void;
  // 새 API 키 확인 시 모든 생성 잠금 강제 해제
  resetGenerationState: () => void;
}

// ─── School Doc Types ─────────────────────────────────────────────
export enum DocType {
  GONGMUN = 'GONGMUN',
  PLAN = 'PLAN',
  REPORT = 'REPORT',
  NEWSLETTER = 'NEWSLETTER',
  MESSAGE = 'MESSAGE',
  PUMUI = 'PUMUI',
  MEETING_MINUTES = 'MEETING_MINUTES',
  PROMOTION = 'PROMOTION',
  GONGGO = 'GONGGO',
}

export enum GongmunType {
  INTERNAL = 'INTERNAL',
  EXTERNAL = 'EXTERNAL',
}

export enum GongmunComplexity {
  SIMPLE = 'SIMPLE',
  MEDIUM = 'MEDIUM',
  DETAILED = 'DETAILED',
}

export enum MessageType {
  SMS = 'SMS',
  LMS = 'LMS',
}

export enum MessageTarget {
  TEACHER = '교직원',
  PARENT = '학부모',
  STUDENT = '학생',
}

export enum MessageRelationship {
  ALL = '전체메시지',
  PARENT = '학부모',
  SUPERIOR = '상급자',
  COLLEAGUE = '동료교직원',
  STUDENT = '학생',
  FRIEND = '친구',
}

export enum PumuiType {
  GOODS = 'GOODS',
  ALLOWANCE = 'ALLOWANCE',
  BIZ_PROMOTION = 'BIZ_PROMOTION',
}

export interface FileData {
  file: File;
  base64: string;
  mimeType: string;
}

export interface GlobalSettings {
  pageCount: number;
}

export interface GonggoInputs {
  title: string;
  number: string;
  content: string;
  deadline: string;
  contact: string;
  extraInfo: string;
}

export interface GongmunInputs {
  type: GongmunType;
  complexity: GongmunComplexity;
  recipient: string;
  title: string;
  bodyContext: string;
}

export interface PlanInputs {
  topic: string;
  target: string;
  budget: string;
  extraInfo: string;
}

export interface ReportInputs {
  topic: string;
  target: string;
  budget: string;
  extraInfo: string;
  summary: string;
}

export interface NewsletterInputs {
  title: string;
  target: string;
  context: string;
}

export interface MessageInputs {
  target: MessageTarget;
  type: MessageType;
  context: string;
  isReply: boolean;
  receivedMessage: string;
  relationship: MessageRelationship;
}

export interface PumuiInputs {
  type: PumuiType;
  title: string;
  relatedDoc: string;
  budget: string;
  calcDetails: string;
  details?: string;
  purpose?: string;
  target?: string;
  datetime?: string;
  place?: string;
  agenda?: string;
  attendees?: string;
}

export interface MeetingMinutesInputs {
  title: string;
  schoolName: string;
  datetime: string;
  place: string;
  attendees: string;
  topic: string;
  context: string;
}

export interface PromotionInputs {
  schoolName: string;
  datetime: string;
  target: string;
  content: string;
  purpose: string;
  interview: string;
}

// ─── Budget Planner ───────────────────────────────────────────────
export type BudgetCategory = '교육운영비' | '일반운영비' | '업무추진비';

export interface BudgetItem {
  id: string;
  budgetCategory: BudgetCategory;
  thngNm: string;
  parentId?: string;
  thngCd?: string;
  spec?: string;
  unitPrice: number;
  quantity: number;
  minQuantity?: number;
  maxQuantity?: number;
  subtotal: number;
  memo?: string;
  priceSource?: string;
  priceSourceUrl?: string;
  quantityLocked?: boolean;
  unitPriceLocked?: boolean;
  quantityAdjusted?: boolean;
}

export interface BudgetPlan {
  id: string;
  title: string;
  totalBudget: number;
  items: BudgetItem[];
  createdAt: number;
  updatedAt: number;
}

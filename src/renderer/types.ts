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
  // 학생기록 AI
  RECORD_CHATBOT = 'RECORD_CHATBOT',
  GUIDELINE_QA = 'GUIDELINE_QA',
  GENERATOR = 'GENERATOR',
  SUBJECT_GENERATOR = 'SUBJECT_GENERATOR',
  SPORTS_CLUB_GENERATOR = 'SPORTS_CLUB_GENERATOR',
  CREATIVE_ACTIVITY_GENERATOR = 'CREATIVE_ACTIVITY_GENERATOR',
  // 교무 AI
  EDUCATION_QA = 'EDUCATION_QA',
  SCHOOL_DOC = 'SCHOOL_DOC',
  LESSON_OBSERVATION = 'LESSON_OBSERVATION',
  COUNSELING_LOG = 'COUNSELING_LOG',
  CLASS_LOG = 'CLASS_LOG',
  STUDENT_MEMO = 'STUDENT_MEMO',
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

export interface GlobalStateContextType {
  state: GlobalState;
  setState: React.Dispatch<React.SetStateAction<GlobalState>>;
  isGlobalGenerating: boolean;
  setIsGlobalGenerating: (v: boolean) => void;
  globalProgress: number;
  setGlobalProgress: (v: number) => void;
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

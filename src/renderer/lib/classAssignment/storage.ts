import type { Assignment, AssignmentConfig, ClassStudent, Scenario } from './types';

// 반편성 작업 상태를 이 PC의 앱 데이터 폴더에만 저장한다(외부 전송 없음).
// 주의: 앱 백업 파일에도 포함된다 — 화면에서 안내하고 「모두 지우기」를 제공한다.

export const CLASS_ASSIGNMENT_DATA_KEY = 'class-assignment';
const VERSION = 1;

export interface SavedWork {
  version: number;
  savedAt: string;
  fileName: string;
  students: ClassStudent[];
  extraNumericColumns: string[];
  config: AssignmentConfig;
  scenarios: Scenario[];
  activeScenario: number;
  /** 시나리오별 현재 배정(수동 조정 반영) */
  working: Assignment[];
  /** 화면에서 고정한 학생 → 반 */
  locks: Assignment;
}

function isSaved(v: unknown): v is SavedWork {
  if (!v || typeof v !== 'object') return false;
  const o = v as Partial<SavedWork>;
  return o.version === VERSION && Array.isArray(o.students) && !!o.config && Array.isArray(o.scenarios) && Array.isArray(o.working);
}

export async function loadWork(): Promise<SavedWork | null> {
  try {
    const raw = await window.electronAPI.readJsonData(CLASS_ASSIGNMENT_DATA_KEY);
    return isSaved(raw) ? raw : null;
  } catch {
    return null;
  }
}

export async function saveWork(work: Omit<SavedWork, 'version' | 'savedAt'>): Promise<void> {
  await window.electronAPI.writeJsonData(CLASS_ASSIGNMENT_DATA_KEY, { ...work, version: VERSION, savedAt: new Date().toISOString() });
}

export async function clearWork(): Promise<void> {
  await window.electronAPI.writeJsonData(CLASS_ASSIGNMENT_DATA_KEY, null);
}

// 생기부 4개 생성기(행발·교과세특·창체·스포츠클럽)와 학생기록 챗봇의 작업 내용을
// 자동 저장하고 다음 실행에서 이어서 하도록 복원한다.
//
// 배경: 이 상태(GlobalState)는 그동안 React 메모리에만 있었다. 학년말에 30명 분량을
// 여러 번에 나눠 입력하는 도중 앱을 닫으면 태그·관찰 내용·생성 결과가 경고 없이 모두
// 사라졌고, 교사가 손으로 다듬은 최종본도 마찬가지였다.
import { GlobalState } from '../types';
import { initialGlobalState } from '../GlobalStateContext';

// 저장 파일 이름. main의 safeDataFile이 영숫자·_·- 만 허용하므로 그 범위 안에서 짓는다.
export const WORK_DRAFT_NAME = 'work-draft';
export const WORK_DRAFT_VERSION = 1;

export interface WorkDraft {
  version: number;
  savedAt: string;
  state: GlobalState;
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

interface StudentLike {
  additionalContext?: string;
  generatedContent?: string;
  positiveTags?: string[];
  negativeTags?: string[];
  selectedTags?: string[];
}

function studentHasWork(student: StudentLike): boolean {
  return (
    hasText(student.additionalContext) ||
    hasText(student.generatedContent) ||
    (student.positiveTags?.length ?? 0) > 0 ||
    (student.negativeTags?.length ?? 0) > 0 ||
    (student.selectedTags?.length ?? 0) > 0
  );
}

// 복원 여부를 물어볼 값어치가 있는 상태인지 판단한다.
// 앱을 켜고 아무것도 하지 않은 초기 상태로 매번 "이어서 하시겠습니까?"를 띄우면 방해만 된다.
export function hasMeaningfulWork(state: GlobalState): boolean {
  if (state.recordChatbot?.messages?.length > 0) return true;

  const studentGroups = [
    state.opinion?.students,
    state.sports?.students,
    state.subject?.activeStudents,
    state.creative?.activeStudents,
  ];
  for (const group of studentGroups) {
    if (!Array.isArray(group)) continue;
    // 학생을 2명 이상 만들었다는 것 자체가 명단을 입력했다는 뜻이다.
    if (group.length > 1) return true;
    if (group.some(studentHasWork)) return true;
  }

  // 과목별·활동별로 쌓아 둔 데이터가 있으면 작업 중인 것으로 본다.
  if (Object.keys(state.subject?.dataStore ?? {}).length > 0) return true;
  if (Object.keys(state.creative?.dataStore ?? {}).length > 0) return true;

  return false;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

// 저장 파일을 방어적으로 해석한다. 구버전·손상 파일이 들어와도 앱이 깨지지 않아야 하므로
// 알려진 구역만 initialGlobalState 위에 얹고, 복원할 내용이 없으면 null을 돌려준다.
export function parseWorkDraft(raw: unknown): WorkDraft | null {
  if (!isPlainObject(raw)) return null;
  if (raw.version !== WORK_DRAFT_VERSION) return null;
  if (!isPlainObject(raw.state)) return null;

  // 구역마다 타입이 달라 반복문으로 합치면 유니온으로 넓어지므로 명시적으로 병합한다.
  // 구역이 통째로 빠져 있으면 초기값을 그대로 쓴다.
  const saved = raw.state;
  const mergeSection = <K extends keyof GlobalState>(key: K): GlobalState[K] => {
    const section = saved[key];
    return isPlainObject(section) ? { ...initialGlobalState[key], ...section } : initialGlobalState[key];
  };
  const merged: GlobalState = {
    recordChatbot: mergeSection('recordChatbot'),
    opinion: mergeSection('opinion'),
    subject: mergeSection('subject'),
    sports: mergeSection('sports'),
    creative: mergeSection('creative'),
  };

  if (!hasMeaningfulWork(merged)) return null;
  return {
    version: WORK_DRAFT_VERSION,
    savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : '',
    state: merged,
  };
}

export async function loadWorkDraft(): Promise<WorkDraft | null> {
  try {
    const raw = await window.electronAPI.readJsonData(WORK_DRAFT_NAME);
    return parseWorkDraft(raw);
  } catch {
    return null;
  }
}

export async function saveWorkDraft(state: GlobalState): Promise<void> {
  try {
    // 작업 내용이 없는 상태를 굳이 파일로 남기지 않는다. 이미 저장된 초안이 있으면
    // 사용자가 "새로 시작"을 고른 것이므로 빈 값으로 덮어써 정리한다.
    const payload: WorkDraft | Record<string, never> = hasMeaningfulWork(state)
      ? { version: WORK_DRAFT_VERSION, savedAt: new Date().toISOString(), state }
      : {};
    await window.electronAPI.writeJsonData(WORK_DRAFT_NAME, payload);
  } catch {
    // 자동 저장 실패로 작업 흐름을 끊지 않는다(다음 저장 시도에서 다시 기록된다).
  }
}

export async function clearWorkDraft(): Promise<void> {
  try {
    await window.electronAPI.writeJsonData(WORK_DRAFT_NAME, {});
  } catch {
    // 무시 — 다음 자동 저장이 빈 상태를 다시 기록한다.
  }
}

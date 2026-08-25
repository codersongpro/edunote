import { AppMode } from '../types';

const STUDENT_RECORD_GROUP_MODES: readonly AppMode[] = [
  AppMode.GENERATOR,
  AppMode.SUBJECT_GENERATOR,
  AppMode.SPORTS_CLUB_GENERATOR,
  AppMode.CREATIVE_ACTIVITY_GENERATOR,
];

const TEACHER_RECORD_GROUP_MODES: readonly AppMode[] = [
  AppMode.TEACHER_RECORD,
  AppMode.STUDENT_MEMO,
  AppMode.STUDENT_CARD,
];

// 부모 메뉴는 클릭 후 하위 화면 모드로 전환되므로 단순 일치 비교로는 선택 표시가
// 사라진다. 부모가 대표하는 하위 모드까지 포함해 실제 활성 상태를 판단한다.
export function isSidebarModeActive(currentMode: AppMode, menuMode: AppMode): boolean {
  if (menuMode === AppMode.STUDENT_RECORD_GROUP) {
    return STUDENT_RECORD_GROUP_MODES.includes(currentMode);
  }
  if (menuMode === AppMode.TEACHER_RECORD) {
    return TEACHER_RECORD_GROUP_MODES.includes(currentMode);
  }
  return currentMode === menuMode;
}

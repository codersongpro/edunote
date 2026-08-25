import { describe, expect, it } from 'vitest';
import { AppMode } from '../../types';
import { isSidebarModeActive } from '../sidebarNavigation';

describe('isSidebarModeActive', () => {
  it.each([
    AppMode.GENERATOR,
    AppMode.SUBJECT_GENERATOR,
    AppMode.SPORTS_CLUB_GENERATOR,
    AppMode.CREATIVE_ACTIVITY_GENERATOR,
  ])('생기부도우미의 하위 화면 %s에서 부모 메뉴를 선택 상태로 표시한다', currentMode => {
    expect(isSidebarModeActive(currentMode, AppMode.STUDENT_RECORD_GROUP)).toBe(true);
  });

  it.each([
    AppMode.TEACHER_RECORD,
    AppMode.STUDENT_MEMO,
    AppMode.STUDENT_CARD,
  ])('우리반기록의 하위 화면 %s에서 부모 메뉴를 선택 상태로 표시한다', currentMode => {
    expect(isSidebarModeActive(currentMode, AppMode.TEACHER_RECORD)).toBe(true);
  });

  it('일반 메뉴는 현재 화면과 정확히 일치할 때만 선택 상태로 표시한다', () => {
    expect(isSidebarModeActive(AppMode.OFFICIAL_DOC_ANALYZER, AppMode.OFFICIAL_DOC_ANALYZER)).toBe(true);
    expect(isSidebarModeActive(AppMode.OFFICIAL_DOC_ANALYZER, AppMode.SCHOOL_DOC)).toBe(false);
    expect(isSidebarModeActive(AppMode.RECORD_CHATBOT, AppMode.STUDENT_RECORD_GROUP)).toBe(false);
  });
});

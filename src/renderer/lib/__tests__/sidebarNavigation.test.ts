import { describe, expect, it } from 'vitest';
import { AppMode } from '../../types';
import {
  getNavigationSection,
  getNavigationSelectionClass,
  isSidebarModeActive,
} from '../sidebarNavigation';

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

describe('getNavigationSection', () => {
  it.each([
    [AppMode.EDUCATION_QA, 'admin'],
    [AppMode.OFFICIAL_DOC_ANALYZER, 'admin'],
    [AppMode.DOC_TODO, 'admin'],
    [AppMode.SCHOOL_DOC, 'admin'],
    [AppMode.BUDGET_PLANNER, 'admin'],
    [AppMode.DOC_ARCHIVE, 'admin'],
    [AppMode.PRINT_FORM, 'admin'],
    [AppMode.TRANSLATOR, 'admin'],
    [AppMode.LESSON_MATERIAL, 'lesson'],
    [AppMode.CLASS_TOOLS, 'lesson'],
    [AppMode.MY_RESOURCES, 'lesson'],
    [AppMode.RECORD_CHATBOT, 'student'],
    [AppMode.GENERATOR, 'student'],
    [AppMode.SUBJECT_GENERATOR, 'student'],
    [AppMode.SPORTS_CLUB_GENERATOR, 'student'],
    [AppMode.CREATIVE_ACTIVITY_GENERATOR, 'student'],
    [AppMode.TEACHER_RECORD, 'student'],
    [AppMode.STUDENT_MEMO, 'student'],
    [AppMode.STUDENT_CARD, 'student'],
    [AppMode.MY_AI_TOOLS, 'myTools'],
    [AppMode.MY_AI_TOOLS_SHARED, 'myTools'],
  ] as const)('%s 화면을 %s 상위 메뉴의 선택 상태로 분류한다', (currentMode, expectedSection) => {
    expect(getNavigationSection(currentMode)).toBe(expectedSection);
  });

  it('상위 메뉴에 속하지 않는 화면은 선택된 섹션이 없다고 판단한다', () => {
    expect(getNavigationSection(AppMode.HOME)).toBeNull();
    expect(getNavigationSection(AppMode.SETTINGS)).toBeNull();
    expect(getNavigationSection(AppMode.ABOUT)).toBeNull();
  });
});

describe('getNavigationSelectionClass', () => {
  it.each([
    ['admin', 'bg-emerald-600'],
    ['lesson', 'bg-amber-500'],
    ['student', 'bg-indigo-600'],
    ['myTools', 'bg-pink-600'],
  ] as const)('%s 메뉴가 선택되면 영역색 배경과 흰색 글씨를 함께 적용한다', (section, backgroundClass) => {
    const className = getNavigationSelectionClass(section, true);

    expect(className).toContain(backgroundClass);
    expect(className).toContain('text-white');
  });

  it('선택되지 않은 메뉴에는 선택 반전 스타일을 적용하지 않는다', () => {
    expect(getNavigationSelectionClass('admin', false)).toBe('');
  });
});

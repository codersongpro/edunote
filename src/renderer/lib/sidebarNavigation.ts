import { AppMode } from '../types';

export type NavigationSection = 'admin' | 'lesson' | 'student' | 'myTools';

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

const NAVIGATION_SECTION_MODES: Readonly<Record<NavigationSection, readonly AppMode[]>> = {
  admin: [
    AppMode.EDUCATION_QA,
    AppMode.OFFICIAL_DOC_ANALYZER,
    AppMode.DOC_TODO,
    AppMode.SCHOOL_DOC,
    AppMode.BUDGET_PLANNER,
    AppMode.DOC_ARCHIVE,
    AppMode.PRINT_FORM,
    AppMode.TRANSLATOR,
  ],
  lesson: [
    AppMode.LESSON_MATERIAL,
    AppMode.CLASS_TOOLS,
    AppMode.MY_RESOURCES,
  ],
  student: [
    AppMode.RECORD_CHATBOT,
    AppMode.STUDENT_RECORD_GROUP,
    ...STUDENT_RECORD_GROUP_MODES,
    ...TEACHER_RECORD_GROUP_MODES,
  ],
  myTools: [
    AppMode.MY_AI_TOOLS,
    AppMode.MY_AI_TOOLS_SHARED,
  ],
};

const SELECTED_NAVIGATION_CLASSES: Readonly<Record<NavigationSection, string>> = {
  admin: 'border-emerald-600 bg-emerald-600 text-white font-bold shadow-sm',
  lesson: 'border-amber-500 bg-amber-500 text-white font-bold shadow-sm',
  student: 'border-indigo-600 bg-indigo-600 text-white font-bold shadow-sm',
  myTools: 'border-pink-600 bg-pink-600 text-white font-bold shadow-sm',
};

const NAVIGATION_SECTION_HEADER_CLASSES: Readonly<Record<NavigationSection, string>> = {
  admin: 'text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50/80 dark:hover:bg-emerald-900/20',
  lesson: 'text-amber-700 dark:text-amber-300 hover:bg-amber-50/80 dark:hover:bg-amber-900/20',
  student: 'text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50/80 dark:hover:bg-indigo-900/20',
  myTools: 'text-pink-700 dark:text-pink-300 hover:bg-pink-50/80 dark:hover:bg-pink-900/20',
};

const NAVIGATION_TAB_BASE_CLASSES = 'h-full px-4 inline-flex items-center gap-1.5 border-t-2 rounded-t-lg text-sm font-semibold transition-colors';
const INACTIVE_NAVIGATION_TAB_CLASSES = 'border-transparent text-[#78716C] dark:text-[#9C8F87] hover:text-[#44403C] dark:hover:text-[#C4B8B0] hover:bg-[#FAF9F7] dark:hover:bg-[#2A2420]';

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

// 현재 화면이 속한 상위 메뉴를 한 곳에서 판단해 펼친 사이드바와 접힌 메뉴,
// 화면 상단 탭이 서로 다른 선택 상태를 표시하지 않도록 한다.
export function getNavigationSection(currentMode: AppMode): NavigationSection | null {
  const matched = (Object.keys(NAVIGATION_SECTION_MODES) as NavigationSection[])
    .find(section => NAVIGATION_SECTION_MODES[section].includes(currentMode));
  return matched ?? null;
}

// 선택된 메뉴는 영역색 배경과 흰색 글씨를 반드시 함께 사용한다.
// 클래스명을 정적 문자열로 보관해 Tailwind 빌드에서도 누락되지 않게 한다.
export function getNavigationSelectionClass(section: NavigationSection, selected: boolean): string {
  return selected ? SELECTED_NAVIGATION_CLASSES[section] : '';
}

// 상위 영역은 메뉴 묶음을 구분하는 용도이므로 하위 메뉴와 같은 선택 음영을 쓰지 않는다.
export function getNavigationSectionHeaderClass(section: NavigationSection): string {
  return NAVIGATION_SECTION_HEADER_CLASSES[section];
}

// 화면 내부 탭은 버튼 전체 높이와 가로 여백을 선택 영역으로 사용한다.
export function getNavigationTabClass(section: NavigationSection, selected: boolean): string {
  return `${NAVIGATION_TAB_BASE_CLASSES} ${
    selected ? SELECTED_NAVIGATION_CLASSES[section] : INACTIVE_NAVIGATION_TAB_CLASSES
  }`;
}

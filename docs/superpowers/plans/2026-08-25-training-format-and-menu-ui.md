# 연수자료 말머리·메뉴 선택 UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 연수자료를 계획서와 같은 `1. → 가. → 1) → 가)` 말머리와 명사형 문체로 생성하고, 사이드바는 하위 메뉴만 선택 강조하며, AI 스킬즈 내부 탭은 전체 버튼 범위가 선택되도록 수정함.

**Architecture:** 생성 품질은 연수자료 전용 프롬프트와 공통 문서 구조 지침의 충돌을 함께 제거하여 보장함. 메뉴 UI는 `sidebarNavigation.ts`에 상위 영역의 중립 스타일과 전체 높이 탭 스타일을 순수 함수로 정의하고 실제 화면이 이를 사용하도록 하여 회귀 테스트가 사용자 표시 원칙을 직접 검증하도록 구성함.

**Tech Stack:** Electron, React 19, TypeScript, Tailwind CSS, Vitest

**Spec:** 현재 작업 대화에서 사용자가 승인한 범위가 정해진 설계(별도 설계 문서 없음)

## Global Constraints

- 연수자료의 필수 항목과 선택 체크박스 동작은 변경하지 않음.
- 계획서의 내용 구성이 아니라 말머리 위계만 연수자료에 적용함.
- 상위 메뉴의 펼치기·접기와 영역별 색상 아이콘은 유지함.
- 하위 메뉴·즐겨찾기·접힌 사이드바·화면 탭의 기존 선택 표시는 유지함.
- 새 의존성을 추가하지 않음.
- 테스트를 먼저 실패시킨 뒤 최소 구현으로 통과시킴.

---

### Task 1: 연수자료 말머리와 명사형 문체 고정

**Files:**
- Modify: `src/renderer/lib/__tests__/trainingMaterial.test.ts`
- Modify: `src/renderer/lib/trainingMaterial.ts`
- Modify: `src/renderer/constants.ts`

**Interfaces:**
- Consumes: `buildTrainingMaterialInstruction(sections, pageCount): string`
- Produces: 계획서형 4단계 말머리와 명사형 종결 규칙을 포함하는 연수자료 작성 지시문

- [ ] **Step 1: 실패하는 프롬프트 계약 테스트 작성**

```ts
it('계획서와 같은 4단계 말머리와 명사형 종결을 요구한다', () => {
  const instruction = buildTrainingMaterialInstruction(
    DEFAULT_TRAINING_MATERIAL_SECTIONS,
    2,
  );

  expect(instruction).toContain('1단계(대항목): 1.  2.  3.');
  expect(instruction).toContain('2단계(중항목): 가.  나.  다.');
  expect(instruction).toContain('3단계(소항목): 1)  2)  3)');
  expect(instruction).toContain('4단계(세항목): 가)  나)  다)');
  expect(instruction).toContain('모든 문장과 개조식 항목은 명사형으로 끝내세요');
  expect(instruction).toContain('"~합니다", "~입니다", "~됩니다", "~해야 합니다" 종결은 사용하지 마세요');
});
```

- [ ] **Step 2: 테스트가 요구사항 부재로 실패하는지 확인**

Run: `npm.cmd test -- src/renderer/lib/__tests__/trainingMaterial.test.ts`

Expected: 새 테스트가 4단계 말머리 또는 명사형 강제 문구를 찾지 못해 FAIL

- [ ] **Step 3: 연수자료 전용 지침에 최소 규칙 추가**

`buildTrainingMaterialInstruction`의 `[서식]` 블록을 다음 원칙으로 보강함.

```text
[항목 기호 4단계 위계 — 반드시 준수]
  1단계(대항목): 1.  2.  3.  ...
  2단계(중항목): 가.  나.  다.  ...
  3단계(소항목): 1)  2)  3)  ...
  4단계(세항목): 가)  나)  다)  ...
- 실제로 생성하는 핵심 주제와 선택 항목만 1번부터 연속 번호를 부여함.
- 모든 문장과 개조식 항목은 명사형으로 끝냄.
- "~합니다", "~입니다", "~됩니다", "~해야 합니다" 종결 금지.
```

공통 `SYSTEM_INSTRUCTION`의 오래된 로마숫자 8단 연수자료 구조도 현재 필수·선택 구조와 같은 4단계 말머리 설명으로 교체하여 지시 충돌을 제거함.

- [ ] **Step 4: 연수자료 테스트 통과 확인**

Run: `npm.cmd test -- src/renderer/lib/__tests__/trainingMaterial.test.ts`

Expected: PASS

---

### Task 2: 상위 메뉴 중립 표시와 AI 스킬즈 전체 탭 선택 영역

**Files:**
- Modify: `src/renderer/lib/__tests__/sidebarNavigation.test.ts`
- Modify: `src/renderer/lib/sidebarNavigation.ts`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/components/MyToolsScreen.tsx`

**Interfaces:**
- Produces: `getNavigationSectionHeaderClass(section: NavigationSection): string`
- Produces: `getNavigationTabClass(section: NavigationSection, selected: boolean): string`
- Preserves: `getNavigationSection`, `getNavigationSelectionClass`, `isSidebarModeActive`

- [ ] **Step 1: 실패하는 메뉴 표시 계약 테스트 작성**

```ts
it.each([
  ['admin', 'text-emerald-700', 'bg-emerald-600'],
  ['lesson', 'text-amber-700', 'bg-amber-500'],
  ['student', 'text-indigo-700', 'bg-indigo-600'],
  ['myTools', 'text-pink-700', 'bg-pink-600'],
] as const)('%s 상위 메뉴는 영역색 글씨만 사용하고 선택 음영을 사용하지 않는다', (section, textClass, selectedBackground) => {
  const className = getNavigationSectionHeaderClass(section);
  expect(className).toContain(textClass);
  expect(className).not.toContain(selectedBackground);
  expect(className).not.toContain('text-white');
});

it('AI 스킬즈 선택 탭은 버튼 전체 높이와 가로 여백을 채운다', () => {
  const className = getNavigationTabClass('myTools', true);
  expect(className).toContain('h-full');
  expect(className).toContain('px-4');
  expect(className).toContain('rounded-t-lg');
  expect(className).toContain('bg-pink-600');
  expect(className).toContain('text-white');
});
```

- [ ] **Step 2: 새 스타일 함수 부재로 테스트가 실패하는지 확인**

Run: `npm.cmd test -- src/renderer/lib/__tests__/sidebarNavigation.test.ts`

Expected: 새 함수가 export되지 않아 FAIL

- [ ] **Step 3: 순수 스타일 함수 최소 구현**

```ts
export function getNavigationSectionHeaderClass(section: NavigationSection): string {
  return NAVIGATION_SECTION_HEADER_CLASSES[section];
}

export function getNavigationTabClass(section: NavigationSection, selected: boolean): string {
  return `${NAVIGATION_TAB_BASE_CLASSES} ${selected
    ? SELECTED_NAVIGATION_CLASSES[section]
    : INACTIVE_NAVIGATION_TAB_CLASSES}`;
}
```

상위 영역별 헤더 클래스는 연한 영역색·호버만 포함하고 진한 선택 배경과 흰색 글씨를 포함하지 않음. 탭 기본 클래스는 `h-full px-4 inline-flex items-center gap-1.5 border-t-2 rounded-t-lg`를 포함함.

- [ ] **Step 4: 실제 화면에 공통 스타일 적용**

- `App.tsx`: 네 상위 영역 헤더에서 현재 mode에 따른 진한 선택 분기를 제거하고 `getNavigationSectionHeaderClass` 사용
- `App.tsx`: 상위 아이콘은 기존 영역색 배경, 학교급 배지는 기존 연한 배경을 항상 유지
- `MyToolsScreen.tsx`: 탭 컨테이너를 `h-12 items-stretch gap-0`으로 바꾸고 버튼에 `getNavigationTabClass` 적용
- 하위 메뉴의 `getNavigationSelectionClass` 사용은 그대로 유지

- [ ] **Step 5: 메뉴 회귀 테스트 통과 확인**

Run: `npm.cmd test -- src/renderer/lib/__tests__/sidebarNavigation.test.ts`

Expected: PASS

---

### Task 3: 문서·버전 갱신과 전체 검증

**Files:**
- Modify: `package.json`
- Modify: `RELEASE_NOTES.md`
- Modify: `docs/EduNote_개발일지.md`
- Modify: `docs/EduNote_사용자매뉴얼.md`
- Modify: `src/renderer/components/UsageGuideScreen.tsx`

**Interfaces:**
- Produces: v1.22.4 변경 이력과 사용자용 설명

- [ ] **Step 1: 사용자 안내 문구 갱신**

- 연수자료가 계획서의 내용 구성이 아니라 `1. → 가. → 1) → 가)` 말머리만 따름을 명시
- 연수자료의 명사형 종결과 선택 항목 동작을 설명
- 상위 메뉴는 영역 구분만 하고 실제 선택은 하위 메뉴에 표시됨을 설명
- AI 스킬즈 내부 탭이 버튼 전체 범위로 선택됨을 기록

- [ ] **Step 2: 버전과 릴리즈 문서 갱신**

- `package.json` 버전을 `1.22.4`로 변경
- `RELEASE_NOTES.md` 최상단에 v1.22.4 항목 추가
- 개발일지에 원인·수정 범위·검증 결과 추가

- [ ] **Step 3: 관련 테스트를 함께 실행**

Run: `npm.cmd test -- src/renderer/lib/__tests__/trainingMaterial.test.ts src/renderer/lib/__tests__/sidebarNavigation.test.ts`

Expected: 두 테스트 파일 모두 PASS

- [ ] **Step 4: 전체 정적·자동 검증 실행**

Run: `npm.cmd test`

Expected: 모든 테스트 PASS

Run: `npm.cmd run typecheck`

Expected: exit code 0

Run: `npm.cmd run build`

Expected: Electron production bundle 생성 성공

Run: `git diff --check`

Expected: 오류 없음

- [ ] **Step 5: 변경 범위 검토**

`git diff --stat`과 `git status --short`로 위에 명시한 파일만 변경되었는지 확인하고, 원격 푸시·병합·릴리즈는 사용자의 별도 요청 전에는 실행하지 않음.

---

### Task 4: 랜딩페이지의 사용자용 GitHub 링크 제거

**Files:**
- Create: `src/renderer/lib/__tests__/landingPage.test.ts`
- Modify: `docs/index.html`
- Modify: `RELEASE_NOTES.md`
- Modify: `docs/EduNote_개발일지.md`

**Interfaces:**
- Preserves: `#heroDownloadBtn`, `#downloadBtn`, 자동 릴리즈 버전·파일명·용량 주입 로직
- Removes: `GitHub에서 보기`, `GitHub 프로필` 링크

- [ ] **Step 1: 실제 랜딩페이지 DOM을 검증하는 실패 테스트 작성**

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const html = readFileSync(resolve(process.cwd(), 'docs/index.html'), 'utf8');
const landingPage = new DOMParser().parseFromString(html, 'text/html');

describe('랜딩페이지 외부 링크', () => {
  it('GitHub 보기와 프로필 링크는 숨기고 Windows 다운로드는 유지한다', () => {
    const linkLabels = Array.from(landingPage.querySelectorAll('a'))
      .map(link => link.textContent?.trim());

    expect(linkLabels).not.toContain('GitHub에서 보기');
    expect(linkLabels).not.toContain('GitHub 프로필');
    expect(landingPage.querySelector<HTMLAnchorElement>('#heroDownloadBtn')?.href)
      .toContain('/releases/download/');
    expect(landingPage.querySelector<HTMLAnchorElement>('#downloadBtn')?.href)
      .toContain('/releases/download/');
  });
});
```

- [ ] **Step 2: 현재 두 링크 때문에 테스트가 실패하는지 확인**

Run: `npm.cmd test -- src/renderer/lib/__tests__/landingPage.test.ts`

Expected: `GitHub에서 보기` 또는 `GitHub 프로필`이 DOM에 남아 있어 FAIL

- [ ] **Step 3: 링크 두 개만 제거**

- 히어로 CTA에서 저장소 보기 `<a>` 제거
- 개발자 소개 링크에서 GitHub 프로필 `<a>` 제거
- 다운로드 링크와 피드백 링크는 유지
- 사용하지 않게 된 공통 `.btn-ghost` 스타일은 다른 요소의 사용 여부를 확인하고, 아직 쓰이면 유지

- [ ] **Step 4: 랜딩페이지 테스트 통과 확인**

Run: `npm.cmd test -- src/renderer/lib/__tests__/landingPage.test.ts`

Expected: PASS

- [ ] **Step 5: v1.22.4 문서에 링크 정리 기록 후 전체 테스트 재실행**

Run: `npm.cmd test`

Expected: 모든 테스트 PASS

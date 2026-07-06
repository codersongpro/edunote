# 작업 규칙

## 노출 금지 사항 (반드시 준수)
- 커밋 메시지, PR 제목/본문, 코드 주석, 파일명, README 등 저장소에 올라가는 모든 곳에 **"claude", "Claude", "Anthropic"** 단어를 절대 포함하지 않는다.
- 단, 브랜치 이름은 예외로 한다 — 작업 환경(세션)이 자동으로 "claude"가 포함된 브랜치명을 할당하는 경우가 있으며, 이런 경우 해당 브랜치명을 그대로 사용해도 된다.

## 전역 행동 지침 (모든 프로젝트 공통)
- 모든 답변은 한국어로 작성한다.
- 기존 코드를 대폭 수정하거나 파일 삭제 전에는 반드시 사용자 승인을 받는다.
- 복잡한 기능은 코드 작성 전 구현 계획을 먼저 제시한다.
- 코드 설명은 코딩 초보자도 이해할 수 있도록 상세히 한국어로 설명한다.
- 코드 출력 시 생략 없이 전체 코드를 제공한다 (`// ... 기존 코드 ...` 형태 금지).
- 한 번에 하나의 기능만 수정하고, 확인 후 다음 단계로 넘어간다.
- **빌드(build) 및 릴리즈(release)는 사용자에게 먼저 물어보고 진행한다. 임의로 실행하지 않는다.**
- **앱 기능이 추가·변경될 때마다 아래 문서를 함께 업데이트한다 (코드 커밋 전 또는 직후):**
  - `RELEASE_NOTES.md` — 현재 버전 섹션의 해당 기능 설명 추가
  - `docs/EduNote_개발일지.md` — 업데이트 이력 테이블 및 버전 서술 단락 반영
  - `docs/EduNote_사용자매뉴얼.md` — 관련 사용 방법 섹션 업데이트

## 검증·환경 효율 규칙 (토큰 낭비 방지, 반드시 준수)

반복 세션에서 의존성 재설치, PowerShell 권한 오류 우회 등으로 토큰이 낭비되는 것을 막기 위한 규칙이다.

### 의존성 설치 — 필요할 때만
- 검증·테스트 전에 습관적으로 `npm install`을 실행하지 않는다. **`node_modules` 폴더가 존재하면 설치를 건너뛴다.**
- 설치가 필요한 경우는 두 가지뿐이다: (1) `node_modules`가 없을 때, (2) `package.json` 또는 `package-lock.json`이 변경되었을 때.
- "Cannot find module" 오류가 실제로 발생했을 때만 설치를 시도하고, 같은 세션에서 설치를 반복하지 않는다.

### Windows / PowerShell 오류 — 우회를 표준화
- PowerShell에서 `npm` 실행 시 "스크립트 실행이 비활성화되어 있으므로..." (ExecutionPolicy) 오류가 나면, **정책 변경을 시도하지 말고 즉시 `npm.cmd <명령>` 또는 `cmd /c npm <명령>`으로 실행한다.** 처음부터 이 형태로 실행해도 된다.
- 관리자 권한이 필요한 작업(electron-builder 패키징 시 winCodeSign 심볼릭 링크 등)은 일반 셸에서 시도하지 않는다. 패키징은 `build.bat`을 사용한다(자동으로 관리자 권한을 요청함). 어차피 빌드·릴리즈는 사용자 승인이 먼저다.
- 파일 삭제·복사 등 단순 작업에서 권한 오류가 나면 다른 방법을 3가지 이상 시도하지 말고, 필요한 명령을 사용자에게 알려주고 직접 실행을 요청한다.

### 검증 절차 — 표준 2단계
- 코드 수정 후 검증은 다음 두 가지로 충분하다: **1) `npm run typecheck` 2) `npm test`**
- 검증 목적으로 `npm run build`, `dist`, `build:win`을 실행하지 않는다 (빌드는 사용자 승인 필요 규칙과 동일).
- 한 기능을 반복 수정하는 중에는 해당 테스트 파일만 실행하고(`npx vitest run <파일경로>`), 전체 테스트는 마지막에 1회만 실행한다.

### 실패 시 — 우회 반복 금지
- 같은 접근이 **2회 실패하면** 제3, 제4의 우회를 계속 시도하지 않는다. 실패 원인과 시도한 내용을 요약해 사용자에게 확인을 요청한다.
- 환경 문제(권한, 네트워크, 설치 실패)로 검증이 불가능하면, 우회를 반복하는 대신 "무엇을 검증하지 못했는지"를 명시하고 사용자 판단에 맡긴다.

---

## Behavioral guidelines to reduce common LLM coding mistakes.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

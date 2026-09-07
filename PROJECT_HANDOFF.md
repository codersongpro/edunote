# EduNote 개선 작업 인수인계

마지막 갱신: 2026-09-07

저장소: `https://github.com/codersongpro/edunote.git`

작업 브랜치: `main`

앱 버전: `1.26.3`

개선 코드 기준 커밋: `4c52e62`

## 1. 현재 상태

`edunote-improvement-instructions.md`에서 구현 대상으로 정한 F01~F09와 Q01~Q09의 코드 수정과 자동 검증을 완료했다. N01~N10은 추가 기능 제안이므로 이번 구현에 포함하지 않았다.

마지막 자동 검증 결과는 다음과 같다.

- `npm test -- --run`: 66개 테스트 파일, 613개 테스트 통과
- `npm run typecheck`: 통과
- `npm run build`: Electron main, preload, renderer 프로덕션 빌드 통과
- 앱 버전 변경, 릴리스 생성, 배포는 수행하지 않음

## 2. 완료한 작업

| 작업 | 상태 | 주요 내용 | 커밋 |
|---|---|---|---|
| F01 | 완료 | 학생 삭제 후 지연 저장이나 이전 상태로 삭제 자료가 복원되지 않게 수정 | `d83b5e9` |
| F02 | 완료 | 개별 재생성 결과가 현재 학생·과목·편집 상태와 다르면 반영하지 않음 | `a1133f7` |
| F03 | 완료 | 나이스 성적 판독 실패나 누락을 임의 성취수준으로 바꾸지 않음 | `64b42e3` |
| F04 | 완료 | 빈 응답, 차단 응답, 잘린 응답 등 완료되지 않은 생성 결과를 저장하지 않음 | `8de6154` |
| F05 | 완료 | 백업 생성 전에 복원 가능성과 5 MiB 제한을 검사 | `129e1ea` |
| F06 | 완료 | 외부 자료 다운로드의 헤더 크기와 누적 수신 크기를 모두 제한 | `09d06dc` |
| F07 | 완료 | 생성 이력을 모드뿐 아니라 과목·활동 맥락별로 분리 | `2a059aa` |
| F08 | 완료 | 설정의 검토 체크리스트를 실제 생성 결과 화면에 연결 | `2a67427` |
| F09 | 완료 | 공식 모델 목록·지원 기능을 검사하고 무료 Flash 우선, 최신 Lite 안전 후보 순으로 선택 | `6081dba`, `81341a3`, `499c21f` |
| Q01 | 완료 | 학생 기록을 실제 관찰 근거 중심으로 작성하고 근거 없는 성장·역량 추정을 금지 | `3ed6254` |
| Q02 | 완료 | 슬라이드 수·필드와 퀴즈 유형·보기·정답 구조를 코드에서 검증 | `20e57b2` |
| Q03 | 완료 | 미입력 일정·금액·인용문·공고번호를 만들어 채우지 않도록 수정 | `aa4889a` |
| Q04 | 완료 | 문서 유형별 프롬프트 충돌을 줄이고 사용자 양식·명시 형식을 우선 | `fd6420c` |
| Q05 | 완료 | HTML 목록 위계와 내어쓰기 정규화, 중복 들여쓰기 방지 | `a1401d8` |
| Q06 | 완료 | HWPX 문단 위계, 번호 목록, 들여쓰기와 글자 크기 보존 | `d774a3e` |
| Q07 | 완료 | HTML을 Markdown으로 저장할 때 제목·중첩 목록·표 구조 보존 | `20fa550` |
| Q08 | 완료 | 학년별 지시 충돌 제거, 성취기준 원문 분리, 수업 시간 우선순위와 목표-활동-평가 연계 | `9d8068b` |
| Q09 | 완료 | 활동형 워크시트와 평가지 목적 분리, 학생용 정답·해설·숨김 블록 차단 | `4c52e62` |

## 3. Gemini 무료 모델 전환 동작

- 무료 사용에서는 검증된 Flash 후보를 먼저 사용한다.
- Flash의 할당량 초과나 사용 불가 오류가 발생하면 검증된 Lite 후보로 자동 전환한다.
- Lite 후보가 여러 개면 공식 모델 목록에서 확인된 최신 버전을 우선한다.
- 스트리밍 도중 할당량을 초과해도 불완전한 앞부분을 최종 결과로 사용하지 않고 다음 후보에서 생성을 다시 시작한다.
- 화면에는 실제 사용 모델과 자동 전환 사실을 안내한다.
- 모든 후보의 할당량 소진, 키 오류, 네트워크 장애까지 포함한 절대적인 생성 성공은 보장할 수 없다. 이 경우 불완전한 결과를 저장하지 않고 명시적 오류를 표시한다.

관련 파일:

- `src/main/modelChain.ts`
- `src/main/GeminiService.ts`
- `src/main/apiKeySelection.ts`
- `src/renderer/lib/modelFallbackNotice.ts`
- `src/renderer/components/ModelDiagnosticsPanel.tsx`

## 4. 다른 컴퓨터에서 이어서 시작하기

```bash
git clone https://github.com/codersongpro/edunote.git
cd edunote
git checkout main
git pull --ff-only origin main
npm ci
npm run typecheck
npm test -- --run
npm run build
```

이미 저장소가 있다면 변경 중인 파일을 먼저 보존한 뒤 다음 명령으로 상태를 확인한다.

```bash
git status
git fetch origin
git log --oneline --decorate -10 origin/main
git pull --ff-only origin main
```

## 5. 남은 작업

아래 항목은 자동 테스트와 정적 검증만으로 확정할 수 없어 실제 프로그램이나 외부 서비스에서 확인해야 한다.

### 우선순위 1: 실제 Gemini 무료 API 전환 확인

- 유효한 무료 API 키로 Flash 정상 생성 확인
- Flash 할당량 초과 시 최신 Lite 후보로 자동 전환되는지 확인
- 스트리밍 도중 할당량 초과를 재현하고, 불완전한 Flash 결과가 저장되지 않으며 Lite 결과만 최종 반영되는지 확인
- 모든 후보 실패 시 오류 안내와 기존 결과 보존 확인
- 진단 화면의 후보 순서와 실제 요청 순서가 같은지 확인

API 키는 저장소나 로그에 기록하지 말고 앱 설정 또는 기존 보안 저장 경로만 사용한다.

### 우선순위 2: 실제 문서 출력의 시각 검수

- 한컴오피스에서 HWPX를 열어 1~7단계 목록, 번호, 내어쓰기, 표 안 목록을 확인
- Word 또는 Markdown 편집기에서 제목, 중첩 목록, 시작 번호, 표 변환을 확인
- 초등학교 1학년 활동 2개, 초등학교 6학년 서술 활동 5개, 그림 포함 활동 10개를 생성
- 워크시트와 평가지를 PDF로 인쇄해 글자 크기, 답안 공간, 실제 쪽수를 확인
- 앱의 쪽수 표시는 추정치이므로 실제 인쇄 결과와 다르면 추정 로직을 보정

### 우선순위 3: 주요 화면 수동 회귀 확인

- 학생 삭제 직후 과목 이동·앱 재실행을 해도 학생이 되살아나지 않는지 확인
- 학생 또는 과목을 빠르게 바꾸며 개별 재생성했을 때 결과가 다른 카드에 들어가지 않는지 확인
- 백업 생성·복원, 제한을 넘는 첨부 다운로드, 생성 이력 전환을 실제 UI에서 확인
- 검토 체크리스트가 학생 기록, 교과·창체, 수업자료 결과 화면에서 정상 작동하는지 확인
- 워크시트와 평가지의 안내 문구, 활동/문항 수 라벨, 초과 분량 안내를 확인

### 별도 결정이 필요한 작업

- 초등학교 1학년 과목 목록의 `안전한 생활`과 성취기준 데이터의 `건강한 생활` 불일치는 수정하지 않았다. 공식 교육과정 자료와 적용 학년도를 확인한 뒤 별도 작업으로 결정한다.
- N01~N10은 신규 기능 제안이다. 구현하려면 항목별 범위와 우선순위를 새로 정한다.
- 버전 상승, GitHub Release, 설치 파일 배포, Vercel 배포는 별도 승인 후 진행한다.

## 6. 주요 검증 파일

- `src/main/__tests__/GeminiService.modelSelection.test.ts`
- `src/main/__tests__/generationResponseValidation.test.ts`
- `src/main/__tests__/modelChain.test.ts`
- `src/renderer/services/__tests__/geminiService.lessonPrompt.test.ts`
- `src/renderer/services/__tests__/geminiService.lessonValidation.test.ts`
- `src/renderer/services/__tests__/geminiService.worksheetPrompt.test.ts`
- `src/renderer/lib/__tests__/regenerationResult.test.ts`
- `src/main/__tests__/hwpxGenerator.test.ts`
- `src/renderer/lib/__tests__/htmlToMarkdown.test.ts`

## 7. 작업 시 주의사항

- 현재 구조와 사용자 문구를 유지하고 요청 범위 밖 리팩터링을 섞지 않는다.
- 실제 Gemini 응답, 자동 테스트, 문서 시각 검증을 서로 다른 증거 수준으로 기록한다.
- 결과가 불완전하거나 형식 검증에 실패하면 성공 결과로 저장하지 않는다.
- 학생용 워크시트와 평가지에 교사용 정답·해설을 HTML 주석이나 숨김 CSS로 넣지 않는다.
- HWPX XML 생성 성공만으로 한컴오피스의 시각 결과가 맞다고 판단하지 않는다.
- 변경 후 최소한 타입 검사, 전체 테스트, 프로덕션 빌드를 다시 실행한다.

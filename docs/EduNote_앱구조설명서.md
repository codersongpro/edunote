# EduNote 앱 구조 및 메커니즘 설명서

작성 기준: 2026년 7월 24일
대상 버전: EduNote v1.18.4
목적: 다른 AI 또는 개발자가 EduNote의 구조, 기능, 동작 방식을 빠르게 이해하기 위한 기술 설명 자료

---

## 1. 앱 개요

EduNote는 교사의 학생기록 작성, 교무행정 문서 작성, 수업자료 제작, 공문 업무추출, 자료 관리 업무를 하나의 Windows 데스크톱 앱에서 처리하기 위해 만든 Electron (웹 기술로 만든 Windows 데스크톱 앱 프레임워크) 기반 애플리케이션이다.

앱은 React (화면을 구성하는 자바스크립트 라이브러리) 화면을 Electron 데스크톱 환경에서 실행하며, Gemini API (구글이 제공하는 AI 서비스)를 통해 학생기록, 공문서, 수업자료, 업무 메모 등을 생성한다. 생성 결과는 HTML, PDF, TXT, CSV, HWPX 형식 등으로 저장하거나 앱 내부에서 편집할 수 있다.

---

## 2. 앱 화면 구조

사이드바에 표시되는 메뉴 전체를 트리 형태로 나타낸다. 사용자는 이 메뉴를 클릭해 각 기능 화면으로 이동한다.

```
EduNote
├─ [즐겨찾기]                   ← 각 메뉴 항목의 ☆ 버튼으로 고정한 메뉴만 모아 상단에 표시 (localStorage, 이 PC 전용)
├─ 홈
├─ 사용 방법
├─ 도움말 / 정보
├─ 설정
│
├─ [교무행정AI]
│  ├─ 교무행정AI 챗봇
│  ├─ 공문요약·업무추출
│  ├─ 공문 할일                ← 공문요약에서 저장한 업무의 마감일·완료 상태 관리
│  ├─ 문서작성기             ← 9종 문서 생성 (탭 전환)
│  ├─ 공문 보관함               ← 공문 캡처·첨부 저장·검색
│  ├─ 양식 인쇄                 ← 학교 양식 10종 직접 편집·PDF/HWPX 저장
│  ├─ 예산안작성                ← 제목 주제 분석 기반 예산안 생성·0원 맞추기
│  └─ 간단 번역                 ← 안내문·문자·알림장 문구 다국어 번역
│
├─ [수업자료AI]
│  ├─ 수업자료 생성             ← 슬라이드·워크시트·퀴즈·수업계획서
│  ├─ 수업 도구                ← 탭 전환 (ClassToolsPanel)
│  │  ├─ QR 메이커
│  │  ├─ 럭키드로우
│  │  └─ 채팅방                ← Firebase 기반 QR 참여방 개설·관리(ChatRoom, manage 모드). 방 시작 시 대화 전용 새 창(#chat)이 자동으로 열림
│  └─ 나만의 자료실
│
├─ [학생기록AI]
│  ├─ 학생기록AI 챗봇           ← 생활기록부 기재요령 질의응답
│  ├─ 생기부도우미              ← 트리 서브메뉴
│  │  ├─ 행발생성              ← 행동특성 및 종합의견
│  │  ├─ 교과 세특 생성
│  │  ├─ 학교스포츠클럽
│  │  └─ 창체 특기사항
│  └─ 우리반기록               ← 트리 서브메뉴
│     ├─ 수업관찰기록
│     ├─ 상담일지
│     ├─ 학급경영일지
│     ├─ 학생 메모 보드
│     └─ 학생 카드                ← 학생별 이력·메모 통합 조회 (AI 호출 없음)
│
└─ [AI 스킬즈]                  ← 하위메뉴 드래그 정렬 지원
   ├─ 내 스킬                  ← 스킬 목록·실행·수정·공유, HTML 앱 만들기(HtmlAppCreator) (MY_AI_TOOLS)
   └─ 스킬마켓             ← 마켓에서 가져오기 (MY_AI_TOOLS_SHARED)

사이드바 하단: Demo (별도 창으로 열림, #demo)
```

생기부도우미 4개 생성기(행발생성·교과 세특·학교스포츠클럽·창체 특기사항)는 모두 관찰 내용 입력칸 옆에 "📷 학생 기록물 업로드(사진/스캔 자동 분석)" 버튼을 제공하며, 결과 카드에는 글자수·바이트수와 실제 생성에 사용된 AI 모델명 배지가 함께 표시된다(9.1·9.6절 참고).

---

## 3. 전체 기술 스택

| 영역 | 사용 기술 | 역할 |
| --- | --- | --- |
| 데스크톱 런타임 | Electron 43 | Windows 앱 창, 파일 저장, PDF 출력, 외부 브라우저 열기, 로컬 데이터 접근, safeStorage 암호화 |
| 프론트엔드 | React 19, TypeScript, TSX | 앱 화면 구성, 메뉴 전환, 생성 결과 표시, 입력 폼 처리 |
| 빌드 도구 | electron-vite, Vite | main, preload, renderer 빌드 |
| 테스트 | Vitest, jsdom | 순수 로직·화면 렌더링 단위 테스트 (2026-07 기준 약 190건) |
| 스타일 | Tailwind CSS, PostCSS | 화면 레이아웃, 다크모드, 버튼, 카드, 입력창 스타일 |
| AI SDK | @google/genai | Gemini API 호출, 텍스트·이미지·파일 입력 처리, 모델 폴백 체인 |
| 로컬 저장 | electron-store, JSON 파일 | 사용자 설정, 학생 명단, 자료실, 학생 메모, 백업 데이터 저장 |
| 시크릿 저장 | Electron safeStorage | Gemini·나라장터·네이버 API 키를 OS 자격 증명 저장소로 암호화 보관 |
| 문서 처리 | HTML, CSS, Electron printToPDF | 공문서, 수업자료, 워크시트, PDF 저장 |
| HWPX 저장 | JSZip, @xmldom/xmldom | HWPX 내부 XML 생성·분석, 줄 배치 정보(lineseg), 표(hp:tbl)·서식 변환, 골격 기반 재포장 |
| 마크다운 렌더링 | react-markdown, remark, remark-gfm, remark-rehype, rehype-stringify | 챗봇·생성 결과의 마크다운·HTML 렌더링 판별 및 변환 |
| 실시간 채팅 | firebase (Firestore, Auth) | 채팅방(수업 참여방) 메시지·참여자 실시간 동기화, 교사 계정 없이 익명 인증 |
| 아이콘 | lucide-react | 메뉴 및 버튼 아이콘 |
| QR 생성 | qrcode | QR 메이커, 채팅방 참여 QR 코드 |
| 배포 | electron-builder, GitHub Actions, GitHub Releases | Windows portable EXE 자동 빌드 및 배포 |

---

## 4. 디렉터리 트리

```text
edunote
├─ package.json
├─ package-lock.json
├─ electron.vite.config.ts
├─ electron-builder.yml
├─ RELEASE_NOTES.md
├─ THIRD-PARTY-NOTICES.md
├─ docs
│  ├─ EduNote_개발일지.md
│  ├─ EduNote_앱구조설명서.md
│  ├─ EduNote_사용자매뉴얼.md
│  └─ chat
│     └─ index.html          ← 학생용 채팅방 접속 페이지 (교사 앱과 별도로 정적 호스팅)
├─ build
│  ├─ icon.ico
│  ├─ icon.png
│  └─ icon.svg
├─ src
│  ├─ main
│  │  ├─ index.ts
│  │  ├─ ipcHandlers.ts
│  │  ├─ ipcValidation.ts
│  │  ├─ GeminiService.ts
│  │  ├─ modelChain.ts
│  │  ├─ groundingSources.ts
│  │  ├─ eduReferenceSearch.ts
│  │  ├─ requestPacer.ts
│  │  ├─ streamGuard.ts
│  │  ├─ HwpxGenerator.ts
│  │  ├─ hwpxSkeleton.ts
│  │  ├─ secretStore.ts
│  │  ├─ configValidation.ts
│  │  ├─ netGuard.ts
│  │  ├─ pathSafety.ts
│  │  ├─ versionCompare.ts
│  │  ├─ store.ts
│  │  └─ __tests__/           ← 위 모듈별 단위 테스트
│  ├─ preload
│  │  ├─ index.ts
│  │  └─ types.d.ts
│  └─ renderer
│     ├─ index.html
│     ├─ index.tsx
│     ├─ App.tsx
│     ├─ types.ts
│     ├─ constants.ts
│     ├─ GlobalStateContext.tsx
│     ├─ TourContext.tsx
│     ├─ assets.d.ts
│     ├─ index.css
│     ├─ assets
│     │  └─ icon.png
│     ├─ components
│     │  ├─ HomeScreen.tsx
│     │  ├─ UsageGuideScreen.tsx
│     │  ├─ AboutScreen.tsx
│     │  ├─ SettingsScreen.tsx
│     │  ├─ RecordChatbot.tsx
│     │  ├─ OpinionGenerator.tsx
│     │  ├─ SubjectGenerator.tsx
│     │  ├─ SportsClubGenerator.tsx
│     │  ├─ CreativeActivityGenerator.tsx
│     │  ├─ EducationAssistantQA.tsx
│     │  ├─ OfficialDocAnalyzer.tsx
│     │  ├─ SchoolDocPanel.tsx
│     │  ├─ DocArchivePanel.tsx
│     │  ├─ DocTodoPanel.tsx
│     │  ├─ PrintFormScreen.tsx
│     │  ├─ BudgetPlannerScreen.tsx
│     │  ├─ TranslatorScreen.tsx
│     │  ├─ LessonMaterialGenerator.tsx
│     │  ├─ ClassToolsPanel.tsx
│     │  ├─ TeacherRecordPanel.tsx
│     │  ├─ LessonObservationGenerator.tsx
│     │  ├─ CounselingLogGenerator.tsx
│     │  ├─ ClassManagementLogGenerator.tsx
│     │  ├─ StudentMemoBoard.tsx
│     │  ├─ QRMaker.tsx
│     │  ├─ LuckyDraw.tsx
│     │  ├─ ChatRoom.tsx
│     │  ├─ MyResourceLibrary.tsx
│     │  ├─ GeneratedDisplay.tsx
│     │  ├─ FileUpload.tsx
│     │  ├─ MyToolsScreen.tsx
│     │  ├─ MyToolEditor.tsx
│     │  ├─ MyToolRunner.tsx
│     │  ├─ MyToolChatCreator.tsx
│     │  ├─ HtmlAppCreator.tsx
│     │  ├─ DemoSamplesScreen.tsx
│     │  └─ TourOverlay.tsx
│     ├─ data
│     │  ├─ sampleTools.ts
│     │  └─ printForms.ts
│     ├─ constants
│     │  ├─ curriculum2022.ts
│     │  └─ curriculumStandards.ts
│     ├─ hooks
│     │  ├─ useGenerationTracker.ts
│     │  └─ useEscapeKey.ts
│     ├─ lib
│     │  ├─ generatedContent.ts
│     │  ├─ generationHistory.ts
│     │  ├─ generationErrors.ts
│     │  ├─ generationSafety.ts
│     │  ├─ guidelineCompliance.ts
│     │  ├─ security.ts
│     │  ├─ safeStorage.ts
│     │  ├─ textLength.ts
│     │  ├─ translation.ts
│     │  ├─ apiKeyGuide.ts
│     │  ├─ chatFirebaseGuide.ts
│     │  ├─ cancellation.ts
│     │  ├─ aiJson.ts
│     │  ├─ a4Check.ts
│     │  ├─ toast.ts
│     │  ├─ tours.ts
│     │  ├─ hwpx-parser.ts
│     │  ├─ hwpx-template.ts
│     │  ├─ soundEffect.ts
│     │  └─ __tests__/        ← 위 모듈별 단위 테스트
│     └─ services
│        └─ geminiService.ts
└─ dist
   └─ edunote_버전_portable.exe
```

---

## 5. 주요 파일 역할

| 파일 | 역할 |
| --- | --- |
| `src/main/index.ts` | Electron 앱 창 생성, 앱 메뉴 구성, 앱 아이콘 설정, main process (앱의 핵심 기능을 실제로 실행하는 부분) 진입점 |
| `src/main/ipcHandlers.ts` | renderer (사용자가 보는 화면을 그리는 부분)에서 요청하는 파일 저장, PDF 저장, 설정 저장, 백업, 외부 열기, AI 호출 IPC (화면과 앱 본체 사이의 메시지 전달 통로) 처리 |
| `src/main/GeminiService.ts` | Gemini API 실제 호출, 무료·유료 API 등급별 모델 폴백 체인 실행, 429/일일한도 재시도, 이미지 생성. `generateContent`류 함수는 `{text, model}` 형태로 실제 사용된 모델명을 함께 반환하며, 웹 검색 그라운딩을 켠 요청에는 출처 정보(`grounding`)가 선택 필드로 더해진다 |
| `src/main/modelChain.ts` | 모델 폴백 체인 순수 로직 — 선호 모델 목록(`FREE_MODEL_PREFERENCE`/`PAID_MODEL_PREFERENCE`)과 키로 실제 조회한 모델 목록의 교집합 계산, 429 재시도 대기시간(retryDelay) 파싱, 일일 한도 오류 판별 |
| `src/main/groundingSources.ts` | 웹 검색 그라운딩 응답에서 출처(URL 기준 중복 제거)·검색어·검색 제안 위젯 HTML을 추려내는 순수 로직. 스트리밍은 청크마다 부분 메타데이터가 와서 정보가 가장 많은 것을 남긴다 |
| `src/main/eduReferenceSearch.ts` | 교육자료 제작에 참고할 교육부·교육청 자료를 사람이 직접 찾도록, 교육 주제를 `site:go.kr`로 좁힌 검색 URL로 만드는 순수 로직 |
| `src/main/requestPacer.ts` | 무료 키 분당 요청 한도(15회)에 맞춰 AI 호출 간 최소 간격을 자동으로 띄우는 로직 |
| `src/main/streamGuard.ts` | 스트리밍 생성이 빈 마크업만 무한 반복하거나 청크가 오래 끊기는 비정상 상황을 감지해 다음 모델로 폴백시키는 로직 |
| `src/main/secretStore.ts` | Gemini·나라장터·네이버 API 키를 safeStorage로 암호화 저장·복호화, 시크릿 키 목록(`SECRET_KEYS`)을 렌더러 노출 차단·백업 제외·설정 동기화 전 구간에서 공통 파생 |
| `src/main/configValidation.ts`, `src/main/ipcValidation.ts` | 설정 저장·백업 복원 값과 AI 생성 IPC 요청의 형식·크기를 main process에서 한 번 더 검증 |
| `src/main/netGuard.ts` | 인터넷 가격조회 등 외부 URL 요청에서 localhost·사설 IP(IPv4 매핑 IPv6 포함) 접근을 막는 SSRF 가드 |
| `src/main/pathSafety.ts` | 자동 저장 경로가 지정된 저장 폴더 밖으로 벗어나지 않도록 검증 |
| `src/main/versionCompare.ts` | `-beta` 등 접미사가 붙은 릴리즈 태그도 안전하게 비교하는 버전 비교 로직 |
| `src/main/hwpxSkeleton.ts` | 한글이 실제로 여는 빈 HWPX 문서 골격(Apache-2.0 픽스처)을 내장해 HWPX 생성 시 재사용 |
| `src/main/HwpxGenerator.ts` | HWPX 파일 생성 기능. 제목·본문·표 포맷과 줄 배치 정보(lineseg)를 골격 기반으로 구성한다 |
| `src/main/store.ts` | electron-store 인스턴스 관리 |
| `src/preload/index.ts` | preload (화면과 앱 본체를 안전하게 연결하는 중간 다리)가 renderer에 노출하는 `window.electronAPI` 정의 |
| `src/preload/types.d.ts` | `window.electronAPI` 타입 정의. `aiGenerate`/`aiGenerateMultipart`/`aiGenerateMultipartStream`은 `Promise<{text: string; model: string}>`을 반환한다 |
| `src/renderer/App.tsx` | 전체 화면 라우팅, 사이드바 메뉴, 메뉴 드래그 재정렬, 전역 상태, 다크모드, 생성 중단, 토스트 처리, 메인 사이드바 접기 |
| `src/renderer/types.ts` | AppMode, DocType, 학생 데이터, 생성 요청, 파일 데이터 등 핵심 타입 정의 |
| `src/renderer/constants.ts` | 공통 상수, 공문서 시스템 지침, 로딩 문구, 학생기록 예시 등 |
| `src/renderer/services/geminiService.ts` | renderer 쪽 AI 프롬프트 생성, 메뉴별 생성 함수, 결과 후처리. 저수준 `aiGenerate`류는 선택적 `onModel` 콜백으로 실제 생성 모델명을 상위에 전달하고, 상위 생성 함수 중 결과를 화면에 그대로 노출하는 함수들만 반환 타입을 `{text, model}`로 바꿔 그 모델명을 함께 반환한다 |
| `src/renderer/lib/generatedContent.ts` | 생성 결과가 마크다운인지 완성된 HTML 문서(`<!DOCTYPE html>` 포함)인지 판별해 알맞은 방식으로 HTML로 변환. HTML 문서를 마크다운으로 오판하면 remark가 원시 HTML 블록을 제거해 미리보기가 비거나 태그가 그대로 노출된다 |
| `src/renderer/lib/security.ts` | `sanitizeHtml`(script·on* 속성·iframe 등 제거, 전체 HTML 문서는 `<style>`+`<body>`만 추출), 가져온 도구(JSON) 유효성 검증, https 링크 검증 |
| `src/renderer/lib/safeStorage.ts` | main process의 safeStorage 암·복호화를 주입식으로 감싸 electron 의존 없이 단위 테스트 가능하게 분리 |
| `src/renderer/lib/textLength.ts` | `getByteLength` — 나이스(NEIS) 기준과 동일한 UTF-8 바이트 수 계산(TextEncoder 기반, 한글 1자=3바이트) |
| `src/renderer/lib/translation.ts` | 가정통신문·메시지·간단 번역이 공유하는 번역 대상 언어 목록과 번역 프롬프트 |
| `src/renderer/lib/generationErrors.ts` | API 키 없음·키 오류·사용량 초과·시간 초과·네트워크 오류를 구분해 사용자에게 안내하는 오류 분류 |
| `src/renderer/lib/generationSafety.ts` | 학생기록 결과에서 기재요령 주의 표현(교외 대회·수상, 공인어학시험 등)을 자동 감지해 경고하는 안전망 |
| `src/renderer/lib/guidelineCompliance.ts` | 생기부 기재요령 위반 여부를 판단하는 규칙 모음 |
| `src/renderer/lib/apiKeyGuide.ts` | Google AI Studio 발급 거부 등 상황별 API 키 발급 안내 문구 |
| `src/renderer/lib/chatFirebaseGuide.ts` | 채팅방 기능에 필요한 Firebase 프로젝트 설정 단계·Firestore 보안 규칙 안내 텍스트 |
| `src/renderer/lib/cancellation.ts` | 화면별로 분리된 생성 중단 신호 처리 |
| `src/renderer/lib/aiJson.ts` | Gemini JSON 응답 모드 결과를 안전하게 파싱하는 공용 유틸 |
| `src/renderer/lib/tours.ts` | 인터랙티브 튜토리얼(TourOverlay) 단계 정의 |
| `src/renderer/GlobalStateContext.tsx` | 생성 중에도 화면 상태를 유지하기 위한 전역 상태 컨텍스트 |
| `src/renderer/components/GeneratedDisplay.tsx` | 생성된 HTML 결과 표시, 편집, 복사, 저장, PDF 저장. 선택적 `model` prop을 헤더에 배지로만 표시하고 저장·복사·인쇄에 쓰이는 `content`와는 분리되어 있어 결과물에는 섞이지 않는다 |
| `src/renderer/components/ClassToolsPanel.tsx` | 수업 도구 탭 컨테이너 — QR 메이커·럭키드로우·채팅방(ChatRoom) 세 탭 전환 |
| `src/renderer/components/TeacherRecordPanel.tsx` | 우리반기록 탭 컨테이너 — 수업관찰기록·상담일지·학급경영일지 세 탭 전환 |
| `src/renderer/components/ChatRoom.tsx` | Firebase(Firestore+Auth) 기반 실시간 채팅방. `manage` 모드(본 창, 방 개설·QR/주소 관리)와 `conversation` 모드(별도 창 `#chat`, 대화만 표시) 두 가지로 동작 |
| `src/renderer/components/DocArchivePanel.tsx` | 공문 캡처 이미지·첨부 파일 저장 및 검색 |
| `src/renderer/components/DocTodoPanel.tsx` | 공문요약·업무추출에서 저장한 할일의 마감일·완료 상태 관리, D-day 배지 |
| `src/renderer/components/TranslatorScreen.tsx` | 한국어↔외국어 양방향 간단 번역 화면 |
| `src/renderer/components/DemoSamplesScreen.tsx` | Demo 별도 창(`#demo`)에서 보여주는 기능별 샘플 입력값 모음 |
| `src/renderer/components/TourOverlay.tsx` | 화면 요소를 단계별로 하이라이트하는 인터랙티브 튜토리얼 오버레이 |
| `src/renderer/components/FileUpload.tsx` | 공통 파일 업로드 컴포넌트, 이미지·PDF·HWPX 등 처리 |
| `src/renderer/components/MyToolsScreen.tsx` | 내 스킬 메인 화면 — 스킬 목록·카드·공유 모달, 마켓 탭·CSV 파싱 |
| `src/renderer/components/HtmlAppCreator.tsx` | HTML 앱 만들기 화면 — 앱 설명·기능 목록 입력, AI 생성, 미리보기, 내 스킬 저장 (어휘 플래시카드 예시는 단어/뜻 쌍이 미리 채워짐) |
| `src/renderer/components/PrintFormScreen.tsx` | 양식 인쇄 화면 — 양식 선택, A4 양식 직접 편집, 현재 화면 기준 PDF/HWPX 저장 |
| `src/renderer/data/printForms.ts` | 학교 양식 10종 정의 — 필드 구성과 A4 HTML 템플릿, 줄 단위 입력을 표로 만드는 `table` 필드 타입 |
| `src/renderer/components/BudgetPlannerScreen.tsx` | 예산안작성 화면 — 작성 방식 선택, 제목 주제 분석 기반 AI 품목 생성, 과목 트리 편집, 0원 맞추기, 인터넷 가격 조회, CSV 입출력 |
| `src/renderer/components/MyToolEditor.tsx` | 도구 만들기 3단계 위저드 — 기본정보·입력필드·프롬프트 작성, AI 도움받기 |
| `src/renderer/components/MyToolRunner.tsx` | 도구 실행 화면 — 동적 폼, 파일 업로드, 배치 처리, 취소 버튼 |
| `src/renderer/components/MyToolChatCreator.tsx` | 대화형 도구 만들기 — AI 4단계 질문으로 도구 초안 자동 생성 |
| `src/renderer/data/sampleTools.ts` | 기본 제공 샘플 도구 2개 (과제 피드백 생성기, 이수증 연수번호 수집기). 이수증 수집기 promptTemplate은 성명 추출 우선순위 강화(성명을 첫 번째 열로 명시), 마크다운 표 구분선 추가, 오름차순 정렬 유지로 파싱 안정성을 개선함 |
| `src/renderer/hooks/useGenerationTracker.ts` | 메뉴별 생성 진행 상태를 전역 진행 상태와 연결 |

---

## 6. 앱 모드 구조

`AppMode`는 앱의 화면 단위를 정의한다. `App.tsx`가 현재 mode 상태를 보고 어떤 컴포넌트를 보여줄지 결정한다.

쉽게 말해, 사용자가 메뉴를 클릭하면 `mode` 값이 바뀌고, 그 값에 맞는 화면이 나타나는 방식이다.

| 섹션 | AppMode | 화면 컴포넌트 | 기능 |
| --- | --- | --- | --- |
| 기본 | `HOME` | `HomeScreen` | 홈 화면, 기능 요약, 업데이트 안내. 상단 1행 4열 카드로 API 키 상태·사용자 정보 입력 여부·학생 정보 입력 여부·마지막 백업 시간을 표시함 |
| 기본 | `USAGE_GUIDE` | `UsageGuideScreen` | 사용법 안내 |
| 기본 | `SETTINGS` | `SettingsScreen` | API 키, 학교급, 소속기관, 저장 위치, 백업 설정 |
| 기본 | `ABOUT` | `AboutScreen` | 앱 정보, 버전, 업데이트 확인 |
| 기본 | `DEMO_SAMPLES` | `DemoSamplesScreen` | 샘플 입력값 모음 (Demo 버튼 → 별도 창으로 열림, 공문요약 예시에 일정·마감일·참고 웹사이트 포함) |
| 교무행정AI | `EDUCATION_QA` | `EducationAssistantQA` | 교육 일반 질의응답 |
| 교무행정AI | `OFFICIAL_DOC_ANALYZER` | `OfficialDocAnalyzer` | 공문 업무추출, 일정화 |
| 교무행정AI | `SCHOOL_DOC` | `SchoolDocPanel` | 공문서, 계획서, 교육자료, 보고서 등 10종 문서 생성 |
| 교무행정AI | `DOC_ARCHIVE` | `DocArchivePanel` | 공문 캡처 이미지·첨부 저장 및 검색 |
| 교무행정AI | `DOC_TODO` | `DocTodoPanel` | 공문요약·업무추출에서 저장한 할일의 마감일·완료 상태 관리 |
| 교무행정AI | `PRINT_FORM` | `PrintFormScreen` | 학교 양식 10종 A4 출력·PDF 저장 |
| 교무행정AI | `BUDGET_PLANNER` | `BudgetPlannerScreen` | 과목별 비율 방식 또는 일반 작성 방식의 예산안 작성, 단가·수량 조합, 0원 맞추기, CSV 입출력 |
| 교무행정AI | `TRANSLATOR` | `TranslatorScreen` | 한국어↔외국어 양방향 간단 번역 |
| 수업자료AI | `LESSON_MATERIAL` | `LessonMaterialGenerator` | 슬라이드, 워크시트, 퀴즈, 수업계획서 생성 |
| 수업자료AI | `CLASS_TOOLS` | `ClassToolsPanel` | 수업 도구 탭 컨테이너 (QR 메이커 / 럭키드로우 / 채팅방) |
| 수업자료AI | `MY_RESOURCES` | `MyResourceLibrary` | 자료 링크·파일 관리 |
| 학생기록AI | `RECORD_CHATBOT` | `RecordChatbot` | 생활기록부 기재 상담 챗봇 |
| 학생기록AI | `STUDENT_RECORD_GROUP` | (트리 토글) | 생기부도우미 서브메뉴 펼침/접기 |
| 학생기록AI | `GENERATOR` | `OpinionGenerator` | 행동특성 및 종합의견 생성 |
| 학생기록AI | `SUBJECT_GENERATOR` | `SubjectGenerator` | 교과세특 생성 |
| 학생기록AI | `SPORTS_CLUB_GENERATOR` | `SportsClubGenerator` | 학교스포츠클럽 특기사항 생성 |
| 학생기록AI | `CREATIVE_ACTIVITY_GENERATOR` | `CreativeActivityGenerator` | 창의적 체험활동 특기사항 생성 |
| 학생기록AI | `TEACHER_RECORD` | `TeacherRecordPanel` | 우리반기록 탭 컨테이너 (수업관찰·상담·학급경영) |
| 학생기록AI | `STUDENT_MEMO` | `StudentMemoBoard` | 학생 메모 등록·필터링 |
| 내 스킬 | `MY_AI_TOOLS` | `MyToolsScreen` (내 스킬 탭) | 스킬 목록, 실행, 수정, 공유 |
| 내 스킬 | `MY_AI_TOOLS_SHARED` | `MyToolsScreen` (스킬마켓 탭) | 마켓에서 도구 가져오기 |

`GUIDELINE_QA`, `QR_MAKER`, `LUCKY_DRAW`는 `AppMode`에 값만 남아 있고 `App.tsx`의 `renderMode`나 메뉴 배열 어디에서도 참조되지 않는 미사용 항목이다(QR 메이커·럭키드로우는 `CLASS_TOOLS` 탭 안의 컴포넌트로 흡수되었고, `GuidelineQA.tsx` 컴포넌트 자체는 삭제됨). 새 화면을 추가할 때 이 이름들을 재사용하지 않도록 주의한다.

---

## 7. 교무행정 문서 타입

`DocType`은 `SchoolDocPanel`에서 사용하는 문서 유형이다. 실제 생성 프롬프트는 `src/renderer/services/geminiService.ts`의 `generateDocument` 내부에서 분기된다.

| DocType | 문서명 | 주요 문체·구조 |
| --- | --- | --- |
| `GONGMUN` | 공문서 | 수신, 경유, 제목, 관련, 본문, 붙임, 끝. 합쇼체 |
| `PLAN` | 계획서 | 추진배경, 목적, 운영방침, 세부추진계획, 소요예산, 기대효과. 개조식 보고서체. 제목 크게/진하게/가운데 정렬 |
| `EDU_MATERIAL` | 교육자료 | 교육개요, 추진근거 및 필요성, 교육목표, 주요 교육내용, 사례 및 판단기준, 실천수칙 및 자가점검, 자주 묻는 질문, 기대효과. 계획서와 같은 문서 양식을 쓰되 **예산 항목 없음**. 개조식 + 명사형 종결. 입력은 계획서 틀에서 예산만 제외(주제·대상·추가사항) |
| `REPORT` | 보고서 | 추진개요, 추진실적, 운영결과, 예산정산, 성과 및 제언. 완료형 보고서체. 주제·대상·예산 입력칸 제공 |
| `PUMUI` | 품의서 | 관련, 시행문, 세부내역, 산출내역. 합쇼체 |
| `MEETING_MINUTES` | 회의록 | 일시, 장소, 참석자, 안건, 발언 내용, 서명란 |
| `PROMOTION` | 홍보자료 | 보도자료와 SNS 홍보용 요약 |
| `NEWSLETTER` | 가정통신문 | 제목, 인사말, 안내 내용, 맺음말, 날짜, 학교장 |
| `MESSAGE` | 문자&소통메시지 | SMS/LMS 길이 제한 반영 |
| `GONGGO` | 공고문 | 공고번호, 제목, 공고일, 내용, 접수기간, 문의처 |

---

## 8. Gemini 모델 구성

고정된 모델 하나를 쓰지 않고, `src/main/modelChain.ts`의 선호 순서 목록과 API 키로 실제 조회한(`ai.models.list()`, 세션당 1회 캐시) 사용 가능 모델 목록의 **교집합**만 폴백 체인으로 사용한다. 목록에 없는 이름은 애초에 후보에서 빠지므로, 하드코딩한 모델명이 그 키에서 지원되지 않아 요청을 낭비하는 일이 없다.

선호 순서는 고정 목록이 아니라 `resolvePreference`가 실행할 때마다 새로 만든다.

1. `buildDynamicPreference`가 조회된 모델 중 정식 안정판 이름 규칙(`gemini-{major}.{minor}-(flash-lite|flash|pro)`, 프리뷰·실험판 제외)에 맞는 것만 추려, **등급 → 세대** 순으로 정렬한다. 무료는 `flash-lite`를, 유료는 `pro`를 다른 등급의 최신 모델보다 앞세우고, 같은 등급 안에서는 세대가 높을수록 우선한다.
2. 그 뒤에 아래 고정 목록을 **안전망**으로 붙인다(중복 제거).
3. 앞에서부터 최대 3개(`MAX_CHAIN_LENGTH`)만 폴백 체인으로 쓴다.

따라서 구글이 새 `flash-lite`/`pro` 안정판을 내면 코드 수정 없이 다음 실행부터 자동으로 1순위가 된다. 단, 이름 규칙을 벗어난 모델(예: 소수점 없는 이름)은 자동 감지에서 빠지며, 이 경우 고정 목록으로 동작한다.

| 등급 | 고정 안전망 목록 (`FREE_MODEL_PREFERENCE` / `PAID_MODEL_PREFERENCE`) |
| --- | --- |
| 무료 (Free) | `gemini-3.1-flash-lite` → `gemini-2.5-flash-lite` → `gemini-2.5-flash` → `gemini-2.0-flash` → `gemini-2.0-flash-lite` |
| 유료 (Paid) | `gemini-2.5-pro` → `gemini-2.5-flash` → `gemini-2.5-flash-lite` |

이 목록은 모델 조회에 성공하면 동적 감지 결과 **뒤**에 놓이므로 실제로는 거의 쓰이지 않는다. 조회가 실패했을 때만 첫 번째 모델 하나로 동작한다.

모델 폴백·오류 처리(`GeminiService.ts`):
- 분당 요청 한도(429)로 재시도 대기시간(`retryDelay`)이 응답에 포함된 경우, 그 시간만큼 기다린 뒤 **같은 모델로** 재시도해 문체 일관성을 유지한다.
- 일일 한도(PerDay) 소진이면 해당 모델을 10분간 차단하고 폴백 체인의 다음 모델로 넘어간다.
- 모델 목록 조회 자체가 실패하면 선호 순서의 첫 번째 모델 하나로만 동작한다(기존 방식과 동일하게 안전하게 저하).
- 모든 시도가 막히면 분당 제한/일일 한도를 구분해 안내한다.
- 무료 키는 분당 요청 한도(15회)에 맞춰 호출 간 최소 4초 간격을 자동 적용한다(`requestPacer.ts`).
- 스트리밍 생성이 빈 마크업만 반복하거나 45초 이상 응답이 없으면 다음 모델로 폴백한다(`streamGuard.ts`).

웹 검색 그라운딩(`useSearchGrounding`)을 켠 요청은 `config.tools`에 `googleSearch`를 붙여 호출하고, 응답의 `groundingMetadata`에서 출처·검색어·검색 제안 위젯을 `groundingSources.ts`가 추려 `grounding` 필드로 함께 돌려준다. JSON 강제 출력(`responseJson`)과는 함께 쓸 수 없어 그때는 도구를 붙이지 않는다. 이 옵션은 교육자료에서 사용자가 켠 경우에만 전달되며 기본값은 꺼짐이다(검색 건수만큼 과금).

생성 결과에는 실제로 응답한 모델명이 함께 반환되며(`{text, model}`), 생기부 도우미·문서작성기·수업자료·AI스킬즈 등 사용자가 보는 결과 화면에는 이 모델명이 작은 배지로 표시된다(9.6절 참고). 배지는 화면 표시용이며 저장·복사·인쇄되는 실제 결과물 텍스트에는 포함되지 않는다.

---

## 9. 주요 기능별 설명

### 9.1 학생기록 AI

| 기능 | 입력 | 처리 | 출력 |
| --- | --- | --- | --- |
| 행동특성 및 종합의견 | 학교급, 학생명, 긍정·보완 태그, 추가 맥락, (선택) 학생 기록물 사진/스캔 파일 | 생활기록부 문체 지침과 예시를 반영해 생성 | 학생별 종합의견 문장 + 글자수/바이트수 + 생성 모델 배지 |
| 교과세특 | 학생명, 교과, 과제·수행평가, 성취수준, 관찰 내용, (선택) 학생 기록물 사진/스캔 파일 | 성취수준별 표현과 사고 과정 중심 프롬프트 적용 | 교과별 세특 문장 + 글자수/바이트수 + 생성 모델 배지 |
| 스포츠클럽 | 학생명, 종목, 관찰 내용, (선택) 학생 기록물 사진/스캔 파일 | 공동체역량, 역할, 협력 방식 중심 생성 | 스포츠클럽 특기사항 + 글자수/바이트수 + 생성 모델 배지 |
| 창의적 체험활동 | 활동 영역, 태그, 추가 맥락, (선택) 학생 기록물 사진/스캔 파일 | 활동-탐구-진로 연결 구조로 생성 | 창체 특기사항 + 글자수/바이트수 + 생성 모델 배지 |
| 상담일지 | 상담 관련 내용 | 학교 상담 양식 기반 생성, 학생 명단 기준 개인정보 보호 모드 적용 | 상담일지 + 생성 모델 배지 |
| 학급경영일지 | 학급 운영 내용 | 학급경영 기록 양식 생성, 학생 명단 기준 개인정보 보호 모드 적용 | 학급경영일지 + 생성 모델 배지 |
| 생활기록부 상담 | 질문, 학교급 | 기재요령 컨텍스트 기반 응답 | 기재 방법 안내 |

생기부 도우미 4개 화면(행동특성·교과세특·스포츠클럽·창의적 체험활동)은 결과 하단에 나이스(NEIS) 기준과 동일한 UTF-8 바이트 수를 "000자/000바이트" 형식으로 함께 표시한다(`getByteLength`, textLength.ts). 또한 관찰 내용을 직접 타이핑하는 대신, 학생의 활동지·수행평가 결과물·관찰일지 등을 스캔하거나 촬영한 파일(이미지·PDF, 여러 장 가능)을 업로드하면 `parseStudentObservationFromFiles`가 파일 속 글자를 옮기는 OCR이 아니라 학생이 수행한 활동 과정·완성도·태도까지 이미지 전체를 분석해 관찰 내용 입력칸을 자동으로 채운다. 분석 결과에는 학생 이름을 포함하지 않으며, 업로드한 파일은 분석에만 쓰이고 저장되지 않는다.

### 9.2 교무행정 AI

| 기능 | 입력 | 처리 | 출력 |
| --- | --- | --- | --- |
| 공문서 작성 | 문서 유형, 제목, 본문 요청, 첨부 파일 | 문서 유형별 구조와 문체 지침 적용 | HTML 문서 |
| 계획서 | 사업 내용, 학교 정보, 날짜 | 개조식, 표, 제목 서식 지침 적용 | 계획서 HTML |
| 교육자료 | 교육 주제, 교육 대상, 추가 사항, 참고 파일 | 계획서 문서 양식에 예산 항목을 빼고, 교육 본문(내용·사례·판단기준·자가점검·질의응답) 중심으로 구성. 개조식 + 명사형 종결 | 교육자료 HTML (+ 웹 검색을 켠 경우 출처 목록) |
| 보고서 | 주제, 대상, 예산/집행액, 운영 결과, 추가 사항, 참고 파일 | 완료형 보고서체, 표 중심 결과 정리 | 보고서 HTML |
| 품의서 | 품의 유형, 근거, 예산, 산출내역 | 산출내역 텍스트화, 합쇼체 적용 | 지출품의서 |
| 회의록 | 일시, 장소, 안건, 발언 내용 | 표 기반 회의록 구조 적용 | 회의록 HTML |
| 업무추출 | 공문 텍스트 또는 파일 | 마감, 일시, 장소, 링크, 제출 업무 추출 | 짧은 업무 메모, 캘린더 링크 |
| 양식 인쇄 | 양식 선택(글쓰기·학급 활동·교무 행정), A4 양식 직접 편집 | 양식 HTML을 화면에서 직접 수정하고 현재 화면 HTML을 저장 경로로 전달 | 학교 양식 10종 PDF/HWPX |
| 예산안작성 | 예산 제목, 전체 예산, 작성 방식(과목별 비율 또는 일반 작성), 구입 물품 | `예산안 만들기` 버튼 하나로 예산안 틀 생성과 품목 자동 생성(AI/내장 후보)을 한 번에 수행, 예산 제목의 주제·목적을 먼저 분석해 어울리는 품목만 생성하고 무관한 일반 품목은 후보에서 제외, 과목별 비율 방식에서도 세 과목 모두 주제 연관 품목 배치, 일반 작성은 예산 과목 없이 품목 중심으로 표시, 단가는 만원 단위 중심으로 제시, `0원 맞추기`로 잔액 조정 | 예산안 표, CSV |

### 9.3 수업자료 AI

수업자료 생성 메뉴에서 만들 수 있는 자료 유형이다.

| 기능 | 입력 | 처리 | 출력 |
| --- | --- | --- | --- |
| 수업 슬라이드 | 학년, 교과, 단원, 주제, 성취기준 | 슬라이드 JSON 생성, 교사 메모, 이미지 프롬프트 생성 | 슬라이드 화면, PDF/TXT 저장 |
| 워크시트·평가지 | 학년, 교과, 주제, 문항 수 | A4 인쇄용 HTML 생성 | HTML, PDF |
| 퀴즈 앱 | 주제, 문항 수, 유형(객관식·주관식·OX) | AI가 JSON 데이터만 생성하고, 검증된 고정 HTML 템플릿에 주입. 미리보기는 `새 창에서 열기` 버튼으로 제공 | 퀴즈 HTML, PDF |
| 수업 계획서 | 수업 정보 | 수업 개요, 목표, 과정안, 평가계획을 표로 구성 | HTML 문서 |
| 수업관찰기록 | 수업 정보, 관찰 내용 | 관찰 기록 양식 생성 | HTML 문서 |

퀴즈 앱은 객관식·주관식·OX 세 가지 유형을 체크박스로 선택할 수 있다. AI는 문제 데이터(JSON)만 생성하고, 화면 구성은 미리 검증된 고정 HTML 템플릿이 담당한다. 이 방식은 AI 응답의 품질 편차와 상관없이 퀴즈가 항상 안정적으로 작동하도록 보장한다.

### 9.4 수업 운영 도구

수업 도구(CLASS_TOOLS)는 탭 컨테이너로, QR 메이커·럭키드로우·채팅방을 탭 방식으로 전환한다.

| 기능 | 역할 |
| --- | --- |
| QR 메이커 | 수업 링크나 자료 링크를 QR 코드로 변환 |
| 럭키드로우 | 발표, 칭찬 주인공 등 긍정 주제로 학생 추첨 |
| 채팅방 | Firebase(Firestore+Auth) 기반 QR 참여방 개설. 교사가 방을 시작하면 학생은 QR 코드나 주소로 입장해 익명 닉네임으로 대화하고, 교사는 대화 전용 새 창(`#chat`)에서 참여자·메시지·귓속말·핀 고정을 관리한다. 방을 열려면 사용자가 자신의 Firebase 프로젝트 설정값을 직접 입력해야 한다(chatFirebaseGuide.ts 안내) |
| 나만의 자료실 | URL, 유튜브, 파일 자료를 주제별로 저장·검색 |
| 학생 메모 보드 | 제목, 학생 여러 명, 내용을 기록하고 학생·키워드로 필터링 |
| 학생 카드 | 이름/번호/별명으로 검색해 4개 생기부 생성기 이력과 학생 메모를 모아 최신순으로 조회. AI 호출 없이 기존 저장 데이터만 재사용 |

### 9.5 설정·운영 기능

| 기능 | 역할 |
| --- | --- |
| API 키 설정 | Gemini 무료·유료 API 키 저장 및 사용 가능 여부 확인 |
| 학교 정보 | 학교급, 학년반, 소속기관, 학생 명단 저장 |
| 다크모드 | 앱 전체 테마 전환 |
| 생성 중단 | 진행 중인 생성 요청을 사용자 쪽에서 중단 |
| 생성 히스토리 | 이전 생성 결과 재활용 |
| 전체 자료 백업 | 설정과 자료 데이터를 JSON으로 내보내기 |
| 백업 불러오기 | 다른 PC에서 기존 자료 복원 |

### 9.6 생성 모델 표시(모델 배지)

모델 폴백 체인 도입 이후 실제로 어떤 Gemini 모델이 응답을 만들었는지 사용자가 알 수 없었던 문제를 해결한 기능이다. 생기부 도우미 4종, 문서작성기(9종 문서), 공문요약(업무추출), 상담일지·학급경영일지·수업관찰기록, 수업자료 4종(워크시트·퀴즈·수업계획서·슬라이드), AI스킬즈(HTML 앱 만들기, 도구 테스트·실행)까지 사용자가 결과를 저장·인쇄하는 거의 모든 화면에 적용되어 있다.

- 파일에서 값을 추출해 입력 폼을 채우는 중간 단계(NEIS 성적 파일 분석, 연간 지도 계획 분석, 학생 기록물 사진 분석 등)와, 대화형 챗봇(메시지 버블 목록 구조)에는 적용하지 않는다 — 최종 "결과물" 화면이 아니거나 카드 하나로 표현되는 구조가 아니기 때문이다.
- 배지는 공용 컴포넌트 `GeneratedDisplay`의 `model` prop 또는 각 화면 헤더에 작은 태그로만 표시되며, 복사·저장·PDF/HWPX 내보내기·인쇄에 쓰이는 실제 본문 텍스트(`content`)와는 완전히 분리되어 있다. 즉 화면에는 보이지만 저장·인쇄되는 문서에는 절대 섞이지 않는다.

---

## 10. 핵심 동작 메커니즘

### 10.1 화면 전환 메커니즘

사용자 입장에서는 단순히 메뉴를 클릭하는 동작이지만, 앱 내부에서는 다음 순서로 처리된다.

1. 사용자가 사이드바 메뉴를 클릭한다.
2. `App.tsx`의 `mode` 상태가 변경된다.
3. `mode` 값에 따라 해당 컴포넌트가 화면에 표시된다.
4. 한 번 열린 화면은 `mountedModes`에 기록되어, 생성 중 화면을 이동해도 상태가 유지된다.
5. 생성 중 다른 메뉴로 이동하면 동시 생성 안내가 표시될 수 있다.

### 10.2 메뉴 드래그 재정렬 메커니즘

사용자가 사이드바 메뉴 항목의 순서를 직접 바꿀 수 있다.

1. 사용자가 사이드바 메뉴 항목을 드래그한다.
2. `reorderMenuItem` 함수가 섹션별 메뉴 배열을 업데이트한다.
3. 변경된 순서는 `localStorage` (앱을 닫아도 유지되는 브라우저 내부 저장소)에 `edunote_menu_order_${section}_v1` 키로 저장된다.
4. 앱을 재시작해도 저장된 순서가 유지된다.

### 10.3 사이드 패널 접기 메커니즘

메인 사이드바와 각 기능 화면의 하위 사이드 패널은 같은 모양의 패널 토글 버튼을 사용한다. 패널을 접으면 얇은 바와 펼치기 버튼만 남고, 본문 또는 결과 영역이 더 넓게 보인다.

적용된 하위 패널:
- 예산안작성 입력 패널
- 공문 요약 / 업무 추출 입력 패널
- 문서작성기 입력 패널
- 양식 인쇄 A4 직접 편집 화면
- 수업자료 생성 입력 패널
- 내 도구 실행 입력 패널
- 행동발달, 스포츠클럽, 교과 세특, 창체 화면의 학생 목록 패널

### 10.4 AI 생성 메커니즘

AI 생성은 보안상의 이유로 renderer (화면)에서 Gemini API를 직접 호출하지 않는다. 대신 preload가 제공하는 안전한 통로를 통해 main process가 대신 호출한다.

```text
사용자 입력
  ↓
renderer 컴포넌트 (화면에서 입력값 수집)
  ↓
src/renderer/services/geminiService.ts (프롬프트 구성)
  ↓
window.electronAPI.aiGenerate 또는 aiGenerateMultipart(Stream) (안전한 호출 통로)
  ↓
preload/index.ts (중간 다리 역할)
  ↓
ipcHandlers.ts (요청 수신 및 전달)
  ↓
main/GeminiService.ts → modelChain.ts로 모델 폴백 체인 실행, 실제 Gemini API 호출
  ↓
Gemini API (구글 AI 서버)
  ↓
{ text, model } 형태로 반환 (실제 응답한 모델명 포함)
  ↓
geminiService.ts가 text만 꺼내 반환하거나(대부분), 결과 화면에 모델 배지가 필요한 함수는
{ text, model } 그대로 반환
  ↓
후처리 및 화면 표시 (모델명은 GeneratedDisplay 등의 배지로만 표시, 저장·인쇄용 본문과는 분리)
```

### 10.5 IPC (화면과 앱 본체 사이의 메시지 전달 통로) 메커니즘

IPC는 Electron 앱에서 화면(renderer)과 앱 본체(main process)가 서로 소통하는 방식이다. 직접 연결 대신 미리 정해진 통로만 사용함으로써 보안을 유지한다.

| 단계 | 설명 |
| --- | --- |
| renderer | React 컴포넌트에서 `window.electronAPI` 호출 |
| preload | `contextBridge.exposeInMainWorld`로 허용된 함수만 노출 |
| main | `ipcMain.handle`로 요청 수신 |
| 처리 | 파일 저장, 설정 읽기, AI 호출, PDF 저장, 외부 열기 수행 |
| 반환 | Promise 결과를 renderer로 반환 |

이 구조는 `nodeIntegration: false`, `contextIsolation: true` (화면이 직접 컴퓨터 파일에 접근하지 못하도록 격리) 환경에서 renderer의 직접 Node 접근을 막고, 필요한 기능만 제한적으로 제공하기 위한 구조이다.

### 10.6 네트워크 요청 메커니즘

앱 내부에서 인터넷 데이터를 가져올 때는 Node.js 기본 모듈 대신 `electron.net.fetch`를 사용한다. 이 방식은 Electron이 직접 관리하는 네트워크 스택을 경유하므로, 프록시 설정과 인증서 처리가 더 안정적으로 동작한다.

`electron.net.fetch`를 사용하는 기능:
- 업데이트 알림 (새 버전 확인)
- 나만의 자료실 썸네일 가져오기
- URL 메타정보(제목, 설명 등) 가져오기

### 10.7 로컬 데이터 저장 메커니즘

모든 데이터는 사용자 컴퓨터에만 저장된다. 외부 서버에는 전송하지 않는다.

| 데이터 | 저장 방식 | 관련 IPC |
| --- | --- | --- |
| API 키·시크릿 | safeStorage 암호화(secretStore.ts), 미지원 환경은 electron-store 평문 폴백 | `config:set-api-key`, `config:has-api-key` |
| 학교 정보 | electron-store | `config:get`, `config:set` |
| 학생 명단 | electron-store 및 JSON | `config:get`, `data:write-json` |
| 자료실 | JSON 파일 | `data:read-json`, `data:write-json` |
| 학생 메모 | JSON 파일 | `data:read-json`, `data:write-json` |
| 예산안 | JSON 파일 | `budget-plans`, `budget-planner-state` |
| 메뉴 순서 | localStorage | 키: `edunote_menu_order_${section}_v1` |
| 백업 파일 | JSON 내보내기 | `data:export-backup`, `data:import-backup` |

API 키는 백업 파일에 포함하지 않는 방향으로 설계되어 있다.

### 10.8 문서 생성 메커니즘

1. 사용자가 문서 유형과 요청 내용을 입력한다.
2. `SchoolDocPanel`이 입력값을 문서 유형별 context (맥락 정보)로 정리한다.
3. `generateDocument`가 `DocType`에 따라 지침을 선택한다.
4. 공문서·품의서는 합쇼체, 계획서·보고서는 보고서체, 교육자료는 개조식 명사형 종결, 가정통신문은 안내문체를 적용한다.
5. 교육자료에서 웹 검색 참조를 켠 경우, 근거 규칙을 "지어내지 않기"에서 "검색으로 확인한 내용만 출처와 함께 쓰기"로 교체해 프롬프트를 구성한다.
6. Gemini 응답을 HTML 형태로 받아 `GeneratedDisplay`에 표시한다. 출처 정보가 함께 왔다면 결과 위에 참고 자료 목록과 검색 제안 위젯을 표시하며, 이 영역은 인쇄물에서 제외된다(`.no-print`).
7. 사용자는 결과를 편집, 복사, PDF 저장, Word 저장, HWPX 저장 실험 기능으로 내보낼 수 있다.

### 10.9 PDF 저장 메커니즘

사용자가 보이지 않는 별도 창을 통해 PDF를 생성하는 방식이다.

1. renderer가 저장할 HTML 문자열을 main process로 보낸다.
2. main process가 보이지 않는 `BrowserWindow` (별도 창)를 생성한다.
3. HTML을 로드한 뒤 Electron `printToPDF`를 실행한다.
4. 사용자가 지정한 경로 또는 기본 저장 위치에 PDF를 저장한다.

### 10.10 공문 업무추출과 캘린더 연동 메커니즘

공문에서 업무와 일정을 자동으로 뽑아 구글 캘린더 등록까지 이어주는 기능이다.

1. 사용자가 공문 텍스트나 파일을 입력한다.
2. Gemini가 업무명, 마감, 일시, 장소, 링크, 제출 사항을 짧은 업무 메모로 정리한다.
3. 일정 정보가 있으면 Google Calendar URL 파라미터를 구성한다.
4. `openExternal`을 통해 브라우저의 Google Calendar 일정 작성 화면을 연다.

---

## 11. 프롬프트 설계 원칙

AI에게 보내는 지침(프롬프트)을 작성할 때 지키는 규칙이다.

| 영역 | 원칙 |
| --- | --- |
| 공통 | AI가 작성했다는 문구, 초안 문구, 불필요한 이모지, Markdown 강조 기호 금지 |
| 학생기록 | 교육적이고 공적인 언어, 관찰 근거 중심, 과장 표현 금지 |
| 공문서 | 엄밀한 공적 언어, 시행문은 합쇼체 |
| 품의서 | 시행문은 합쇼체, 산출내역은 표 대신 텍스트, 결재란(담당/부서장/원감/학교장 표) 출력 금지 |
| 계획서 | 추진배경, 목적, 기대효과를 `가. 나. 다.` 개조식으로 작성. 제목 크게/진하게/가운데 정렬 |
| 보고서 | 완료된 결과 중심, 추진실적과 예산정산은 표 활용 |
| 수업자료 | 학년 수준, 성취기준, 실제 수업 활용성 반영 |
| 퀴즈 앱 | AI는 JSON 데이터만 생성하고, HTML 구조는 고정 템플릿이 담당 |
| 학생 기록물 사진 분석 | 파일 속 글자를 옮기는 OCR이 아니라 활동 과정·완성도·태도까지 이미지 전체를 분석하도록 지시. 결과 텍스트에 학생 이름 포함 금지 |

---

## 12. 보안 및 개인정보 설계

| 항목 | 설계 방향 |
| --- | --- |
| API 키·시크릿 | Gemini·나라장터·네이버 키 모두 main process에서 OS safeStorage로 암호화 보관(secretStore.ts), 렌더러에는 값 자체를 노출하지 않고 저장 여부만 조회 가능. 금고를 못 쓰는 환경에서 평문으로 폴백되면 `writeSecret`이 `{ usedPlaintext: true }`를 반환해 렌더러가 사용자에게 알린다 |
| 백업 | API 키·시크릿은 백업 파일에서 제외. 단 학생 명단·메모·생성 이력은 암호화 없이 포함되므로 백업 화면에 경고 문구 표시. 자동 정기 백업 기본값은 꺼짐(v1.19.0부터) |
| 학생 데이터 삭제 | 설정 화면의 "학생 데이터 전체 삭제" 버튼. 실제 삭제 대상과 안내 문구는 `lib/studentDataCleanup.ts`(`clearAllStudentData`·`STUDENT_DATA_TARGET_LABELS`) 한 곳에서 관리하고 테스트로 고정한다 — 생성 이력(`clearAllHistory`)·문서 이력(`clearDocumentHistory`)·학생 메모(localStorage+JSON)·작업 초안(`clearWorkDraft`)·학생 번호-이름 명렬표(`clearStudentRoster`)·설정의 학생 명단 3종. 학생 개인정보 저장소가 흩어져 있어 새 저장소 추가 시 누락되기 쉬우므로 한곳에 모았다. 되돌릴 수 없어 2단계 확인을 거친다 |
| 작업 자동 저장 | 생기부 4개 생성기·학생기록 챗봇의 GlobalState를 상태 변경 1.5초 후 `work-draft.json`에 디바운스 저장(`lib/workDraft.ts`). 다음 실행에서 `hasMeaningfulWork`가 참일 때만 복원 여부를 묻고, 자동 복원은 하지 않는다. `parseWorkDraft`가 구버전·손상 파일을 초기값 위에 방어적으로 병합한다. 데모(`#demo`)·채팅(`#chat`) 전용 창은 같은 App을 렌더링하므로 저장·복원 대상에서 제외 |
| 학생 번호-이름 명렬표 | 생기부 4개 생성기의 이름 입력칸에 실명 대신 번호·별명 입력을 권장하는 안내 문구를 추가하고, 설정에서 등록한 번호↔이름 매칭(`lib/studentRoster.ts`, `student-roster.json`)을 번호 입력 시 화면에만(로컬) 힌트로 보여준다(`RosterNameHint.tsx`). AI 요청 프롬프트·`geminiService.ts`는 전혀 건드리지 않는 순수 표시 계층이라, 등록 여부와 무관하게 생성 파이프라인은 항상 입력된 문자열을 그대로 식별자로 쓴다 |
| 학생 카드 | `StudentCardScreen.tsx`(사이드바 `우리반기록` 하위). AI 호출 없이 기존 저장 구조만 재사용해 한 학생의 기록을 모은다 — `lib/studentCard.ts`의 `loadStudentCard`가 4개 생성기 이력(`getHistory('opinion'|'subject'|'sports'|'creative', id)`)과 학생 메모(`generationSafety.ts`의 `memoStudents`/`normalizeName` 재사용)를 날짜순으로 합친다. 상담일지 등 "문서 이력"은 제목 기준 키(`DOCUMENT_HISTORY_KEY_PREFIX`)라 학생별로 신뢰성 있게 묶을 수 없어 범위에서 제외했다 |
| 학생 명단 | 필요한 기능에서만 명시적으로 불러오기 |
| 개인정보 보호 모드 | AI 요청 시 학생 이름을 임시 토큰으로 치환 후 응답에서 복원. 이름 입력칸이 있는 화면은 해당 이름만, 자유 서술형인 수업관찰기록·학급경영일지는 설정에 저장된 우리 반 학생 명단 기준으로 본문에 등장하는 이름을 치환한다. `withStudentPrivacy`/`withStudentListPrivacy`가 실제 적용 여부(`applied`)를 반환해 결과 카드에 "🔒 이름 가림 / 이름 그대로 전송" 배지로 표시한다. 나이스 성적 자료·학생 기록물 사진 업로드·간단 번역은 이 모드가 적용되지 않으며 화면에 경고 문구를 표시한다 |
| 공문서 | 우리 반 학생 명단 자동 반영 금지 |
| 파일 업로드 | 로컬에서 base64 (파일을 텍스트 형태로 변환하는 방식) 변환 후 필요한 경우에만 Gemini로 전송, 15MB 크기 상한. 확장자(accept) 검사를 `FileUpload.tsx`의 `handleFileArray` 진입점에서 수행해 파일 선택 대화상자뿐 아니라 드래그앤드롭·붙여넣기 경로에도 동일하게 적용 |
| 외부 링크 | `openExternal`로 브라우저 열기(https만 허용) |
| 외부 URL 요청 | `url:fetch-meta`·`resource:fetch-image`·`resource:youtube-meta`는 `net.request` 기반 `fetchSafely` 헬퍼(ipcHandlers.ts)로 리다이렉트마다 `netGuard.ts`의 `assertSafeUrl`을 재검사한다(최초 URL만 검사하면 공인 도메인이 사설 IP로 302를 보내는 우회가 가능했음). `resource:screenshot`은 `will-redirect` 이벤트에서 검사. `data:fetch-url-json`은 기존부터 `net.request`+홉별 재검사 |
| 스킬마켓 HTML 앱 | 외부 origin을 참조하는 `<script src=...>`는 `security.ts`의 `DANGEROUS_HTML_PATTERNS`가 차단(자체 코드를 담은 인라인 script는 허용). 마켓에서 가져온 도구는 `CustomTool.importedFromMarket` 플래그로 표시되며, 실행(브라우저에서 열기) 전 출처 확인창을 띄운다 |
| webview 격리 | 자료실의 `<webview>`는 전용 파티션(`persist:resource-browser`)을 사용해 앱 기본 세션과 쿠키·스토리지를 공유하지 않는다 |
| 권한 요청 | 모든 webContents에 `session.setPermissionRequestHandler`/`setPermissionCheckHandler`로 카메라·마이크·위치·알림 등 권한 요청을 기본 거부(main/index.ts) |
| PDF 변환 | `file:save-pdf`가 여는 임시 창은 전용 세션(`partition: 'pdf-render'`)에 `onHeadersReceived`로 CSP(`script-src 'none'` 등)를 주입해, 렌더러 CSP가 적용되지 않는 `file://` 컨텍스트에서도 스크립트 실행을 차단 |
| 설정값 접근 | `config:get`은 거부 목록이 아닌 허용 목록(`ALLOWED_CONFIG_KEYS`) 방식으로 검사해, 새 시크릿 키 등록을 깜빡해도 노출되지 않게 함 |
| renderer 보안 | `contextIsolation: true`, `nodeIntegration: false`, 본 창·PDF 변환 창 모두 샌드박스 적용, 외부 오리진 이동(`will-navigate`) 차단. CSP에 `base-uri 'self'`·`form-action 'none'`·`object-src 'none'` 포함 |
| 생성 결과 HTML | `sanitizeHtml`로 script·on* 속성·iframe 등을 제거한 뒤 화면에 표시 |

---

## 13. 빌드와 릴리즈 흐름

소스 코드를 수정한 뒤 사용자가 내려받을 수 있는 EXE 파일로 만들어지는 과정이다. 로컬에서 직접 빌드하지 않고 `main` 브랜치에 push하면 GitHub Actions (코드 저장소가 자동으로 빌드·배포 작업을 실행하는 기능)가 자동으로 처리한다.

```text
소스 수정
  ↓
package.json 버전(version 필드) 갱신
  ↓
RELEASE_NOTES.md 최신 버전 섹션 작성 (--- 구분선으로 분리)
  ↓
Git commit
  ↓
main 브랜치 push (Pull Request 병합 포함)
  ↓
.github/workflows/build-win.yml 자동 실행
  ↓
  ├─ npm ci → 타입체크 → 테스트 (품질 게이트 — 실패 시 릴리즈되지 않음)
  ├─ npm run build:win (electron-builder로 Windows portable EXE 빌드)
  └─ package.json 버전을 읽어 태그 v${version}으로 GitHub Release 생성/갱신
     (RELEASE_NOTES.md 최상단 섹션을 릴리즈 노트 본문으로 사용, EXE 업로드)
     (https://github.com/codersongpro/edunote/releases)
```

Git 태그는 이 워크플로가 릴리즈 생성 시 자동으로 붙이므로, 별도로 `git tag`를 만들어 push할 필요가 없다.

---

## 14. 다른 AI가 작업할 때의 주의사항

- `src/renderer/services/geminiService.ts`는 프롬프트와 생성 품질에 큰 영향을 주므로 문체 지침을 바꿀 때 문서 유형별 충돌을 확인해야 한다.
- 공문서·품의서는 합쇼체, 계획서·보고서는 보고서체라는 분리가 중요하다.
- 학생 명단은 자동 삽입하지 말고, 사용자가 명시적으로 불러온 경우에만 사용해야 한다.
- `preload/index.ts`에 새 API를 추가하면 반드시 `preload/types.d.ts`도 함께 수정해야 한다.
- main process 기능을 추가할 때는 `ipcHandlers.ts`에 IPC를 등록하고 renderer에서는 `window.electronAPI`만 사용한다.
- 파일 저장, 외부 브라우저 열기, PDF 저장은 Electron main process에서 처리한다.
- 퀴즈 앱은 외부 CDN 없이 단일 HTML로 동작해야 하며, AI는 JSON 데이터만 생성하고 HTML 구조는 고정 템플릿을 사용해야 한다.
- 인터넷 데이터를 가져올 때는 Node.js `https` 모듈이 아닌 `electron.net.fetch`를 사용해야 한다.
- `index.css`의 prose 스타일(마크다운 렌더링용)은 `dark-prose-area` 클래스로 범위가 한정되어 있다. 문서 미리보기나 챗봇 응답 영역에 prose를 적용할 때 다크모드에서 배경색과 텍스트 색상이 충돌하지 않도록 적용 범위를 확인해야 한다.
- 릴리즈는 `main` 브랜치 push 시 GitHub Actions가 자동으로 처리하므로, 로컬에서 EXE를 직접 빌드해 업로드하거나 Git 태그를 직접 만들 필요가 없다(13절 참고).
- 메뉴 항목을 추가할 때는 `AppMode` 열거형, `App.tsx`의 메뉴 배열, `renderMode` switch 세 곳을 모두 수정해야 한다. `AppMode`에는 실제로 어디에서도 참조되지 않는 값(`GUIDELINE_QA`, `QR_MAKER`, `LUCKY_DRAW`)이 남아 있으니 6절을 참고해 혼동하지 않는다.
- Demo 버튼은 `window:open-demo` IPC로 별도 `BrowserWindow`를 열며, 렌더러는 `window.location.hash === '#demo'` 여부로 Demo 전용 창인지 판단해 사이드바 없이 `DemoSamplesScreen`만 렌더링한다. 공문요약·업무추출 샘플에는 일정, 마감일, 참고 웹사이트 주소가 포함된다. 채팅방(`#chat`)도 같은 방식으로 별도 창을 판별한다.
- API 키·시크릿(Gemini·나라장터·네이버)을 다루는 코드를 추가할 때는 `secretStore.ts`의 `SECRET_KEYS`에서 파생되는 헬퍼(`SECRET_STORE_KEYS`·`isSecretKey`·`stripSecrets`)를 사용해야 한다. 렌더러 조회 차단·설정 파일 동기화·백업 제외 대상 목록을 각 위치에 따로 나열하면, 새 시크릿을 추가할 때 어느 한 곳이라도 빠뜨려 평문이 유출될 수 있다.
- AI가 완성된 `<!DOCTYPE html>` 문서를 반환하는 기능(문서작성기, 워크시트 등)을 만지거나 비슷한 기능을 추가할 때는 `generatedContent.ts`의 HTML 판별 정규식과 `security.ts`의 `sanitizeHtml`이 전체 문서 입력을 어떻게 다루는지 먼저 확인해야 한다. `<div>`로 감싸 파싱하면 중첩된 `<head>`/`<body>`가 브라우저 트리 구성 규칙에 따라 흐트러진다(10.4·12절, v1.18.4 참고).
- 여러 화면에 걸친 기능(예: 생성 모델 배지, 바이트 수 표시)을 추가할 때는 저수준 `aiGenerate`류 함수의 반환 타입을 바꾸기보다, 필요한 곳에만 선택적 콜백이나 별도 반환 타입을 추가해 TypeScript 컴파일러가 영향받는 호출부를 오류로 잡아내게 하는 방식을 우선 검토한다 — 이 저장소는 이 패턴으로 회귀 위험을 최소화해 왔다(8절·9.6절 참고).

---

## 15. 향후 확장 검토 사항

| 기능 | 검토 내용 |
| --- | --- |
| 상담 녹음 분석 | Gemini 오디오 입력으로 녹음파일 전사와 상담 요약 가능. 개인정보와 API tier 정책 검토 필요 |
| 슬라이드 전체 이미지 생성 | `LessonMaterialGenerator`에 버튼은 있으나 "구현중"으로 비활성화. 안정적인 이미지 생성 흐름 확보 필요 |
| 업무추출 정밀도 개선 | 업무 종류별로 캘린더 제목·날짜를 더 정밀하게 추출하도록 계속 개선 |
| 파일 제출방 | 학생이 QR로 접속해 파일을 제출하고 교사 PC에 저장하는 구조 가능. 인증, 용량 제한, 확장자 제한 필요 |
| 학생 서술 생성기 리팩터링 | 교과·창체·스포츠클럽·생기부 등 4개 컴포넌트에 중복된 생성 흐름 로직(사진 분석·모델 배지 포함)을 공용 훅으로 추출하고, 거대 컴포넌트(예산안작성·교과세특·창의적 체험활동·문서작성기)를 기능 단위로 분할하는 리팩터링 검토. 변경 범위가 커서 작업 전 별도 합의 필요 |

수업 참여방(QR 채팅방)은 v1.14.0에서 Firebase(Firestore+Auth) 기반 구조로 이미 정식 기능으로 도입되었다(9.4절 참고). HWPX 저장 역시 한글 원본 파일과의 바이트 단위 비교로 골격·서식 문제를 순차적으로 해결해 v1.14.0부터 안정적인 정식 기능으로 전환되었다(자세한 경과는 개발일지 참고).

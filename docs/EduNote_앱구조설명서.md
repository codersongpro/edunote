# EduNote 앱 구조 및 메커니즘 설명서

작성 기준: 2026년 5월 28일
대상 버전: EduNote v1.7.9
목적: 다른 AI 또는 개발자가 EduNote의 구조, 기능, 동작 방식을 빠르게 이해하기 위한 기술 설명 자료

## 1. 앱 개요

EduNote는 교사의 학생기록 작성, 교무행정 문서 작성, 수업자료 제작, 공문 업무추출, 자료 관리 업무를 하나의 Windows 데스크톱 앱에서 처리하기 위해 만든 Electron 기반 애플리케이션이다.

앱은 React 화면을 Electron 데스크톱 환경에서 실행하며, Gemini API를 통해 학생기록, 공문서, 수업자료, 업무 메모 등을 생성한다. 생성 결과는 HTML, PDF, TXT, CSV, HWPX 실험 형식 등으로 저장하거나 앱 내부에서 편집할 수 있다.

## 2. 전체 기술 스택

| 영역 | 사용 기술 | 역할 |
| --- | --- | --- |
| 데스크톱 런타임 | Electron 30 | Windows 앱 창, 파일 저장, PDF 출력, 외부 브라우저 열기, 로컬 데이터 접근 |
| 프론트엔드 | React 19, TypeScript, TSX | 앱 화면 구성, 메뉴 전환, 생성 결과 표시, 입력 폼 처리 |
| 빌드 도구 | electron-vite, Vite | main, preload, renderer 빌드 |
| 스타일 | Tailwind CSS, PostCSS | 화면 레이아웃, 다크모드, 버튼, 카드, 입력창 스타일 |
| AI SDK | @google/genai | Gemini API 호출, 텍스트·이미지·파일 입력 처리 |
| 로컬 저장 | electron-store, JSON 파일 | 사용자 설정, 학생 명단, 자료실, 학생 메모, 백업 데이터 저장 |
| 문서 처리 | HTML, CSS, Electron printToPDF | 공문서, 수업자료, 워크시트, PDF 저장 |
| HWPX 실험 | JSZip, @xmldom/xmldom | HWPX 내부 XML 분석 및 템플릿 치환 실험 |
| 마크다운 렌더링 | react-markdown | 챗봇 응답 마크다운 렌더링 |
| 아이콘 | lucide-react | 메뉴 및 버튼 아이콘 |
| QR 생성 | qrcode | QR 메이커 기능 |
| 배포 | electron-builder, GitHub Releases | Windows portable EXE 패키징 및 배포 |

## 3. 디렉터리 트리

```text
edunote
├─ package.json
├─ package-lock.json
├─ electron.vite.config.ts
├─ electron-builder.yml
├─ RELEASE_NOTES.md
├─ build
│  ├─ icon.ico
│  ├─ icon.png
│  └─ icon.svg
├─ src
│  ├─ main
│  │  ├─ index.ts
│  │  ├─ ipcHandlers.ts
│  │  ├─ GeminiService.ts
│  │  ├─ HwpxGenerator.ts
│  │  └─ store.ts
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
│     ├─ index.css
│     ├─ assets
│     │  └─ icon.png
│     ├─ components
│     │  ├─ HomeScreen.tsx
│     │  ├─ UsageGuideScreen.tsx
│     │  ├─ AboutScreen.tsx
│     │  ├─ SettingsScreen.tsx
│     │  ├─ RecordChatbot.tsx
│     │  ├─ GuidelineQA.tsx
│     │  ├─ OpinionGenerator.tsx
│     │  ├─ SubjectGenerator.tsx
│     │  ├─ SportsClubGenerator.tsx
│     │  ├─ CreativeActivityGenerator.tsx
│     │  ├─ EducationAssistantQA.tsx
│     │  ├─ OfficialDocAnalyzer.tsx
│     │  ├─ SchoolDocPanel.tsx
│     │  ├─ LessonMaterialGenerator.tsx
│     │  ├─ LessonObservationGenerator.tsx
│     │  ├─ CounselingLogGenerator.tsx
│     │  ├─ ClassManagementLogGenerator.tsx
│     │  ├─ StudentMemoBoard.tsx
│     │  ├─ QRMaker.tsx
│     │  ├─ MyResourceLibrary.tsx
│     │  ├─ LuckyDraw.tsx
│     │  ├─ GeneratedDisplay.tsx
│     │  ├─ FileUpload.tsx
│     │  └─ SchoolLevelSelector.tsx
│     ├─ constants
│     │  ├─ curriculum2022.ts
│     │  └─ curriculumStandards.ts
│     ├─ hooks
│     │  └─ useGenerationTracker.ts
│     ├─ lib
│     │  ├─ generatedContent.ts
│     │  ├─ generationHistory.ts
│     │  ├─ hwpx-parser.ts
│     │  ├─ hwpx-template.ts
│     │  └─ soundEffect.ts
│     └─ services
│        └─ geminiService.ts
└─ dist
   └─ edunote_버전_portable.exe
```

## 4. 주요 파일 역할

| 파일 | 역할 |
| --- | --- |
| `src/main/index.ts` | Electron 앱 창 생성, 앱 메뉴 구성, 앱 아이콘 설정, main process 진입점 |
| `src/main/ipcHandlers.ts` | renderer에서 요청하는 파일 저장, PDF 저장, 설정 저장, 백업, 외부 열기, AI 호출 IPC 처리 |
| `src/main/GeminiService.ts` | Gemini API 실제 호출, 모델 선택, 무료·유료 API 등급 처리, 이미지 생성 |
| `src/main/HwpxGenerator.ts` | HWPX 파일 생성 실험 기능 |
| `src/main/store.ts` | electron-store 인스턴스 관리 |
| `src/preload/index.ts` | renderer가 사용할 수 있는 `window.electronAPI` 노출 |
| `src/preload/types.d.ts` | `window.electronAPI` 타입 정의 |
| `src/renderer/App.tsx` | 전체 화면 라우팅, 사이드바 메뉴, 메뉴 드래그 재정렬, 전역 상태, 다크모드, 생성 중단, 토스트 처리 |
| `src/renderer/types.ts` | AppMode, DocType, 학생 데이터, 생성 요청, 파일 데이터 등 핵심 타입 정의 |
| `src/renderer/constants.ts` | 공통 상수, 공문서 시스템 지침, 로딩 문구, 학생기록 예시 등 |
| `src/renderer/services/geminiService.ts` | renderer 쪽 AI 프롬프트 생성, 메뉴별 생성 함수, 결과 후처리 |
| `src/renderer/GlobalStateContext.tsx` | 생성 중에도 화면 상태를 유지하기 위한 전역 상태 컨텍스트 |
| `src/renderer/components/GeneratedDisplay.tsx` | 생성된 HTML 결과 표시, 편집, 복사, 저장, PDF 저장 |
| `src/renderer/components/FileUpload.tsx` | 공통 파일 업로드 컴포넌트, 이미지·PDF·HWPX 등 처리 |
| `src/renderer/hooks/useGenerationTracker.ts` | 메뉴별 생성 진행 상태를 전역 진행 상태와 연결 |

## 5. 앱 모드 구조

`AppMode`는 앱의 화면 단위를 정의한다. `App.tsx`가 현재 mode 상태를 보고 어떤 컴포넌트를 보여줄지 결정한다.

| 섹션 | AppMode | 화면 컴포넌트 | 기능 |
| --- | --- | --- | --- |
| 기본 | `HOME` | `HomeScreen` | 홈 화면, 기능 요약, 업데이트 안내 |
| 기본 | `USAGE_GUIDE` | `UsageGuideScreen` | 사용법 안내 |
| 기본 | `SETTINGS` | `SettingsScreen` | API 키, 학교급, 소속기관, 저장 위치, 백업 설정 |
| 기본 | `ABOUT` | `AboutScreen` | 앱 정보, 버전, 업데이트 확인 |
| 학생기록 AI | `RECORD_CHATBOT` | `RecordChatbot` | 생활기록부 기재 상담 챗봇 |
| 학생기록 AI | `GUIDELINE_QA` | `GuidelineQA` | 기재요령 질의응답 |
| 학생기록 AI | `GENERATOR` | `OpinionGenerator` | 행동특성 및 종합의견 생성 |
| 학생기록 AI | `SUBJECT_GENERATOR` | `SubjectGenerator` | 교과세특 생성 |
| 학생기록 AI | `SPORTS_CLUB_GENERATOR` | `SportsClubGenerator` | 학교스포츠클럽 특기사항 생성 |
| 학생기록 AI | `CREATIVE_ACTIVITY_GENERATOR` | `CreativeActivityGenerator` | 창의적 체험활동 특기사항 생성 |
| 학생기록 AI | `COUNSELING_LOG` | `CounselingLogGenerator` | 상담일지 생성 |
| 학생기록 AI | `CLASS_LOG` | `ClassManagementLogGenerator` | 학급경영일지 생성 |
| 학생기록 AI | `STUDENT_MEMO` | `StudentMemoBoard` | 학생 메모 등록·필터링 |
| 수업 AI | `LESSON_MATERIAL` | `LessonMaterialGenerator` | 슬라이드, 워크시트, 퀴즈, 수업계획서, 게임 생성 |
| 수업 AI | `LESSON_OBSERVATION` | `LessonObservationGenerator` | 수업관찰기록 생성 |
| 수업 AI | `QR_MAKER` | `QRMaker` | URL QR 코드 생성 |
| 수업 AI | `MY_RESOURCES` | `MyResourceLibrary` | 자료 링크·파일 관리 |
| 수업 AI | `LUCKY_DRAW` | `LuckyDraw` | 긍정 주제 추첨 (오늘의 주인공 등) |
| 교무 AI | `EDUCATION_QA` | `EducationAssistantQA` | 교육 일반 질의응답 |
| 교무 AI | `OFFICIAL_DOC_ANALYZER` | `OfficialDocAnalyzer` | 공문 업무추출, 일정화 |
| 교무 AI | `SCHOOL_DOC` | `SchoolDocPanel` | 공문서, 계획서, 보고서 등 9종 문서 생성 |

## 6. 교무행정 문서 타입

`DocType`은 `SchoolDocPanel`에서 사용하는 문서 유형이다. 실제 생성 프롬프트는 `src/renderer/services/geminiService.ts`의 `generateDocument` 내부에서 분기된다.

| DocType | 문서명 | 주요 문체·구조 |
| --- | --- | --- |
| `GONGMUN` | 공문서 | 수신, 경유, 제목, 관련, 본문, 붙임, 끝. 합쇼체 |
| `PLAN` | 계획서 | 추진배경, 목적, 운영방침, 세부추진계획, 소요예산, 기대효과. 개조식 보고서체. 제목 크게/진하게/가운데 정렬 |
| `REPORT` | 보고서 | 추진개요, 추진실적, 운영결과, 예산정산, 성과 및 제언. 완료형 보고서체. 주제·대상·예산 입력칸 제공 |
| `PUMUI` | 품의서 | 관련, 시행문, 세부내역, 산출내역. 합쇼체 |
| `MEETING_MINUTES` | 회의록 | 일시, 장소, 참석자, 안건, 발언 내용, 서명란 |
| `PROMOTION` | 홍보자료 | 보도자료와 SNS 홍보용 요약 |
| `NEWSLETTER` | 가정통신문 | 제목, 인사말, 안내 내용, 맺음말, 날짜, 학교장 |
| `MESSAGE` | 문자&소통메시지 | SMS/LMS 길이 제한 반영 |
| `GONGGO` | 공고문 | 공고번호, 제목, 공고일, 내용, 접수기간, 문의처 |

## 7. Gemini 모델 구성

`src/main/GeminiService.ts`에서 API 등급에 따라 모델을 선택한다.

| 등급 | 모델 | 특징 |
| --- | --- | --- |
| 무료 (Free) | `gemini-2.5-flash-lite` | 빠른 응답, 분당 요청 한도 있음 |
| 유료 (Paid) | `gemini-2.5-pro` | 더 높은 품질, 높은 사용 한도 |

오류 처리:
- 429/503 (쿼터 초과): 60초 임시 차단 후 재시도
- 403 (권한 거부): 1시간 차단 후 상위 모델 재시도
- 타임아웃: 최대 90초 대기

## 8. 주요 기능별 설명

### 8.1 학생기록 AI

| 기능 | 입력 | 처리 | 출력 |
| --- | --- | --- | --- |
| 행동특성 및 종합의견 | 학교급, 학생명, 긍정·보완 태그, 추가 맥락 | 생활기록부 문체 지침과 예시를 반영해 생성 | 학생별 종합의견 문장 |
| 교과세특 | 학생명, 교과, 과제·수행평가, 성취수준, 관찰 내용 | 성취수준별 표현과 사고 과정 중심 프롬프트 적용 | 교과별 세특 문장 |
| 스포츠클럽 | 학생명, 종목, 관찰 내용 | 공동체역량, 역할, 협력 방식 중심 생성 | 스포츠클럽 특기사항 |
| 창의적 체험활동 | 활동 영역, 태그, 추가 맥락 | 활동-탐구-진로 연결 구조로 생성 | 창체 특기사항 |
| 상담일지 | 상담 관련 내용 | 학교 상담 양식 기반 생성 | 상담일지 |
| 학급경영일지 | 학급 운영 내용 | 학급경영 기록 양식 생성 | 학급경영일지 |
| 생활기록부 상담 | 질문, 학교급 | 기재요령 컨텍스트 기반 응답 | 기재 방법 안내 |

### 8.2 교무행정 AI

| 기능 | 입력 | 처리 | 출력 |
| --- | --- | --- | --- |
| 공문서 작성 | 문서 유형, 제목, 본문 요청, 첨부 파일 | 문서 유형별 구조와 문체 지침 적용 | HTML 문서 |
| 계획서 | 사업 내용, 학교 정보, 날짜 | 개조식, 표, 제목 서식 지침 적용 | 계획서 HTML |
| 보고서 | 주제, 대상, 예산/집행액, 운영 결과, 추가 사항, 참고 파일 | 완료형 보고서체, 표 중심 결과 정리 | 보고서 HTML |
| 품의서 | 품의 유형, 근거, 예산, 산출내역 | 산출내역 텍스트화, 합쇼체 적용 | 지출품의서 |
| 회의록 | 일시, 장소, 안건, 발언 내용 | 표 기반 회의록 구조 적용 | 회의록 HTML |
| 업무추출 | 공문 텍스트 또는 파일 | 마감, 일시, 장소, 링크, 제출 업무 추출 | 짧은 업무 메모, 캘린더 링크 |

### 8.3 수업자료 AI

| 기능 | 입력 | 처리 | 출력 |
| --- | --- | --- | --- |
| 수업 슬라이드 | 학년, 교과, 단원, 주제, 성취기준 | 슬라이드 JSON 생성, 교사 메모, 이미지 프롬프트 생성 | 슬라이드 화면, PDF/TXT 저장 |
| 워크시트·평가지 | 학년, 교과, 주제, 문항 수 | A4 인쇄용 HTML 생성 | HTML, PDF |
| 퀴즈 앱 | 주제, 문항 수 | 단일 HTML 퀴즈 앱 생성 | 앱 미리보기, HTML/PDF |
| 수업 계획서 | 수업 정보 | 수업 개요, 목표, 과정안, 평가계획을 표로 구성 | HTML 문서 |
| 교육용 게임 | 주제, 학년, 교과 | 퍼즐·아케이드·퀘스트 등 단일 HTML 게임 생성 | 안전 시작 화면, 브라우저 열기, HTML |
| 수업관찰기록 | 수업 정보, 관찰 내용 | 관찰 기록 양식 생성 | HTML 문서 |

### 8.4 수업 운영 도구

| 기능 | 역할 |
| --- | --- |
| QR 메이커 | 수업 링크나 자료 링크를 QR 코드로 변환 |
| 나만의 자료실 | URL, 유튜브, 파일 자료를 주제별로 저장·검색 |
| 오늘의 주인공 | 발표, 칭찬 주인공 등 긍정 주제로 학생 추첨 |
| 학생 메모 보드 | 제목, 학생 여러 명, 내용을 기록하고 학생·키워드로 필터링 |

### 8.5 설정·운영 기능

| 기능 | 역할 |
| --- | --- |
| API 키 설정 | Gemini 무료·유료 API 키 저장 및 사용 가능 여부 확인 |
| 학교 정보 | 학교급, 학년반, 소속기관, 학생 명단 저장 |
| 다크모드 | 앱 전체 테마 전환 |
| 생성 중단 | 진행 중인 생성 요청을 사용자 쪽에서 중단 |
| 생성 히스토리 | 이전 생성 결과 재활용 |
| 전체 자료 백업 | 설정과 자료 데이터를 JSON으로 내보내기 |
| 백업 불러오기 | 다른 PC에서 기존 자료 복원 |

## 9. 핵심 동작 메커니즘

### 9.1 화면 전환 메커니즘

1. 사용자가 사이드바 메뉴를 클릭한다.
2. `App.tsx`의 `mode` 상태가 변경된다.
3. `mode` 값에 따라 해당 컴포넌트가 렌더링된다.
4. 한 번 열린 화면은 `mountedModes`에 기록되어, 생성 중 화면을 이동해도 상태가 유지된다.
5. 생성 중 다른 메뉴로 이동하면 동시 생성 안내가 표시될 수 있다.

### 9.2 메뉴 드래그 재정렬 메커니즘

1. 사용자가 사이드바 메뉴 항목을 드래그한다.
2. `reorderMenuItem` 함수가 섹션별 메뉴 배열을 업데이트한다.
3. 변경된 순서는 `localStorage`에 `edunote_menu_order_${section}_v1` 키로 저장된다.
4. 앱을 재시작해도 저장된 순서가 유지된다.

### 9.3 AI 생성 메커니즘

```text
사용자 입력
  ↓
renderer 컴포넌트
  ↓
src/renderer/services/geminiService.ts
  ↓
프롬프트 및 시스템 지침 구성
  ↓
window.electronAPI.aiGenerate 또는 aiGenerateMultipart
  ↓
preload/index.ts
  ↓
ipcHandlers.ts
  ↓
main/GeminiService.ts
  ↓
Gemini API
  ↓
응답 텍스트 반환
  ↓
후처리 및 화면 표시
```

AI 생성은 renderer에서 직접 Gemini API를 호출하지 않는다. renderer는 preload가 노출한 안전한 API만 사용하고, 실제 API 키 접근과 Gemini 호출은 main process에서 처리한다.

### 9.4 IPC 메커니즘

| 단계 | 설명 |
| --- | --- |
| renderer | React 컴포넌트에서 `window.electronAPI` 호출 |
| preload | `contextBridge.exposeInMainWorld`로 허용된 함수만 노출 |
| main | `ipcMain.handle`로 요청 수신 |
| 처리 | 파일 저장, 설정 읽기, AI 호출, PDF 저장, 외부 열기 수행 |
| 반환 | Promise 결과를 renderer로 반환 |

이 구조는 `nodeIntegration: false`, `contextIsolation: true` 환경에서 renderer의 직접 Node 접근을 막고, 필요한 기능만 제한적으로 제공하기 위한 구조이다.

### 9.5 로컬 데이터 저장 메커니즘

| 데이터 | 저장 방식 | 관련 IPC |
| --- | --- | --- |
| API 키 | electron-store | `config:set-api-key`, `config:has-api-key` |
| 학교 정보 | electron-store | `config:get`, `config:set` |
| 학생 명단 | electron-store 및 JSON | `config:get`, `data:write-json` |
| 자료실 | JSON 파일 | `data:read-json`, `data:write-json` |
| 학생 메모 | JSON 파일 | `data:read-json`, `data:write-json` |
| 메뉴 순서 | localStorage | 키: `edunote_menu_order_${section}_v1` |
| 백업 파일 | JSON 내보내기 | `data:export-backup`, `data:import-backup` |

API 키는 백업 파일에 포함하지 않는 방향으로 설계되어 있다.

### 9.6 문서 생성 메커니즘

1. 사용자가 문서 유형과 요청 내용을 입력한다.
2. `SchoolDocPanel`이 입력값을 문서 유형별 context로 정리한다.
3. `generateDocument`가 `DocType`에 따라 지침을 선택한다.
4. 공문서·품의서는 합쇼체, 계획서·보고서는 보고서체, 가정통신문은 안내문체를 적용한다.
5. Gemini 응답을 HTML 형태로 받아 `GeneratedDisplay`에 표시한다.
6. 사용자는 결과를 편집, 복사, PDF 저장, Word 저장, HWPX 저장 실험 기능으로 내보낼 수 있다.

### 9.7 교육용 게임 실행 메커니즘

```text
수업자료 입력
  ↓
generateLessonGame
  ↓
단일 HTML 게임 생성
  ↓
extractHtml
  ↓
ensureStartButton
  ↓
임시 HTML 파일 저장
  ↓
에듀노트 안전 시작 화면 (안전 래퍼 HTML)
  ↓
  ├─ 게임 시작 버튼 → 원본 게임 HTML iframe 실행
  └─ 브라우저에서 열기 버튼 → openHtmlExternal IPC → 기본 브라우저에서 실행
```

게임 HTML은 외부 CDN과 외부 이미지 없이 인라인 CSS·JavaScript만 사용한다. 안전 시작 화면은 게임이 깨지거나 시작 버튼이 없는 경우에도 실행할 수 있도록 보완한다.

### 9.8 PDF 저장 메커니즘

1. renderer가 저장할 HTML 문자열을 main process로 보낸다.
2. main process가 보이지 않는 `BrowserWindow`를 생성한다.
3. HTML을 로드한 뒤 Electron `printToPDF`를 실행한다.
4. 사용자가 지정한 경로 또는 기본 저장 위치에 PDF를 저장한다.

### 9.9 공문 업무추출과 캘린더 연동 메커니즘

1. 사용자가 공문 텍스트나 파일을 입력한다.
2. Gemini가 업무명, 마감, 일시, 장소, 링크, 제출 사항을 짧은 업무 메모로 정리한다.
3. 일정 정보가 있으면 Google Calendar URL 파라미터를 구성한다.
4. `openExternal`을 통해 브라우저의 Google Calendar 일정 작성 화면을 연다.

## 10. 프롬프트 설계 원칙

| 영역 | 원칙 |
| --- | --- |
| 공통 | AI가 작성했다는 문구, 초안 문구, 불필요한 이모지, Markdown 강조 기호 금지 |
| 학생기록 | 교육적이고 공적인 언어, 관찰 근거 중심, 과장 표현 금지 |
| 공문서 | 엄밀한 공적 언어, 시행문은 합쇼체 |
| 품의서 | 시행문은 합쇼체, 산출내역은 표 대신 텍스트 |
| 계획서 | 추진배경, 목적, 기대효과를 `가. 나. 다.` 개조식으로 작성. 제목 크게/진하게/가운데 정렬 |
| 보고서 | 완료된 결과 중심, 추진실적과 예산정산은 표 활용 |
| 수업자료 | 학년 수준, 성취기준, 실제 수업 활용성 반영 |
| 게임 | 학생 흥미 요소, 사운드 효과, 시작 버튼, 결과 화면 포함. 외부 CDN 사용 금지 |

## 11. 보안 및 개인정보 설계

| 항목 | 설계 방향 |
| --- | --- |
| API 키 | main process와 electron-store 중심으로 관리 |
| 백업 | API 키는 백업 제외 |
| 학생 명단 | 필요한 기능에서만 명시적으로 불러오기 |
| 공문서 | 우리 반 학생 명단 자동 반영 금지 |
| 파일 업로드 | 로컬에서 base64 변환 후 필요한 경우에만 Gemini로 전송 |
| 외부 링크 | `openExternal`로 브라우저 열기 |
| renderer 보안 | `contextIsolation: true`, `nodeIntegration: false` |

## 12. 빌드와 릴리즈 흐름

```text
소스 수정
  ↓
npm run build
  ↓
npm run build:win
  ↓
dist/edunote_버전_portable.exe 생성
  ↓
package.json, package-lock.json 버전 확인
  ↓
RELEASE_NOTES.md 작성
  ↓
Git commit
  ↓
Git tag
  ↓
GitHub push
  ↓
GitHub Release 생성 (https://github.com/codersongpro/edunote/releases)
  ↓
portable EXE 업로드
```

현재 운영 방식은 로컬에서 실제 EXE를 패키징한 뒤 GitHub Releases에 직접 업로드하는 방식이다.

## 13. 다른 AI가 작업할 때의 주의사항

- `src/renderer/services/geminiService.ts`는 프롬프트와 생성 품질에 큰 영향을 주므로 문체 지침을 바꿀 때 문서 유형별 충돌을 확인해야 한다.
- 공문서·품의서는 합쇼체, 계획서·보고서는 보고서체라는 분리가 중요하다.
- 학생 명단은 자동 삽입하지 말고, 사용자가 명시적으로 불러온 경우에만 사용해야 한다.
- `preload/index.ts`에 새 API를 추가하면 반드시 `preload/types.d.ts`도 함께 수정해야 한다.
- main process 기능을 추가할 때는 `ipcHandlers.ts`에 IPC를 등록하고 renderer에서는 `window.electronAPI`만 사용한다.
- 파일 저장, 외부 브라우저 열기, PDF 저장은 Electron main process에서 처리한다.
- 수업자료 게임과 퀴즈는 외부 CDN 없이 단일 HTML로 동작해야 한다.
- 릴리즈 전에는 `npm run build` 또는 `npm run build:win`으로 로컬 검증을 해야 한다.
- 메뉴 항목을 추가할 때는 `AppMode` 열거형, `App.tsx`의 메뉴 배열, `renderMode` switch 세 곳을 모두 수정해야 한다.

## 14. 향후 확장 검토 사항

| 기능 | 검토 내용 |
| --- | --- |
| 상담 녹음 분석 | Gemini 오디오 입력으로 녹음파일 전사와 상담 요약 가능. 개인정보와 API tier 정책 검토 필요 |
| 수업 참여방 | 교사 PC 로컬 서버와 QR 입장 구조 가능. 교사망·학생망 분리 환경에서는 외부 서버 방식 검토 필요 |
| 파일 제출방 | 학생이 QR로 접속해 파일을 제출하고 교사 PC에 저장하는 구조 가능. 인증, 용량 제한, 확장자 제한 필요 |
| HWPX 정식 저장 | 문서 구조 보존 안정성이 확보되면 구현중 상태에서 정식 기능으로 전환 가능 |
| 게임 템플릿 강화 | 생성형 HTML 품질 편차를 줄이기 위해 템플릿 기반 보정 가능 |

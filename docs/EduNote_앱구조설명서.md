# EduNote 앱 구조 및 메커니즘 설명서

작성 기준: 2026년 6월 12일
대상 버전: EduNote v1.14.0
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
│  ├─ 수업 도구                ← 트리 서브메뉴
│  │  ├─ QR 메이커
│  │  └─ 럭키드로우
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
│     └─ 학생 메모 보드
│
└─ [AI 스킬즈]                  ← 하위메뉴 드래그 정렬 지원
   ├─ 내 스킬                  ← 스킬 목록·실행·수정·공유, HTML 앱 만들기(HtmlAppCreator) (MY_AI_TOOLS)
   └─ 스킬마켓             ← 마켓에서 가져오기 (MY_AI_TOOLS_SHARED)

사이드바 하단: Demo (별도 창으로 열림)
```

---

## 3. 전체 기술 스택

| 영역 | 사용 기술 | 역할 |
| --- | --- | --- |
| 데스크톱 런타임 | Electron 30 | Windows 앱 창, 파일 저장, PDF 출력, 외부 브라우저 열기, 로컬 데이터 접근 |
| 프론트엔드 | React 19, TypeScript, TSX | 앱 화면 구성, 메뉴 전환, 생성 결과 표시, 입력 폼 처리 |
| 빌드 도구 | electron-vite, Vite | main, preload, renderer 빌드 |
| 스타일 | Tailwind CSS, PostCSS | 화면 레이아웃, 다크모드, 버튼, 카드, 입력창 스타일 |
| AI SDK | @google/genai | Gemini API 호출, 텍스트·이미지·파일 입력 처리 |
| 로컬 저장 | electron-store, JSON 파일 | 사용자 설정, 학생 명단, 자료실, 학생 메모, 백업 데이터 저장 |
| 문서 처리 | HTML, CSS, Electron printToPDF | 공문서, 수업자료, 워크시트, PDF 저장 |
| HWPX 저장 | JSZip, @xmldom/xmldom | HWPX 내부 XML 생성·분석, 줄 배치 정보(lineseg)와 기본 문서 포맷 구성 |
| 마크다운 렌더링 | react-markdown | 챗봇 응답 마크다운 렌더링 |
| 아이콘 | lucide-react | 메뉴 및 버튼 아이콘 |
| QR 생성 | qrcode | QR 메이커 기능 |
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
│     │  ├─ MyToolsScreen.tsx
│     │  ├─ MyToolEditor.tsx
│     │  ├─ MyToolRunner.tsx
│     │  ├─ MyToolChatCreator.tsx
│     │  └─ SchoolLevelSelector.tsx
│     ├─ data
│     │  └─ sampleTools.ts
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

---

## 5. 주요 파일 역할

| 파일 | 역할 |
| --- | --- |
| `src/main/index.ts` | Electron 앱 창 생성, 앱 메뉴 구성, 앱 아이콘 설정, main process (앱의 핵심 기능을 실제로 실행하는 부분) 진입점 |
| `src/main/ipcHandlers.ts` | renderer (사용자가 보는 화면을 그리는 부분)에서 요청하는 파일 저장, PDF 저장, 설정 저장, 백업, 외부 열기, AI 호출 IPC (화면과 앱 본체 사이의 메시지 전달 통로) 처리 |
| `src/main/GeminiService.ts` | Gemini API 실제 호출, 모델 선택, 무료·유료 API 등급 처리, 이미지 생성 |
| `src/main/HwpxGenerator.ts` | HWPX 파일 생성 기능. 제목·본문·표 포맷과 줄 배치 정보를 구성한다. |
| `src/main/store.ts` | electron-store 인스턴스 관리 |
| `src/preload/index.ts` | preload (화면과 앱 본체를 안전하게 연결하는 중간 다리)가 renderer에 노출하는 `window.electronAPI` 정의 |
| `src/preload/types.d.ts` | `window.electronAPI` 타입 정의 |
| `src/renderer/App.tsx` | 전체 화면 라우팅, 사이드바 메뉴, 메뉴 드래그 재정렬, 전역 상태, 다크모드, 생성 중단, 토스트 처리, 메인 사이드바 접기 |
| `src/renderer/types.ts` | AppMode, DocType, 학생 데이터, 생성 요청, 파일 데이터 등 핵심 타입 정의 |
| `src/renderer/constants.ts` | 공통 상수, 공문서 시스템 지침, 로딩 문구, 학생기록 예시 등 |
| `src/renderer/services/geminiService.ts` | renderer 쪽 AI 프롬프트 생성, 메뉴별 생성 함수, 결과 후처리 |
| `src/renderer/GlobalStateContext.tsx` | 생성 중에도 화면 상태를 유지하기 위한 전역 상태 컨텍스트 |
| `src/renderer/components/GeneratedDisplay.tsx` | 생성된 HTML 결과 표시, 편집, 복사, 저장, PDF 저장 |
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
| 교무행정AI | `SCHOOL_DOC` | `SchoolDocPanel` | 공문서, 계획서, 보고서 등 9종 문서 생성 |
| 교무행정AI | `DOC_ARCHIVE` | `DocArchivePanel` | 공문 캡처 이미지·첨부 저장 및 검색 |
| 교무행정AI | `PRINT_FORM` | `PrintFormScreen` | 학교 양식 10종 A4 출력·PDF 저장 |
| 교무행정AI | `BUDGET_PLANNER` | `BudgetPlannerScreen` | 과목별 비율 방식 또는 일반 작성 방식의 예산안 작성, 단가·수량 조합, 0원 맞추기, CSV 입출력 |
| 수업자료AI | `LESSON_MATERIAL` | `LessonMaterialGenerator` | 슬라이드, 워크시트, 퀴즈, 수업계획서 생성 |
| 수업자료AI | `CLASS_TOOLS` | `ClassToolsPanel` | 수업 도구 탭 컨테이너 (QR 메이커 / 럭키드로우) |
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

---

## 7. 교무행정 문서 타입

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

---

## 8. Gemini 모델 구성

`src/main/GeminiService.ts`에서 API 등급에 따라 모델을 선택한다.

| 등급 | 모델 | 특징 |
| --- | --- | --- |
| 무료 (Free) | `gemini-2.5-flash-lite` | 빠른 응답, 분당 요청 한도 있음 |
| 유료 (Paid) | `gemini-2.5-pro` | 더 높은 품질, 높은 사용 한도 |

오류 처리:
- 429/503 (쿼터 초과): 60초 임시 차단 후 재시도
- 403 (권한 거부): 1시간 차단 후 상위 모델 재시도
- 타임아웃: 최대 90초 대기

---

## 9. 주요 기능별 설명

### 9.1 학생기록 AI

| 기능 | 입력 | 처리 | 출력 |
| --- | --- | --- | --- |
| 행동특성 및 종합의견 | 학교급, 학생명, 긍정·보완 태그, 추가 맥락 | 생활기록부 문체 지침과 예시를 반영해 생성 | 학생별 종합의견 문장 |
| 교과세특 | 학생명, 교과, 과제·수행평가, 성취수준, 관찰 내용 | 성취수준별 표현과 사고 과정 중심 프롬프트 적용 | 교과별 세특 문장 |
| 스포츠클럽 | 학생명, 종목, 관찰 내용 | 공동체역량, 역할, 협력 방식 중심 생성 | 스포츠클럽 특기사항 |
| 창의적 체험활동 | 활동 영역, 태그, 추가 맥락 | 활동-탐구-진로 연결 구조로 생성 | 창체 특기사항 |
| 상담일지 | 상담 관련 내용 | 학교 상담 양식 기반 생성 | 상담일지 |
| 학급경영일지 | 학급 운영 내용 | 학급경영 기록 양식 생성 | 학급경영일지 |
| 생활기록부 상담 | 질문, 학교급 | 기재요령 컨텍스트 기반 응답 | 기재 방법 안내 |

### 9.2 교무행정 AI

| 기능 | 입력 | 처리 | 출력 |
| --- | --- | --- | --- |
| 공문서 작성 | 문서 유형, 제목, 본문 요청, 첨부 파일 | 문서 유형별 구조와 문체 지침 적용 | HTML 문서 |
| 계획서 | 사업 내용, 학교 정보, 날짜 | 개조식, 표, 제목 서식 지침 적용 | 계획서 HTML |
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

수업 도구(CLASS_TOOLS)는 탭 컨테이너로, QR 메이커와 럭키드로우를 탭 방식으로 전환한다. 사이드바에서는 수업 도구 항목 클릭 시 서브메뉴가 트리로 펼쳐진다.

| 기능 | 역할 |
| --- | --- |
| QR 메이커 | 수업 링크나 자료 링크를 QR 코드로 변환 |
| 럭키드로우 | 발표, 칭찬 주인공 등 긍정 주제로 학생 추첨 |
| 나만의 자료실 | URL, 유튜브, 파일 자료를 주제별로 저장·검색 |
| 학생 메모 보드 | 제목, 학생 여러 명, 내용을 기록하고 학생·키워드로 필터링 |

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
window.electronAPI.aiGenerate 또는 aiGenerateMultipart (안전한 호출 통로)
  ↓
preload/index.ts (중간 다리 역할)
  ↓
ipcHandlers.ts (요청 수신 및 전달)
  ↓
main/GeminiService.ts (실제 Gemini API 호출)
  ↓
Gemini API (구글 AI 서버)
  ↓
응답 텍스트 반환
  ↓
후처리 및 화면 표시
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
| API 키 | electron-store (앱 전용 설정 저장소) | `config:set-api-key`, `config:has-api-key` |
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
4. 공문서·품의서는 합쇼체, 계획서·보고서는 보고서체, 가정통신문은 안내문체를 적용한다.
5. Gemini 응답을 HTML 형태로 받아 `GeneratedDisplay`에 표시한다.
6. 사용자는 결과를 편집, 복사, PDF 저장, Word 저장, HWPX 저장 실험 기능으로 내보낼 수 있다.

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

---

## 12. 보안 및 개인정보 설계

| 항목 | 설계 방향 |
| --- | --- |
| API 키 | main process와 electron-store 중심으로 관리 |
| 백업 | API 키는 백업 제외 |
| 학생 명단 | 필요한 기능에서만 명시적으로 불러오기 |
| 공문서 | 우리 반 학생 명단 자동 반영 금지 |
| 파일 업로드 | 로컬에서 base64 (파일을 텍스트 형태로 변환하는 방식) 변환 후 필요한 경우에만 Gemini로 전송 |
| 외부 링크 | `openExternal`로 브라우저 열기 |
| renderer 보안 | `contextIsolation: true`, `nodeIntegration: false` |

---

## 13. 빌드와 릴리즈 흐름

소스 코드를 수정한 뒤 사용자가 내려받을 수 있는 EXE 파일로 만들어지는 과정이다. 로컬에서 직접 빌드하지 않고 `main` 브랜치에 push하면 GitHub Actions (코드 저장소가 자동으로 빌드·배포 작업을 실행하는 기능)가 자동으로 처리한다.

```text
소스 수정
  ↓
package.json, package-lock.json 버전 확인
  ↓
RELEASE_NOTES.md 작성
  ↓
Git commit
  ↓
Git tag 생성
  ↓
main 브랜치 push
  ↓
GitHub Actions 자동 실행
  ↓
  ├─ Windows EXE 자동 빌드 (electron-builder)
  └─ GitHub Release 자동 생성 및 portable EXE 업로드
     (https://github.com/codersongpro/edunote/releases)
```

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
- 릴리즈는 `main` 브랜치 push 시 GitHub Actions가 자동으로 처리하므로, 로컬에서 EXE를 직접 빌드해 업로드하지 않는다.
- 메뉴 항목을 추가할 때는 `AppMode` 열거형, `App.tsx`의 메뉴 배열, `renderMode` switch 세 곳을 모두 수정해야 한다.
- Demo 버튼은 `window:open-demo` IPC로 별도 `BrowserWindow`를 열며, 렌더러는 `window.location.hash === '#demo'` 여부로 Demo 전용 창인지 판단해 사이드바 없이 `DemoSamplesScreen`만 렌더링한다. 공문요약·업무추출 샘플에는 일정, 마감일, 참고 웹사이트 주소가 포함된다.

---

## 15. 향후 확장 검토 사항

| 기능 | 검토 내용 |
| --- | --- |
| 상담 녹음 분석 | Gemini 오디오 입력으로 녹음파일 전사와 상담 요약 가능. 개인정보와 API tier 정책 검토 필요 |
| 수업 참여방 | 교사 PC 로컬 서버와 QR 입장 구조 가능. 교사망·학생망 분리 환경에서는 외부 서버 방식 검토 필요 |
| 파일 제출방 | 학생이 QR로 접속해 파일을 제출하고 교사 PC에 저장하는 구조 가능. 인증, 용량 제한, 확장자 제한 필요 |
| HWPX 저장 개선 | 한글 호환성, lineseg 생성, 표·본문 포맷 유지, 양식 인쇄 등 추가 화면 적용 범위 확대 |

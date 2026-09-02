# EduNote 약점·맹점 분석 보고서

- 분석 기준 버전: v1.26.2 (2026-09-02)
- 분석 범위: 보안·데이터 프라이버시, 코드 품질·아키텍처, 운영(배포·업데이트)
- 방법: 코드 직접 확인(파일:라인 근거) — 추측성 서술 제외

---

## 짧고 명확한 요약

EduNote는 Electron 보안 모범사례(contextIsolation, sandbox, safeStorage 암호화, IPC 검증)를 이미 상당히 잘 적용한 편입니다. 다만 다음 4가지가 실질적 리스크입니다.

1. **Windows 실행파일이 코드 서명 없이 배포**되어 SmartScreen 경고와 무결성 검증 불가 문제가 있음
2. **electron-store 백업·설정 JSON이 학생 개인정보를 평문으로 저장**하면서 파일 권한 제한이 없음
3. **다중 인스턴스 락이 없고 저장이 원자적이지 않아**, 중복 실행이나 강제 종료 시 데이터 손상 가능
4. **렌더러(UI) 쪽 테스트가 전무**해 대형 컴포넌트(최대 2,491줄) 리팩터링 시 회귀를 감지할 수단이 없음

가장 시급한 것은 **1번(코드 서명)과 3번(단일 인스턴스 락+원자적 쓰기)** — 둘 다 구현 난이도는 낮고 실사용 중 데이터 손상·배포 신뢰도에 직결됩니다.

---

## 핵심 정리 — 보안·데이터 프라이버시

| # | 항목 | 심각도 | 근거(파일:라인) | 내용 |
|---|---|---|---|---|
| 1 | Windows 미서명 배포 | 높음 | `electron-builder.yml:22` (`signAndEditExecutable: false`) | 인증서 서명 설정이 전혀 없어 미서명 exe 배포. SmartScreen 경고 유발, 배포 경로 변조 시 무결성 검증 불가 |
| 2 | 백업/설정 파일 평문 + 권한 미제한 | 중간 | `store.ts:1-79`, `ipcHandlers.ts:410-416`(설정 저장), `ipcHandlers.ts:489-529`(수동/자동 백업) | 학생 이름 등이 포함된 JSON을 `fs.writeFileSync`로 저장하되 `chmod` 등 파일 권한 제한 없음(OS 기본 644). 다중 사용자 PC에서 다른 계정이 열람 가능. 단 API 키는 `SECRET_STORE_KEYS`로 제외되고 자동 백업 기본값은 off(의도적) |
| 3 | Firestore 보안 규칙이 앱 강제력 없음 | 중간 | `src/renderer/lib/chatFirebaseGuide.ts:13-94` | 채팅 기능의 실제 접근 통제는 Firebase 콘솔에 사용자가 직접 규칙을 복사·게시해야 적용됨. 앱이 방 시작 전 규칙 적용 여부를 검증하지 않아, 건너뛰거나 기본 테스트 모드로 두면 학생 채팅 전체가 노출될 수 있음 |
| 4 | privacyModeEnabled의 마스킹 범위 한계 | 낮음 | `src/renderer/lib/generationSafety.ts:66-114` | 프롬프트 전송 전 학생 이름을 `학생N` 토큰으로 실제 치환(단순 안내 문구 아님, 정상 작동 확인)하지만, **명시된 이름 필드/명단에 있는 이름만** 대상. 자유서술 본문 속 가족관계·건강·징계 등 다른 개인정보나 명단 외 이름은 그대로 외부 API로 전송됨 |
| 5 | netGuard의 사설 IP 허용 (SSRF 표면) | 낮음(설계상 트레이드오프) | `src/main/netGuard.ts:3-4, 41-46` | loopback/link-local만 차단하고 사설 대역(10.0.0.0/8 등)은 학교 인트라넷 자료 조회 목적으로 의도적 허용. 렌더러가 전달한 임의 URL로 메인 프로세스가 교내망 장비에 접근/스크린샷 가능한 경로가 남음 |
| 6 | IPC/경로/HWPX 처리 | 문제없음 | `pathSafety.ts:16-19`, `HwpxGenerator.ts:177, 488-500`, `preload/index.ts` | path traversal 방지 로직 정상, XXE 불가(DOCTYPE 제거 후 파싱), zip slip 미해당(파일시스템 경로를 엔트리명으로 안 씀), preload가 fs/child_process 미노출 |

## 핵심 정리 — 코드 품질·아키텍처

| # | 항목 | 심각도 | 근거 | 내용 |
|---|---|---|---|---|
| 7 | 단일 인스턴스 락 없음 + 비원자적 쓰기 | 높음 | `src/main/index.ts`(203, 207행 부근에 `requestSingleInstanceLock()` 없음), 백업/설정 저장이 `fs.writeFileSync` 직접 사용 | 포터블 exe 특성상 중복 실행이 쉬운데, 다중 인스턴스가 동일 `electron-store` 파일에 동시 쓰기 시 레이스 컨디션 가능. 저장 중 강제 종료 시 임시파일+rename 같은 손상 방지 장치 없음 |
| 8 | 렌더러 테스트 전무 | 중간 | `vitest.config.ts`(include: `src/**/__tests__/**/*.test.ts`), `src/renderer/components`(23,091줄, 테스트 디렉토리 없음), `src/renderer/hooks`, `src/renderer/services/geminiService.ts` | 테스트는 `src/main/__tests__`(16개)와 `src/renderer/lib/__tests__`(27개) 순수 로직에만 존재. `BudgetPlannerScreen.tsx`(2,491줄), `SubjectGenerator.tsx`(1,996줄) 등 핵심 화면과 파일 저장/백업 흐름은 UI·상태 로직 테스트 없이 방치 |
| 9 | 전역 에러 바운더리 없음 | 중간 | grep 결과 `ErrorBoundary`/`componentDidCatch`/`window.onerror`/`unhandledrejection` 0건 | 컴포넌트 렌더링 중 예외 발생 시 React가 트리를 언마운트해 흰 화면이 되고 사용자 안내가 전혀 없음 |
| 10 | 자동 업데이트 없음 | 중간 | `electron-builder.yml`(publish 설정 없음), `ipcHandlers.ts:863`(GitHub Releases API 폴링), `HomeScreen.tsx:178`(배너만 표시) | 새 버전 알림만 하고 실제 설치는 사용자가 exe를 수동 재다운로드. 1번(미서명)과 겹쳐 배포 무결성 리스크가 커짐 |
| 11 | 상태 관리 파편화 | 낮음 | `LessonMaterialGenerator.tsx`(useState 40개), `BudgetPlannerScreen.tsx`(36개), `SettingsScreen.tsx`(31개) 등 | 전역 store 없이 Context 2개(`GlobalStateContext`, `TourContext`)만 두고 나머지는 컴포넌트 로컬 useState 남발. 500줄 초과 거대 컴포넌트 12개 |
| 12 | 의존성 caret 버전 리스크 | 낮음 | `package.json`(`firebase ^12.15.0`, `@google/genai ^1.30.0`, `electron ^43.1.1`) | 모두 빠르게 변화하는 라이브러리를 caret 범위로 고정, 마이너 업데이트 시 breaking change 노출 가능 |
| 13 | 문서-코드 버전 불일치 | 낮음 | `docs/EduNote_PRD.md:5-7`(v1.14.0 표기), `docs/EduNote_앱구조설명서.md:4`(v1.18.4 표기) vs 실제 `package.json` v1.26.2 | 두 문서 모두 8~12개 마이너 버전 뒤처져 최근 기능(백업 기본값 변경 등) 미반영 가능 |
| 14 | 다국어 미지원 | 참고사항 | — | 국내 교사 대상 단일 로컬 앱으로 의도된 설계, 결함 아님 |

---

## 실행안 — 우선순위별 조치

**1순위 (배포/데이터 손상 직결, 구현 난이도 낮음)**
- [ ] `electron-builder.yml`에 코드 서명(EV 인증서 또는 최소한 표준 인증서) 설정 추가
- [ ] `app.requestSingleInstanceLock()` 추가 + `second-instance` 핸들러로 기존 창 포커스
- [ ] 백업/설정 저장을 `임시파일 쓰기 → rename` 방식의 원자적 쓰기로 교체

**2순위 (사용자 경험/신뢰 직결, 구현 난이도 낮음)**
- [ ] 렌더러 최상단에 React `ErrorBoundary` 추가, 흰 화면 대신 재시작 안내 UI 표시
- [ ] 백업/설정 파일에 OS 파일 권한 제한(Windows ACL/POSIX chmod) 적용 검토

**3순위 (구조적 개선, 중간 난이도)**
- [ ] 채팅 시작 전 Firestore 규칙 적용 여부를 안내 문구 이상으로(예: 테스트 쓰기 시도) 확인하는 체크 추가
- [ ] `BudgetPlannerScreen.tsx`, `SubjectGenerator.tsx` 등 핵심 대형 컴포넌트부터 상태/로직을 훅으로 분리 + 테스트 추가

**4순위 (문서 정합성, 낮은 난이도)**
- [ ] `docs/EduNote_PRD.md`, `docs/EduNote_앱구조설명서.md` 버전 표기를 v1.26.2 기준으로 갱신

---

## 추천안

가장 먼저 손대야 할 것은 **1순위 3개 항목**입니다. 셋 다 코드 변경량이 적으면서(서명은 빌드 설정, 단일 인스턴스는 수 줄, 원자적 쓰기는 기존 저장 함수 감싸기) 실사용 중 발생 가능한 "데이터 손상"과 "배포 신뢰도 하락"이라는 가장 눈에 띄는 리스크를 직접 제거합니다. 2순위(ErrorBoundary)도 반나절 이내 작업으로 흰 화면 이슈를 없앨 수 있어 함께 진행을 권합니다. 3·4순위는 각 기능 변경 시점에 맞춰 점진적으로 반영하는 것이 적절합니다.

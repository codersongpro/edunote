# Project skills

이 디렉터리의 스킬은 [mattpocock/skills](https://github.com/mattpocock/skills) 플러그인
(`mattpocock-skills` v1.2.3, MIT)에서 가져온 것입니다. `/plugin install`을 쓸 수 없는 환경이라
플러그인 매니페스트(`.claude-plugin/plugin.json`)에 등재된 25개 스킬만 프로젝트 스킬로 복사했습니다.
개발 중(`skills/in-progress`)·기타(`skills/misc`) 스킬은 포함하지 않았습니다.

라이선스 전문은 `LICENSE-mattpocock-skills` 참고.

## 포함된 스킬

| 스킬 | 용도 |
| --- | --- |
| `ask-matt` | 설계·구현 판단을 Matt Pocock 관점으로 심문 |
| `code-review` | 기준점 대비 변경분을 Standards/Spec 두 축으로 병렬 리뷰 |
| `codebase-design` | 코드베이스 구조를 두 번 설계해 비교 |
| `diagnosing-bugs` | 가설–검증 루프로 버그 원인 규명 |
| `domain-modeling` | 도메인 용어·ADR 정리 (`CONTEXT.md`, ADR 생성) |
| `grill-me` / `grilling` / `grill-with-docs` | 계획·설계를 인터뷰로 깎아내기 (문서 산출 포함) |
| `handoff` | 작업 맥락을 다음 세션·사람에게 인수인계 |
| `implement` | 스펙·티켓 기반 구현 (TDD → code-review → commit) |
| `improve-codebase-architecture` | 아키텍처 개선점 진단 및 HTML 리포트 |
| `prototype` | 로직/UI 프로토타입 빠르게 세우기 |
| `research` | 1차 출처 기반 조사 후 마크다운으로 기록 |
| `resolving-merge-conflicts` | 머지 충돌 해소 절차 |
| `setup-matt-pocock-skills` | 이 스킬 세트가 쓰는 저장소 설정(이슈 트래커 등) 초기화 |
| `tdd` | 테스트 우선 개발 루프 |
| `teach` | 학습 미션·글로서리·학습 기록 기반 교습 |
| `to-questionnaire` | 요구사항을 설문 형태로 변환 |
| `to-spec` | 논의를 스펙 문서로 변환 |
| `to-tickets` | 스펙을 실행 가능한 티켓으로 분해 |
| `triage` | 이슈 분류·라벨링 |
| `wait-what` | 직전 설명이 안 통했을 때 쉬운 말로 재설명 |
| `wayfinder` | 낯선 코드베이스 길잡이 |
| `wizard` | 대화형 셋업 스크립트 생성 |
| `writing-for-agents` | 에이전트가 읽을 문서 작성법 |

## 사용 전 준비

`code-review`, `triage`, `to-tickets`는 `docs/agents/issue-tracker.md`를 전제로 합니다.
없으면 먼저 `/setup-matt-pocock-skills`를 실행하세요.

## 업데이트

원본 저장소의 `skills/` 트리를 다시 받아 이 디렉터리에 덮어쓰면 됩니다.

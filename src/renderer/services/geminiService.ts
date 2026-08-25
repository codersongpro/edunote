import {
  SchoolLevel,
  GenerationRequest,
  SubjectGenerationRequest,
  SportsGenerationRequest,
  CreativeActivityGenerationRequest,
  LengthOption,
  LengthUnit,
  DocType,
  FileData,
  GongmunType,
  GongmunComplexity,
  GonggoInputs,
  ParsedTaskData,
  NeisAnalyzedData,
  CustomTool,
  CustomToolInput,
} from '../types';
import type { GroundingInfo } from '../../preload/types';
import { GUIDELINE_CONTEXT, GENERATION_EXAMPLES, SYSTEM_INSTRUCTION, SUBJECT_LIST } from '../constants';
import { stripGeneratedCodeFences } from '../lib/generatedContent';
import { formatStudentMemos, withStudentPrivacy, withStudentListPrivacy } from '../lib/generationSafety';
import { describeGenerationError, isTemporaryApiError } from '../lib/generationErrors';

// ─── 현재 날짜/학년도 컨텍스트 ───────────────────────────────────────
const getDateContext = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  // 한국 학년도: 3월 시작 → 1~2월은 전년도 학년도
  const schoolYear = month < 3 ? year - 1 : year;
  return `[내부 기준 정보 — 오늘: ${year}년 ${month}월 ${day}일 / 학년도: ${schoolYear}학년도. 이 정보는 날짜·연도 기준으로만 활용하고, 사용자가 명시적으로 요청하지 않는 한 출력 문서에 그대로 노출하지 마세요.]`;
};

const notifyTemporaryApiError = (error: unknown) => {
  if (typeof window === 'undefined' || !isTemporaryApiError(error)) return;
  window.dispatchEvent(new CustomEvent('edunote-api-temporary-error'));
};

// 텍스트형 결과(학생기록·QA·업무기록)의 출력 토큰 상한.
// 폭주 방지용이며, 2.5 계열 모델의 내부 사고(thinking) 토큰도 이 상한에
// 포함되므로 실제 필요량(약 1,500 토큰)보다 넉넉하게 둔다.
const TEXT_OUTPUT_TOKEN_LIMIT = 8192;

// onModel(선택)이 주어지면 실제로 성공한 모델명을 콜백으로 알려준다.
// 대부분의 호출부는 이 값이 필요 없어 생략하며, 기존과 동일하게 문자열만 반환받는다.
const aiGenerate = async (
  prompt: string,
  systemInstruction?: string,
  options?: { temperature?: number; maxOutputTokens?: number; responseJson?: boolean },
  onModel?: (model: string) => void,
) => {
  try {
    const { text, model } = await window.electronAPI.aiGenerate(prompt, systemInstruction, options);
    onModel?.(model);
    return text;
  } catch (error) {
    notifyTemporaryApiError(error);
    throw error;
  }
};

// onGrounding(선택)이 주어지면 웹 검색 그라운딩으로 참조한 출처 정보를 콜백으로 알려준다.
const aiGenerateMultipart = (
  parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }>,
  systemInstruction?: string,
  options?: { temperature?: number; maxOutputTokens?: number; responseJson?: boolean; useSearchGrounding?: boolean },
  onModel?: (model: string) => void,
  onGrounding?: (grounding: GroundingInfo | undefined) => void,
) => window.electronAPI.aiGenerateMultipart(parts, systemInstruction, options).then(({ text, model, grounding }) => {
  onModel?.(model);
  onGrounding?.(grounding);
  return text;
}).catch((error) => {
  notifyTemporaryApiError(error);
  throw error;
});

// 스트리밍 멀티파트 생성 — 누적 텍스트를 onText로 전달한다.
// 모델 폴백·재시도로 'start'가 다시 오면 누적 버퍼를 비우고 처음부터 다시 쌓는다.
// onModel(선택)이 주어지면 실제로 성공한 모델명을 콜백으로 알려준다.
const aiGenerateMultipartStream = (
  parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }>,
  systemInstruction: string | undefined,
  options: { temperature?: number; maxOutputTokens?: number; responseJson?: boolean; useSearchGrounding?: boolean } | undefined,
  onText: (accumulated: string) => void,
  onModel?: (model: string) => void,
  onGrounding?: (grounding: GroundingInfo | undefined) => void,
) => {
  let buffer = '';
  return window.electronAPI.aiGenerateMultipartStream(parts, systemInstruction, options, (event) => {
    if (event.type === 'start') {
      buffer = '';
      onText('');
    } else if (event.type === 'chunk' && event.text) {
      buffer += event.text;
      onText(buffer);
    }
  }).then(({ text, model, grounding }) => {
    onModel?.(model);
    onGrounding?.(grounding);
    return text;
  }).catch((error) => {
    notifyTemporaryApiError(error);
    throw error;
  });
};

// 텍스트류 첨부 파일은 base64(약 33% 부풀려짐)로 보내지 않고 텍스트로 풀어 보낸다.
// 토큰을 절약하고, 지나치게 긴 문서는 앞부분만 잘라 전송한다.
const TEXT_ATTACHMENT_CHAR_LIMIT = 30_000;

const isTextLikeFile = (fileData: FileData): boolean =>
  /^text\//i.test(fileData.mimeType || '') || /\.(txt|md|csv)$/i.test(fileData.file?.name || '');

const decodeBase64Text = (base64: string): string => {
  const raw = atob(base64.split(',').pop() || '');
  const bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
};

const fileToPart = (fileData: FileData): { text?: string; inlineData?: { data: string; mimeType: string } } => {
  if (isTextLikeFile(fileData)) {
    try {
      const text = decodeBase64Text(fileData.base64).trim();
      if (text) {
        const clipped = text.length > TEXT_ATTACHMENT_CHAR_LIMIT
          ? `${text.slice(0, TEXT_ATTACHMENT_CHAR_LIMIT)}\n...(분량이 길어 이하 생략됨)`
          : text;
        return { text: `[첨부 문서: ${fileData.file?.name || '텍스트 파일'}]\n${clipped}` };
      }
    } catch {
      // 디코딩 실패 시 기존 방식(inlineData)으로 보낸다.
    }
  }
  return {
    inlineData: {
      data: fileData.base64.split(',')[1],
      mimeType: fileData.mimeType,
    },
  };
};

const NATURAL_WRITING_INSTRUCTION = `
[자연스러운 작성 원칙]
- AI가 작성했다는 안내, 변명, 메타 설명을 절대 쓰지 마세요.
- "다음은", "요청하신", "AI", "초안", "예시입니다", "생성했습니다" 같은 생성형 문구를 출력하지 마세요.
- 학교 현장에서 사람이 직접 작성한 보고서, 기록, 수업자료처럼 자연스럽고 구체적으로 작성하세요.
- 과장된 홍보 문구, 기계적으로 반복되는 문장 구조, 같은 종결어미의 반복을 피하세요.
- 불필요한 이모지와 장식 기호를 쓰지 마세요.
- 최종 출력에는 Markdown 강조 기호(**), 제목 기호(#), 코드블록 기호(\`\`\`)를 넣지 마세요.
- 문장은 짧고 구체적으로 작성하고, 실제 학교 상황에 맞지 않는 추상적 표현은 피하세요.`;

const FORMAL_PUBLIC_WRITING_INSTRUCTION = `
[공적 문체 원칙]
- 공문서, 계획서, 보고서, 공고문, 회의록, 품의서에는 엄밀한 공적 언어를 사용하세요.
- 구어체, 감탄형, 홍보성 표현, 사적인 평가, 과도하게 친근한 말투를 쓰지 마세요.
- 판단이나 의견은 근거, 대상, 기간, 절차, 결과가 드러나도록 객관적으로 작성하세요.
- 기관 문서에 맞게 간결하고 명확하게 쓰되, 의미가 모호한 추상어를 반복하지 마세요.`;

const NO_FABRICATED_REFERENCES_INSTRUCTION = `
[근거·출처 작성 규칙 — 반드시 지킬 것]
- 사용자가 직접 제공하지 않은 법령명, 조항, 훈령·예규 번호, 교육청 공문번호, 정책·사업 명칭을 추측해서 쓰지 마세요.
- '관련' 항목에 쓸 근거가 입력에 없으면 "(근거 공문·법령 입력 필요)"처럼 사용자가 채울 자리로 표시하세요.
- 실존 여부가 불확실한 기관명, 인용문, 통계 수치를 만들어내지 마세요. 입력에 있는 사실만 사용하세요.`;

// 웹 검색 그라운딩을 켰을 때는 근거를 아예 쓰지 못하게 막는 대신,
// 검색으로 확인한 내용만 쓰도록 방향을 바꾼다.
const SEARCH_GROUNDED_REFERENCES_INSTRUCTION = `
[근거·출처 작성 규칙 — 웹 검색 사용 중]
- 구글 검색 도구가 켜져 있습니다. 법령명, 지침, 최신 사례, 통계는 검색으로 확인한 내용만 사용하세요.
- 검색으로 확인하지 못한 공문번호, 시행 일자, 통계 수치는 지어내지 말고 "(근거 법령·지침 확인 후 기재)"로 남기세요.
- 확인한 근거는 기관명과 자료명을 함께 밝히세요. 예: 교육부 「○○ 기본계획」, ○○교육청 「○○ 안내」
- 본문에 URL 주소를 넣지 마세요. 참고한 자료 목록은 화면에 따로 표시됩니다.`;

const EDUCATIONAL_RECORD_WRITING_INSTRUCTION = `
[학생기록 공적 문체 원칙]
- 학생기록 생성 결과는 반드시 교육적이고 공적인 언어로 작성하세요.
- 학생의 행동, 변화, 성장 과정, 학습 태도, 공동체 역량을 관찰 근거 중심으로 서술하세요.
- 과장, 단정, 감정적 표현, 사적인 평가, 지나치게 친근한 말투를 쓰지 마세요.
- 생활기록부와 학교 기록에 적합한 객관적 표현을 사용하세요.`;

const REPORT_STYLE_ENDING_INSTRUCTION = `
[보고서체 종결 규칙]
- 계획서, 보고서, 회의록, 홍보자료, 공고문 본문은 설명문 말투가 아니라 학교 업무 보고서체로 작성하세요.
- 문장 종결은 문맥에 따라 명사형·서술형 보고서체를 자연스럽게 사용하세요. 예: 필요성 증대, 현상 관찰, 운영 예정, 개선 필요, 효과 기대, 협력 체계 구축
- "~임.", "~함."을 억지로 반복하지 말고, 단어 또는 짧은 구로 자연스럽게 마무리하세요.
- "~습니다.", "~입니다.", "~합니다.", "~되었습니다.", "~하였습니다." 형태의 높임말 종결은 본문에서 사용하지 마세요.
- 가정통신문과 문자 메시지는 예외적으로 정중한 높임말을 사용할 수 있습니다.`;

const OFFICIAL_HAPSHO_STYLE_INSTRUCTION = `
[공문·품의서 문체 규칙]
- 공문서와 품의서의 시행문 문장은 반드시 합쇼체로 작성하세요.
- 본문 종결은 "~합니다.", "~입니다.", "~습니다.", "~하고자 합니다.", "~바랍니다."처럼 정중한 공문서 문체를 사용하세요.
- "~함.", "~임.", "~완료.", "~예정." 같은 보고서체 종결을 시행문 문장에 사용하지 마세요.
- 항목 값 자체는 간결하게 쓰되, 서술 문장은 공문서에 맞는 높임말로 마무리하세요.`;

// ─── School Level Guidance ─────────────────────────────────────────

const getDevelopmentalGuidance = (schoolLevel: SchoolLevel) => {
  switch (schoolLevel) {
    case SchoolLevel.ELEMENTARY:
      return `
[초등학생 발달 단계 반영]:
- 어휘: 이해하기 쉽고 구체적이며 명확한 어휘를 사용하세요. 지나치게 추상적이거나 학문적인 용어는 피하세요.
- 어조: 학생의 작은 변화와 성장을 칭찬하고 격려하는 따뜻하고 긍정적인 어조로 작성하세요.
- 내용: 구체적인 행동 관찰과 그로 인한 긍정적인 변화를 중심으로 서술하세요.`;
    case SchoolLevel.MIDDLE:
      return `
[중학생 발달 단계 반영]:
- 어휘: 일상 용어와 학습 용어를 적절히 혼용하여 작성하세요.
- 어조: 학생의 자아 정체성 형성과 자기주도적인 학습 태도, 교우 관계의 성숙 과정을 객관적이면서도 지지하는 어조로 작성하세요.
- 내용: 진로 탐색 과정, 학습 태도의 변화, 공동체 의식 함양 과정을 중심으로 서술하세요.`;
    case SchoolLevel.HIGH:
      return `
[고등학생 발달 단계 반영]:
- 어휘: 대학 입시에 활용될 수 있도록 전문적이고 학문적인 어휘(교과 고유 용어 등)를 적극적으로 사용하세요.
- 어조: 학업 역량과 전공 적합성, 심화된 탐구 능력이 잘 드러나도록 분석적이고 전문적인 어조로 작성하세요.
- 내용: 구체적인 학습 동기, 심화 탐구 과정, 문제 해결 능력, 향후 발전 가능성을 논리적으로 서술하세요.`;
    default:
      return '';
  }
};

// ─── 2026 대입 평가 기준 (입학사정관 실제 평가 프레임) ──────────────────
const EVALUATION_FRAMEWORK_2026 = `
[2026 대입 학생부 실제 평가 기준 — 입학사정관 프레임]

▶ 감점 표현(0~1점) — 절대 사용 금지:
"성실하게 참여함", "적극적으로 임함", "기초 개념을 이해함", "조별 활동에 잘 참여함",
"탐구활동을 진행함", "재미있어함", "흥미를 보임", "열심히 함", "기본에 충실함", "성격이 원만함"
→ 공통 문제: 객관적 근거 없음 / 사고 과정 없음 / 전공 연결 없음

▶ 가점 표현(4~5점) — 반드시 이런 구조로 작성:
- "가설 설정 → 데이터 분석 → 결론 도출의 구조를 스스로 구성함"
- "변수 통제의 필요성을 파악하고 실험 설계안을 수정함"
- "자료의 신뢰성을 비교하는 기준(오차, 단위)을 스스로 설정함"
- "전공 개념을 수업 밖 실생활 사례와 연결해 해석함"
- "타인의 주장에 근거 기반 질문으로 토론에 기여함"
- "데이터 해석에서 이유→근거→조건 구조를 명확히 밝힘"
- "오차 원인을 복수로 정의하고 개선 방향을 제안함"
→ 공통 특징: 고급 사고력 / 전공적합성 / 자기주도적 탐구 과정

▶ 입학사정관 5단계 읽기 방식 (이 흐름을 따라 문장을 구성할 것):
Step 1. Action   → 무엇을 했는가 (구체적 활동)
Step 2. Process  → 어떻게 했는가 (사고·분석 방법)
Step 3. Concept  → 어떤 개념을 다뤘는가 (교과 핵심 개념)
Step 4. Insight  → 무엇을 깨달았는가 (탐구 결과·발견)
Step 5. Connection → 어디로 확장되었는가 (전공·심화·현실 연결)

▶ 3대 평가 역량 구조:
- 학업역량: 개념 이해 + 문제 해결 과정 + 데이터 활용
- 진로·전공역량: 심화 탐구 + 전공 개념 연결 + 스토리라인
- 공동체역량: 갈등 해결 과정 + 협력 방식 + 역할 구조화

▶ 표현 전환 기준:
"탐구함" → "왜 그런 결과가 나타났는지 분석함"
"조사함" → "자료의 한계를 비판적으로 검토함"
"발표함" → "관점 차이를 비교해 자신의 논지를 재구성함"
"이해함" → "개념을 실생활 데이터와 연결해 해석함"
"참여함" → "역할을 구조화하고 결과물에 기여함"
`;

// ─── System Prompts ───────────────────────────────────────────────

const RECORD_CHATBOT_SYSTEM_PROMPT = (schoolLevel: SchoolLevel) => `
당신은 대한민국 ${schoolLevel} 교사를 돕는 학교생활기록부 전문 보조자입니다.
2026학년도 학교생활기록부 기재요령 및 최신 대입 평가 기준을 바탕으로 실용적인 도움을 제공합니다.

[대화 스타일]
- 친근하고 실용적인 어조로 대화하세요.
- 질문의 맥락에 맞춰 구체적인 예시와 팁을 제공하세요.
- 문구 예시 요청 시 입학사정관이 4~5점을 주는 '가점 구조'로 작성해 주세요.
- 부정확한 정보는 제공하지 말고, 확인이 필요한 경우 솔직하게 안내하세요.

[학교급 컨텍스트: ${schoolLevel}]
${getDevelopmentalGuidance(schoolLevel)}

[문구 예시 작성 기준 요약]
- 감점 표현("성실하게 참여함", "흥미를 보임" 등 근거 없는 서술) 대신, 사고 과정·교과 개념·전공 연결이 드러나는 구조로 예시를 제시하세요.
- 흐름: 무엇을 했는가 → 어떻게 했는가 → 어떤 개념을 다뤘는가 → 무엇을 깨달았는가 → 어디로 확장되었는가.

${NATURAL_WRITING_INSTRUCTION}

[기재요령 핵심 컨텍스트]
${GUIDELINE_CONTEXT}
`;

const OPINION_GENERATOR_SYSTEM_PROMPT = (schoolLevel: SchoolLevel) => `
당신은 ${schoolLevel} 교사가 학생의 '행동특성 및 종합의견'을 작성하는 것을 돕는 보조자입니다.
제공된 긍정적 특성과 보완이 필요한 특성을 바탕으로 작성하되,
입학사정관이 실제로 높이 평가하는 '공동체역량과 사고 과정이 드러나는 문장'으로 구성하세요.
단순 태도·성격 묘사(감점)가 아닌, 구체적 행동→과정→역할 구조화(가점)로 서술해야 합니다.

${getDevelopmentalGuidance(schoolLevel)}

${NATURAL_WRITING_INSTRUCTION}
${EDUCATIONAL_RECORD_WRITING_INSTRUCTION}

[2026 행동특성 평가 기준]
- 낮은 평가(피해야 할 표현): "성격이 원만함", "친구들과 잘 어울림", "성실하게 생활함", "밝고 긍정적임"
- 높은 평가(지향할 표현): 갈등 상황에서 어떻게 해결했는지 과정 서술, 역할 분담 구조화 방식, 공동 목표 달성 과정에서 드러난 사고력과 리더십
- 공동체역량: 갈등 해결 + 협력 방식 + 역할 구조화
- 학업역량: 자기주도적 학습 습관 + 문제 해결 접근 방식
- 진로역량: 관심 분야와 연결된 구체적 행동 패턴

[기재요령 참고 우수 예시]
${GENERATION_EXAMPLES.OPINION[schoolLevel]}

[필수 작성 규칙]
1. 서술 방식:
   - 주어 없음: 문장에서 '학생은', 'OO이는' 등의 주어를 생략하고 철저히 관찰자 시점에서 서술하세요.
   - 문체 및 종결: 문장은 명사형 보고서체로 쓰되 '~임', '~함'을 기계적으로 반복하지 마세요. 마지막에는 온점(.)을 찍으세요.
   - 구성: 여러 문장으로 구성된 하나의 문단으로 작성하세요.

2. 금지어 및 기호:
   - 특수기호 금지: 따옴표(', "), 괄호(), 화살표(->) 등 문장 부호 외의 특수기호 절대 금지.
   - 인칭/호칭: "학생은", "학생이", "나는" 등.
   - 평가/실적: "대회", "수상", "자격증", "방과후학교", "모의고사", "총괄평가", "장학금".
   - 감점 표현: "성실하게 참여함", "열심히 임함", "흥미를 보임", "기본에 충실함" 등 단순 태도 묘사.

3. 다양성 확보:
   - 문장의 시작을 '평소', '늘', '항상' 등으로 똑같이 시작하지 마세요.
   - 학생마다 글의 도입부와 흐름이 달라지도록 작성하세요.
`;

const SUBJECT_GENERATOR_SYSTEM_PROMPT = (schoolLevel: SchoolLevel) => `
당신은 ${schoolLevel} 교사가 학생의 '교과 세특(세부능력 및 특기사항)'을 기재하는 것을 돕는 입시 전문가입니다.
2026학년도 고교학점제와 2028 대입 개편안에서 입학사정관이 실제로 4~5점을 주는 '사고력 검증 문장' 중심으로 작성해야 합니다.
대학은 '무엇을 했는가'가 아니라 '어떻게 사고했는가'를 평가합니다.

${getDevelopmentalGuidance(schoolLevel)}

${EVALUATION_FRAMEWORK_2026}

${NATURAL_WRITING_INSTRUCTION}
${EDUCATIONAL_RECORD_WRITING_INSTRUCTION}

[입시 우수 기재 사례 분석]
${GENERATION_EXAMPLES.SUBJECT[schoolLevel]}

[필수 작성 규칙]
- 주어 생략, 명사형 종결 중심, 마지막 온점 필수. '~함', '~임'만 반복하지 말고 문맥에 맞는 자연스러운 종결 사용
- 따옴표 및 특수기호 금지
- 과제명 직접 언급 금지 (활동 내용과 탐구 과정으로 서술)
- 성취수준 엄수: '중'/'하' 수준 과제에 '뛰어난', '탁월한' 등 과장 표현 금지
- Action→Process→Concept→Insight→Connection 흐름으로 문장 구성
- "개념 이해함", "탐구함" 등 감점 표현 절대 금지
`;

const SPORTS_GENERATOR_SYSTEM_PROMPT = (schoolLevel: SchoolLevel) => `
당신은 ${schoolLevel} 교사가 학생의 '학교스포츠클럽 특기사항'을 작성하는 것을 돕는 보조자입니다.
단순 "열심히 참여함" 수준이 아니라, 역할 구조화·갈등 해결·협력 방식·기술 성장 과정이 드러나는
입학사정관이 높이 평가하는 공동체역량 기반 문장으로 작성하세요.

${getDevelopmentalGuidance(schoolLevel)}

${NATURAL_WRITING_INSTRUCTION}
${EDUCATIONAL_RECORD_WRITING_INSTRUCTION}

[2026 스포츠클럽 평가 기준 — 공동체역량 중심]
- 낮은 평가: "열심히 참여함", "팀워크가 좋음", "기술이 향상됨"
- 높은 평가: 역할 분담 과정에서 드러난 리더십, 갈등 상황 해결 방식, 반복 훈련을 통한 전략적 사고, 팀 목표 달성을 위한 자기 역할 조정 과정

[기재요령 참고 우수 예시]
${GENERATION_EXAMPLES.SPORTS[schoolLevel]}

[필수 규칙]
- 주어 생략, 명사형 종결 중심, 마지막 온점 필수. '~함', '~임'만 반복하지 말고 문맥에 맞는 자연스러운 종결 사용
- 따옴표 및 특수기호 금지
- 단순 태도 묘사("적극적으로 임함") 금지 → 구체적 행동과 과정으로 서술
`;

const CREATIVE_ACTIVITY_SYSTEM_PROMPT = (schoolLevel: SchoolLevel) => `
당신은 ${schoolLevel} 교사가 학생의 '창의적 체험활동 특기사항'을 작성하는 것을 돕는 보조자입니다.
창체는 '전공 확장의 증거'이자 '사고력과 지속성의 기록'으로 평가됩니다.
1회성 활동 나열이 아닌 꾸준한 흐름과 전공·진로 스토리라인을 보여주는 구조로 작성하세요.

${getDevelopmentalGuidance(schoolLevel)}

[2026 창체 평가 기준]
- 낮은 평가: 단순 활동 참여 나열, "활동에 적극 참여함", "흥미를 갖고 임함"
- 높은 평가: 활동 → 개념 탐구 → 전공 연결의 흐름, 구체적 산출물·프로젝트 언급, 관점 변화나 깨달음 서술
- 연결성: 세특·행특과 연결되는 스토리라인이 있어야 강한 평가
- 사고력: "왜 그 활동을 선택했는가", "무엇을 발견했는가", "어떤 사고 변화가 있었는가"

${EVALUATION_FRAMEWORK_2026}

${NATURAL_WRITING_INSTRUCTION}
${EDUCATIONAL_RECORD_WRITING_INSTRUCTION}

[기재요령 참고 우수 예시]
${GENERATION_EXAMPLES.CREATIVE[schoolLevel]}

[필수 작성 규칙]
1. 주어 없음, 명사형 종결 중심, 마지막 온점 필수. '~함', '~임', '~됨'만 반복하지 말고 문맥에 맞는 자연스러운 종결 사용
2. '~였음', '~했음', '~하였음' 등 어색한 과거형 절대 금지
3. 따옴표(', ") 절대 금지
4. 단순 활동 나열 지양 → 활동 속 사고 과정과 탐구 흐름에 초점
`;

const EDUCATION_QA_SYSTEM_PROMPT = `
당신은 대한민국 학교 현장의 교육 전반에 관해 도움을 주는 전문 보조자입니다.
교육 정책, 교수법, 학급 경영, 학생 상담, 행정 업무 등 교사들이 실무에서 마주치는 다양한 질문에 친절하고 실용적으로 답변하세요.
답변은 학교 현장의 보고서와 업무 메모처럼 자연스럽고 간결하게 작성하세요. 생성형 문구, Markdown 강조 기호, 이모지, 과장된 홍보 문구는 쓰지 마세요.
`;

// ─── Length Helper ────────────────────────────────────────────────

const getLengthInstruction = (
  lengthOption: LengthOption,
  customLength: number | undefined,
  lengthUnit: LengthUnit,
): string => {
  const targetVal = lengthOption === 'custom' ? customLength || 0 : parseInt(lengthOption, 10);
  if (!targetVal || isNaN(targetVal)) return '적절한 분량으로 작성';
  const minVal = Math.floor(targetVal * 0.95);
  return `공백 포함 ${targetVal}${lengthUnit} 내외 (최소 ${minVal}${lengthUnit} 이상 작성 필수)`;
};

// ─── 학생기록 AI Functions ─────────────────────────────────────────

// 일괄 생성 시 학생마다 첫 문장의 관점을 순환시켜, 같은 태그를 받은 학생들의
// 결과가 비슷한 구조로 반복되는 것을 줄인다.
const OPENING_PERSPECTIVES = [
  '학급 공동 활동에서의 모습',
  '교우 관계와 협력 상황',
  '맡은 역할을 수행하는 과정',
  '어려움에 부딪혔을 때의 대처',
  '자율적인 학습·생활 태도',
];
let openingPerspectiveCounter = 0;

const nextOpeningPerspective = (): string =>
  OPENING_PERSPECTIVES[openingPerspectiveCounter++ % OPENING_PERSPECTIVES.length];

export const askRecordChatbot = async (
  schoolLevel: SchoolLevel,
  history: Array<{ role: 'user' | 'model'; text: string }>,
  question: string,
): Promise<string> => {
  try {
    // 토큰 절약을 위해 최근 대화 6개만 컨텍스트로 보낸다.
    const historyText = history
      .slice(-6)
      .map((m) => `[${m.role === 'user' ? '교사' : 'AI'}]: ${m.text}`)
      .join('\n');
    const fullPrompt = historyText ? `${historyText}\n[교사]: ${question}` : question;
    return await aiGenerate(fullPrompt, RECORD_CHATBOT_SYSTEM_PROMPT(schoolLevel), { temperature: 0.7, maxOutputTokens: TEXT_OUTPUT_TOKEN_LIMIT });
  } catch (error: any) {
    console.error('Record Chatbot Error:', error);
    throw new Error(describeGenerationError(error));
  }
};

export const generateOpinion = async (request: GenerationRequest): Promise<{ text: string; model: string; privacyApplied: boolean }> => {
  try {
    const positiveStr = request.positiveTags.length > 0 ? request.positiveTags.join(', ') : '특별히 지정되지 않음';
    const negativeStr = request.negativeTags.length > 0 ? request.negativeTags.join(', ') : '특별히 지정되지 않음';
    const lengthInstruction = getLengthInstruction(request.lengthOption, request.customLength, request.lengthUnit);
    const avoidInstruction =
      request.avoidPhrases && request.avoidPhrases.length > 0
        ? `\n[주의 - 절대 사용 금지 문구]: 다음 문장이나 표현은 이미 사용되었으므로 절대 똑같이 작성하지 마세요. 문장 구조와 단어를 완전히 다르게 바꾸세요: "${request.avoidPhrases.join('", "')}"`
        : '';

    const prompt = `
${getDateContext()}
다음 학생의 '행동특성 및 종합의견'을 작성해줘.

[학생 정보 - 이름: ${request.studentName}] (이름은 참고만 하고 본문에는 절대 쓰지 말 것)
[긍정적 특성]: ${positiveStr}
[보완할 점]: ${negativeStr}
[추가 참고사항]: ${request.additionalContext}
${formatStudentMemos(request.studentMemos)}

[작성 길이]: ${lengthInstruction}

[요구사항]
1. 주어(학생 이름, '학생은' 등)를 절대 사용하지 마세요.
2. 문장은 반드시 '~임', '~함'으로 끝내고, 반드시 온점(.)을 찍으세요.
3. 금지어(대회, 수상, 자격증, 모의고사 등)를 절대 포함하지 마세요.
4. 따옴표(', ")나 특수기호를 절대 쓰지 마세요.
5. 하나의 문단으로 작성하세요.
6. 오직 결과 텍스트만 출력하세요.
7. 작성 길이를 엄격히 준수하세요.
8. 문장의 시작을 다양하게 하세요. 첫 문장은 '${nextOpeningPerspective()}' 관점에서 시작하되, 입력 정보에 맞는 내용만 사용하세요.
${avoidInstruction}`;

    const privacy = withStudentPrivacy(prompt, request.studentName, request.privacyModeEnabled);
    let usedModel = '';
    const result = await aiGenerate(privacy.prompt, OPINION_GENERATOR_SYSTEM_PROMPT(request.schoolLevel), {
      temperature: 0.85,
      maxOutputTokens: TEXT_OUTPUT_TOKEN_LIMIT,
    }, (model) => { usedModel = model; });
    return { text: privacy.restore(result), model: usedModel, privacyApplied: privacy.applied };
  } catch (error: any) {
    console.error('Gemini Generator Error:', error);
    throw new Error(describeGenerationError(error));
  }
};

export const generateSubjectReport = async (request: SubjectGenerationRequest): Promise<{ text: string; model: string; privacyApplied: boolean }> => {
  try {
    const tasksText = request.tasks
      .map((t, i) => `- 활동 ${i + 1}: ${t.task} (성취수준: ${t.level})`)
      .join('\n');
    const lengthInstruction = getLengthInstruction(request.lengthOption, request.customLength, request.lengthUnit);
    const avoidInstruction =
      request.avoidPhrases && request.avoidPhrases.length > 0
        ? `\n[주의 - 절대 사용 금지 문구]: "${request.avoidPhrases.join('", "')}"`
        : '';

    const prompt = `
${getDateContext()}
다음 정보를 바탕으로 학교생활기록부 '교과학습발달상황 세부능력 및 특기사항'을 작성해줘.

[학생 정보 - 이름: ${request.studentName}] (이름은 참고만 하고 본문에는 절대 쓰지 말 것)
[학교급]: ${request.schoolLevel}
[교과목]: ${request.subject}

[수행한 평가 과제 및 성취수준]:
${tasksText}

[성취수준별 표현 기준]
- 상: 심화·확장·자기주도 중심으로 표현 가능 (예: 스스로 가설을 세워 검증함, 개념을 다른 맥락에 적용함)
- 중: 과장 없는 수행 중심 표현 (예: 개념을 적절히 적용하여 과제를 수행함). '뛰어난', '탁월한', '완벽하게' 금지
- 하: 노력·태도·부분적 성취 중심 (예: 도움을 받아 개념을 이해하려 노력함). 성취를 부풀리는 표현 금지

[추가 관찰내용]: ${request.additionalContext}
${formatStudentMemos(request.studentMemos)}

[작성 길이]: ${lengthInstruction}

[요구사항]
1. 주어 절대 금지. 2. 과제명을 그대로 옮겨 적지 말 것 (단원·활동 유형으로 일반화해 서술).
3. 시스템 지침의 [Action→Process→Concept→Insight→Connection] 5단계 흐름으로 문장 구성.
4. 명사형 종결어미 + 온점 필수. 5. 따옴표/특수기호 금지. 6. 결과 텍스트만 출력.
7. 작성 길이 엄수. 8. 문장 시작 다양화. 9. 위 [성취수준별 표현 기준] 엄수.
${avoidInstruction}`;

    const privacy = withStudentPrivacy(prompt, request.studentName, request.privacyModeEnabled);
    let usedModel = '';
    const result = await aiGenerate(privacy.prompt, SUBJECT_GENERATOR_SYSTEM_PROMPT(request.schoolLevel), {
      temperature: 0.9,
      maxOutputTokens: TEXT_OUTPUT_TOKEN_LIMIT,
    }, (model) => { usedModel = model; });
    return { text: privacy.restore(result), model: usedModel, privacyApplied: privacy.applied };
  } catch (error: any) {
    console.error('Subject Generator Error:', error);
    throw new Error(describeGenerationError(error));
  }
};

export const generateSportsClubReport = async (request: SportsGenerationRequest): Promise<{ text: string; model: string; privacyApplied: boolean }> => {
  try {
    const lengthInstruction = getLengthInstruction(request.lengthOption, request.customLength, request.lengthUnit);
    const avoidInstruction =
      request.avoidPhrases && request.avoidPhrases.length > 0
        ? `\n[주의 - 절대 사용 금지 문구]: "${request.avoidPhrases.join('", "')}"`
        : '';

    const prompt = `
${getDateContext()}
다음 정보를 바탕으로 학교생활기록부 '학교스포츠클럽 특기사항'을 작성해줘.

[학생 정보 - 이름: ${request.studentName}] (이름은 참고만 하고 본문에는 절대 쓰지 말 것)
[학교급]: ${request.schoolLevel}
[종목]: ${request.sportName}
[클럽명]: ${request.clubName}

[개별 활동 내용 및 태도]: ${request.additionalContext}
${formatStudentMemos(request.studentMemos)}

[작성 길이]: ${lengthInstruction}

[요구사항]
1. 주어 절대 금지. 2. 스포츠맨십, 협동심, 기술 향상 등이 드러나게 작성.
3. 명사형 종결어미 + 온점 필수. 4. 따옴표/특수기호 금지. 5. 결과 텍스트만 출력.
6. 작성 길이 엄수. 7. 문장 시작 다양화 — 첫 문장은 '${nextOpeningPerspective()}' 관점에서 시작하되, 입력 정보에 맞는 내용만 사용.
${avoidInstruction}`;

    const privacy = withStudentPrivacy(prompt, request.studentName, request.privacyModeEnabled);
    let usedModel = '';
    const result = await aiGenerate(privacy.prompt, SPORTS_GENERATOR_SYSTEM_PROMPT(request.schoolLevel), {
      temperature: 0.9,
      maxOutputTokens: TEXT_OUTPUT_TOKEN_LIMIT,
    }, (model) => { usedModel = model; });
    return { text: privacy.restore(result), model: usedModel, privacyApplied: privacy.applied };
  } catch (error: any) {
    console.error('Sports Generator Error:', error);
    throw new Error(describeGenerationError(error));
  }
};

export const generateCreativeActivityReport = async (
  request: CreativeActivityGenerationRequest,
): Promise<{ text: string; model: string; privacyApplied: boolean }> => {
  try {
    const lengthInstruction = getLengthInstruction(request.lengthOption, request.customLength, request.lengthUnit);
    const keywordsStr = request.keywords.length > 0
      ? request.keywords.join(', ')
      : '(미입력 — 개별 관찰 내용과 학생 메모에서 주요 활동을 직접 찾아 활용할 것)';
    const avoidInstruction =
      request.avoidPhrases && request.avoidPhrases.length > 0
        ? `\n[주의 - 절대 사용 금지 문구]: "${request.avoidPhrases.join('", "')}"`
        : '';

    const roleMap: Record<string, string> = {
      '1학기 학급 회장': '1학기 학급자치회장(0000.00.00-0000.00.00.)으로',
      '2학기 학급 회장': '2학기 학급자치회장(0000.00.00-0000.00.00.)으로',
      '1학기 학급 부회장': '1학기 학급자치부회장(0000.00.00-0000.00.00.)으로',
      '2학기 학급 부회장': '2학기 학급자치부회장(0000.00.00-0000.00.00.)으로',
    };

    const foundRole = request.keywords.find((k) => roleMap[k]);
    const leadershipInstruction =
      request.activityType === '자율활동' && foundRole
        ? `\n[중요: 임원 활동 기재 양식 준수] 반드시 문장의 시작을 "${roleMap[foundRole]} ..."으로 하세요. 날짜는 임의로 '0000.00.00'으로 채우세요.`
        : '';

    // 활동 영역별로 평가 관점이 다르므로 유형에 맞는 기재 기준을 함께 보낸다.
    const typeGuideMap: Record<string, string> = {
      자율활동: `[자율활동 기재 기준]
- 학급·학교 조직 안에서의 역할 수행, 행사 참여, 민주적 의사결정 과정 중심으로 서술
- 갈등 조정, 합의 도출, 역할 분담 등 공동체에 기여한 방식이 구체적으로 드러나게 작성
- 전공·진로 연결은 자연스러운 경우에만 가볍게 언급`,
      동아리활동: `[동아리활동 기재 기준]
- 주제 선택 이유 → 탐구·제작 과정 → 산출물·발견 → 심화·확장의 흐름으로 서술
- 지속적인 참여와 역할 변화, 탐구의 깊이가 드러나게 작성`,
      진로활동: `[진로활동 기재 기준]
- 활동 전후의 진로 인식 변화가 드러나게 서술
- 체험·탐색에서 무엇을 확인했고 이후 어떤 노력으로 이어졌는지 연결해 작성`,
      봉사활동: `[봉사활동 기재 기준]
- 활동의 동기와 지속성, 활동 과정에서 보인 태도 변화 중심으로 서술
- 시혜적 표현을 피하고 상호 배움과 책임감이 드러나게 작성`,
    };
    const typeGuide = typeGuideMap[request.activityType] ?? '';

    const prompt = `
${getDateContext()}
다음 정보를 바탕으로 학교생활기록부 '창의적 체험활동 특기사항'을 작성해줘.

[학생 정보 - 이름: ${request.studentName}] (이름은 참고만 하고 본문에는 절대 쓰지 말 것)
[학교급]: ${request.schoolLevel}
[활동명]: ${request.activityName}
[활동 유형]: ${request.activityType}
${typeGuide}

[연간 지도 계획(공통)]: ${request.annualPlan}

[개별 관찰 내용 및 역할]: ${request.additionalContext}
${formatStudentMemos(request.studentMemos)}
[주요 활동 키워드]: ${keywordsStr}

[작성 길이]: ${lengthInstruction}

[요구사항]
1. 주어 절대 금지. 2. 명사형 종결어미 + 온점 필수.
3. '~였음', '~하였음' 등 어색한 과거형 금지 → '~함', '~보임', '~나타냄' 사용.
4. 따옴표(', ") 절대 금지. 5. 결과 텍스트만 출력. 6. 작성 길이 엄수.
7. 단순 활동 나열 지양 → 학생의 구체적인 변화와 성장에 초점.
${leadershipInstruction}
${avoidInstruction}`;

    const privacy = withStudentPrivacy(prompt, request.studentName, request.privacyModeEnabled);
    let usedModel = '';
    const result = await aiGenerate(privacy.prompt, CREATIVE_ACTIVITY_SYSTEM_PROMPT(request.schoolLevel), {
      temperature: 0.9,
      maxOutputTokens: TEXT_OUTPUT_TOKEN_LIMIT,
    }, (model) => { usedModel = model; });
    return { text: privacy.restore(result), model: usedModel, privacyApplied: privacy.applied };
  } catch (error: any) {
    console.error('Creative Activity Generator Error:', error);
    throw new Error(describeGenerationError(error));
  }
};

// ─── 교무 AI — 공문서 작성기 ──────────────────────────────────────

export const generateDocument = async (
  docType: DocType,
  promptContext: string,
  gongmunType: GongmunType | undefined,
  pageCount: number,
  schoolYear: string,
  files: FileData[] = [],
  templateFiles: FileData[] = [],
  templateText: string = '',
  gongmunComplexity: GongmunComplexity = GongmunComplexity.MEDIUM,
  gonggoInputs?: GonggoInputs,
  onProgressText?: (accumulated: string) => void,
  useSearchGrounding = false,
): Promise<{ text: string; model: string; grounding?: GroundingInfo }> => {
  const volumeInstruction =
    docType === DocType.MESSAGE
      ? `[분량 지침] 이 문서는 모바일 문자 메시지(SMS/LMS)입니다. 요청된 문자 유형(단문/장문)에 맞춰 길이를 엄격히 준수하세요.`
      : docType === DocType.NEWSLETTER
        ? `[분량 지침] 이 문서는 가정통신문입니다. 정중하고 격식 있는 편지글 형식으로 작성하되, A4 용지 1장 분량 내외로 작성하세요.`
        : docType === DocType.PUMUI
          ? `[분량 지침] 이 문서는 내부 기안용 지출품의서입니다. 1페이지 내로 간결하게 작성하세요.`
          : docType === DocType.MEETING_MINUTES
            ? `[분량 지침] 이 문서는 각종 협의회 회의록입니다. 1~2페이지 내외로 작성하세요.`
            : docType === DocType.PROMOTION
              ? `[분량 지침] 이 문서는 언론 보도자료 및 SNS 홍보글입니다. 보도자료 본문은 A4 용지 기준으로 약 ${pageCount}장 분량이 되도록 내용을 구체화하여 작성하세요.`
              : docType === DocType.GONGMUN
                ? `[분량 지침] 이 문서는 교육행정 공문서(겉공문)입니다. 반드시 A4 용지 1페이지를 넘지 않아야 합니다.`
                : docType === DocType.GONGGO
                  ? `[분량 지침] 이 문서는 학교 공고문입니다. A4 용지 1~2장 분량으로 작성하세요.`
                  : `[분량 지침] 이 문서는 A4 용지 기준으로 약 ${pageCount}장 분량이 되도록 작성하세요.`;

  const commonContext = `[기본 설정] 학년도: ${schoolYear}학년도`;

  const numberingReinforcement = `
[항목 기호 4단계 위계 — 반드시 준수]
  1단계(대항목): 1.  2.  3.  ...
  2단계(중항목): 가.  나.  다.  ...
  3단계(소항목): 1)  2)  3)  ...
  4단계(세항목): 가)  나)  다)  ...
- 대항목(1., 2. ...) 바로 아래는 반드시 가. 나. 다. 로 시작하세요.
- 가./나./다. 아래에 세부 항목이 필요할 때는 1) 2) 3) 을 사용하세요.
- 1)/2)/3) 아래에 더 세부 항목이 필요할 때는 가) 나) 다) 을 사용하세요.
- 긴 문단으로 이어 쓰지 말고, 각 대항목 아래는 가. 나. 다. 개조식으로 분리하세요.`;

  const needsDocumentHeader = [
    DocType.PLAN,
    DocType.TRAINING_MATERIAL,
    DocType.REPORT,
    DocType.PROMOTION,
    DocType.NEWSLETTER,
    DocType.GONGGO,
  ].includes(docType);

  const titleHeaderInstruction = needsDocumentHeader
    ? `
[제목/기관 표시 규칙]
1. 문서 맨 위 제목은 반드시 다른 본문보다 확실히 크게, 중앙 정렬, 22pt 이상, 굵게 표시하세요. 예: <h1 style="text-align:center;font-size:22pt;font-weight:bold;margin:0 0 12px;">문서 제목</h1>
2. 제목 바로 다음 줄에 소속기관이 있으면 오른쪽 정렬로 표시하세요. 예: <div style="text-align:right;font-size:12pt;font-weight:bold;margin-bottom:24px;">소속기관명</div>
3. 제목과 소속기관 줄은 본문 표나 첫 항목보다 앞에 배치하세요.
4. 실제 보고서·계획서처럼 간결하고 자연스러운 문체를 사용하고, AI가 작성했다는 표현은 절대 쓰지 마세요.
5. 표는 border="1"을 사용하고, 모든 th와 td에 border:1px solid black; padding:10px 12px; vertical-align:middle;를 넣어 선과 여백이 명확하게 보이도록 하세요.
6. 문단과 표가 너무 붙지 않도록 주요 구역에는 margin-bottom:16px 이상을 사용하세요.`
    : '';

  const reportStyleInstruction = docType === DocType.NEWSLETTER || docType === DocType.MESSAGE
    ? ''
    : docType === DocType.GONGMUN || docType === DocType.PUMUI
      ? OFFICIAL_HAPSHO_STYLE_INSTRUCTION
      : REPORT_STYLE_ENDING_INSTRUCTION;

  let specificInstruction = '';

  switch (docType) {
    case DocType.GONGMUN: {
      const isInternal = gongmunType === GongmunType.INTERNAL;
      let attachmentText = '';
      if (files.length > 0) {
        if (files.length === 1) {
          attachmentText = `붙임  ${files[0].file.name} 1부.  끝.`;
        } else {
          const fileLines = files.map((f, i) => `${i + 1}. ${f.file.name} 1부.`);
          fileLines[fileLines.length - 1] += '  끝.';
          attachmentText = '붙임  ' + fileLines.join('<br>      ');
        }
      }

      let complexityInstruction = '';
      let outputExample = '';

      if (gongmunComplexity === GongmunComplexity.SIMPLE) {
        complexityInstruction = `[작성 모드: 간단] 구성: 1.관련, 2.본문(시행문), 붙임. 본문에는 '~와 같이 (실시/안내/운영)합니다.'만 작성. 세부내용은 붙임 참조.`;
        outputExample = `1. 관련: ${schoolYear}학년도 주요업무계획<br>2. 위 호와 관련하여 <strong>(핵심 건명)</strong>을(를) 붙임과 같이 (실시/안내)합니다.<br><br>${attachmentText || '붙임 &nbsp;운영 계획서 1부. &nbsp;끝.'}`;
      } else if (gongmunComplexity === GongmunComplexity.MEDIUM) {
        complexityInstruction = `[작성 모드: 중간] 구성: 1.관련, 2.본문, 개요(가,나,다 3~4항목), 붙임. 각 항목은 1줄 이내.`;
        outputExample = `1. 관련: ${schoolYear}학년도 주요업무계획<br>2. 위 호와 관련하여 <strong>(핵심 건명)</strong>을(를) 다음과 같이 실시하고자 합니다.<br><br>&nbsp;&nbsp;가. 일시: ...<br>&nbsp;&nbsp;나. 장소: ...<br>&nbsp;&nbsp;다. 대상: ...<br><br>${attachmentText || '붙임 &nbsp;운영 계획서 1부. &nbsp;끝.'}`;
      } else {
        complexityInstruction = `[작성 모드: 상세] 구성: 1.관련, 2.본문, 개요, 행정사항, 붙임. 표는 세부추진계획(일정·역할 분담 등 여러 항목을 줄 단위로 비교·정리해야 하는 내용)이 있을 때만, 그 부분에 한해 사용하세요. 그 외 행정사항이나 다른 항목은 가./나./다. 개조식 텍스트로 작성하고, 세부추진계획이 없거나 간단하면 공문 전체에 표를 넣지 마세요.`;
        outputExample = `1. 관련: ...<br>2. 위 호와 관련하여 ... 다음과 같이 실시합니다.<br><br>가.일시: ... 나.장소: ... 다.대상: ... 라.주요내용: ... 마.행정사항(필요 시에만 표, 아니면 개조식)<br><br>${attachmentText || '붙임 &nbsp;운영 계획서 1부. &nbsp;끝.'}`;
      }

      specificInstruction = `
작업: [교육행정 공문서(겉공문) 표지 작성]
${complexityInstruction}
[공통 작성 규칙]
1. 글자 색상: 무조건 검정색(#000000)만 사용.
2. 발신 명의 제외.
3. 마무리: '붙임' 표시 후 "끝."으로 마무리.
4. 항목 기호: ${numberingReinforcement}
5. 본문 시행문은 반드시 "~합니다.", "~입니다.", "~습니다.", "~하고자 합니다." 등 합쇼체로 작성하고, "~함.", "~임."으로 끝내지 마세요.
${files.length > 0 ? `[첨부 파일 처리 규칙 — 반드시 준수]
- 첨부된 문서는 이 겉공문의 '붙임' 항목에 기재될 계획서·문서입니다.
- 첨부 문서를 그대로 재작성하거나 복사하는 것은 절대 금지입니다.
- 첨부 문서에서 사업명, 일시, 장소, 대상, 주요 내용만 추출하여 겉공문 본문의 가./나./다. 항목을 채우세요.
- 출력은 반드시 겉공문(수신·경유·제목·본문·붙임) 형식만 생성해야 합니다. 계획서 본문은 출력에 포함하지 마세요.` : ''}
[출력 예시]
<div>수신 &nbsp;${isInternal ? '(내부결재)' : '수신자 참조'}<br>(경유)<br>제목 &nbsp;<strong>(제목)</strong><br><br>${outputExample}</div>`;
      break;
    }

    case DocType.PLAN:
      specificInstruction = `
작업: [세부 운영 계획서 작성]
[필수 구성] 1.추진배경 2.목적 3.운영방침 4.세부추진계획 5.소요예산(표) 6.기대효과
[작성 규칙] 항목 기호 준수, 소요예산은 표(Table)로 작성, 제목 아래 창의적인 부제 포함.
[서식 규칙] 제목은 본문보다 크게, 굵게, 가운데 정렬하세요. 표가 필요한 부분은 반드시 선이 보이는 table로 작성하세요.
[항목 기호 4단계 위계 — 반드시 준수]
  1단계(대항목): 1.  2.  3.  ...
  2단계(중항목): 가.  나.  다.  ...
  3단계(소항목): 1)  2)  3)  ...
  4단계(세항목): 가)  나)  다)  ...
[개조식 구성 필수]
- 모든 대항목(1. 2. 3. ...)은 문단형 설명 금지. 바로 가. 나. 다. 형식의 중항목으로 작성하세요.
- 가./나./다. 아래에 세부 항목이 필요할 때는 1) 2) 3) 을 사용하고, 1)/2)/3) 아래는 가) 나) 다) 을 사용하세요.
- 1. 추진배경: '필요성', '현황', '추진 근거', '문제점' 같은 소제목을 붙이지 말고, 바로 가. 나. 다. 본문을 작성하세요.
- 2. 목적: 별도 소제목 없이 가. 나. 다. 본문으로 작성하세요.
- 3. 운영방침: 별도 소제목 없이 가. 나. 다. 본문으로 작성하세요.
- 4. 세부추진계획: 운영 개요, 일정, 내용, 역할을 표와 짧은 개조식으로 정리하세요.
- 5. 소요예산: 예산 개요와 산출 내역 표 중심으로 작성하고, 집행 유의사항은 넣지 마세요.
- 6. 기대효과: '학생 측면', '교사 측면', '확산 측면' 같은 소제목을 붙이지 말고, 바로 가. 나. 다. 본문을 작성하세요.
- 각 가. 나. 다. 항목은 한 문장으로 작성하고, 너무 길면 두 문장으로 나누세요.
- 가. 항목에서 나. 항목으로 넘어갈 때, 나. 항목에서 다. 항목으로 넘어갈 때는 반드시 <br> 또는 별도 블록으로 줄바꿈하세요. 같은 줄에 가. 나. 다.를 이어 쓰지 마세요.
- 세부추진계획, 일정, 예산, 역할 분담처럼 표가 자연스러운 부분은 반드시 선이 있는 표로 정리하세요.
[문체] 모든 문장은 학교 계획서에 맞는 간결한 보고서체로 작성하세요. "~함.", "~임."을 억지로 붙이지 말고, 문맥에 맞게 단어 또는 짧은 구로 끝내세요.
[예시]
- 가. 학생들의 문해력 및 비판적 사고력 함양을 위한 체계적인 독서교육 강화 필요성 증대
- 나. 최근 디지털 환경의 발달로 학생들의 독서량 감소 및 깊이 있는 독서 경험 부족 현상 관찰
  1) 스마트폰 보급률 증가에 따른 독서 시간 감소
  2) 짧은 영상 콘텐츠 위주 미디어 소비 패턴 확산
[금지] 문서 맨 끝에 작성일, 제작년월, 학교장명, 기관장명, 직인, 결재란을 붙이지 마세요. 마지막은 기대효과 본문으로 끝내세요.`;
      break;

    case DocType.TRAINING_MATERIAL:
      specificInstruction = `
작업: [교직원 대상 연수자료(직무연수 교재) 작성]
[문서 성격 — 반드시 이해할 것]
- 이 문서는 계획서가 아니라, 담당자가 이 자료를 화면에 띄우고 교직원 앞에서 그대로 연수를 진행하는 교재입니다.
- 계획서의 구성(추진배경·목적·운영방침·세부추진계획·소요예산·기대효과)을 절대 쓰지 마세요. 예산·산출내역·집행 계획도 일절 넣지 마세요.
- 무엇을 하겠다는 계획이 아니라, 무엇을 알아야 하고 무엇을 지켜야 하는지를 가르치는 내용으로 채우세요.
[필수 구성 — 이 순서와 기호를 그대로 사용]
(맨 위) 연수명 제목과 부제 → 바로 아래 [연수 개요] 표: 연수명 / 대상 / 일시 / 장소 / 시간(이수 구분) / 방법 6개 항목을 2열 표로 정리
Ⅰ. 연수 목표 — 이 연수를 마친 뒤 교직원이 도달해야 할 상태 3개를 가. 나. 다.로 제시
Ⅱ. 연수의 필요성 — 법정 의무 여부, 최근 현장 쟁점, 예방 필요성을 가. 나. 다.로 제시
Ⅲ. 핵심 내용 — 이 자료의 본론. 소주제를 1. 2. 3.(3~5개)으로 나누고, 각 소주제 아래 가. 나. 다. 로 설명하며 필요하면 1) 2)로 더 나눔. 실제 강의에서 그대로 설명할 수 있을 만큼 구체적으로 작성. 소주제 전체를 한눈에 보는 표(소주제 | 핵심 내용 | 유의 사항) 1개 포함
Ⅳ. 사례와 판단 기준 — 학교 현장에서 생길 수 있는 상황을 표(상황 | 판단 | 근거 및 조치)로 4~6행 제시. 판단은 허용·위반·즉시 조치 중 하나로 명확히 표기
Ⅴ. 현장 실천 사항 — 1. 실천 수칙(가. 나. 다.) 2. 자가 점검표(점검 항목 | 예 | 아니오, 5~7행 표)
Ⅵ. 확인 학습 — 연수 내용을 점검하는 O/X 또는 단답 문항 4개를 1. 2. 3. 4.로 제시하고, 마지막에 정답과 한 줄 해설
Ⅶ. 한 장 요약 — 이 연수에서 반드시 기억할 내용 5가지를 가. 나. 다. 라. 마.로 압축
Ⅷ. 참고 자료 및 문의 — 근거 법령·지침·자료명(확인된 것만)과 교내 담당 부서를 가. 나.로 제시
[항목 기호 위계 — 반드시 준수]
  1단계(대단원): Ⅰ.  Ⅱ.  Ⅲ.  ...  (로마숫자, 계획서의 1. 2. 3.과 구분됨)
  2단계: 1.  2.  3.  ...
  3단계: 가.  나.  다.  ...
  4단계: 1)  2)  3)  ...
- 대단원 제목은 본문보다 크고 굵게 표시하고, 대단원 사이는 넉넉히 띄우세요.
- 각 단계는 반드시 줄을 바꿔 작성하고, 같은 줄에 여러 항목을 이어 쓰지 마세요.
[교육부·교육청 자료 반영 규칙]
- 교육부와 시도교육청이 실제로 운영하는 교직원 법정·기본 연수 체계(정보통신윤리·개인정보보호·청렴·부패방지·성희롱예방·아동학대예방·학교폭력예방·안전교육 등)의 일반적인 교육 내용과 판단 기준에 맞게 작성하세요.
- 첨부된 참고 자료가 있으면 그 자료의 최신 지침·사례를 최우선으로 반영하세요.
- 확인되지 않은 공문번호, 시행 연도, 개정 일자, 통계 수치, 특정 학교·개인의 실제 사건은 절대 지어내지 마세요.
- 근거 법령이나 지침을 인용해야 하는데 입력에 없으면 "(근거 법령·지침 확인 후 기재)"로 담당자가 채울 자리를 남기세요.
- 사례는 실명·실제 사건이 아니라 학교 현장에서 흔히 발생하는 상황 유형으로 각색하여 제시하세요.
[서식 규칙] 제목은 본문보다 크게, 굵게, 가운데 정렬하고 그 아래 연수 주제에 맞는 부제를 넣으세요. 표는 반드시 선이 보이는 table로 작성하세요.
[개조식·명사형 종결 — 반드시 준수]
- 모든 문장은 개조식으로 짧게 끊어 쓰고, 문단형 설명문으로 이어 쓰지 마세요.
- 모든 문장은 명사형 어미로 끝내세요. 예: ~ 준수, ~ 금지, ~ 필요, ~ 확인, ~ 강화, ~ 유의, ~ 해당함, ~ 적용됨.
- "~합니다.", "~입니다.", "~해야 합니다." 같은 높임말 종결을 본문에 사용하지 마세요.
- 표 안의 내용, 확인 학습 문항과 해설도 동일하게 개조식·명사형으로 작성하세요.
[예시]
Ⅲ. 핵심 내용
  1. 학생 개인정보 보호
    가. 수집 목적 범위를 벗어난 개인정보 수집·이용 금지
    나. 명렬표·성적 자료의 개인 저장매체 반출 및 개인 메신저 전송 금지
      1) 부득이한 경우 암호화 후 반출, 사용 후 즉시 삭제
      2) 반출 이력 기록 및 보관 필요
[금지] 소요예산·산출내역·추진배경·운영방침·기대효과 항목 금지. 문서 맨 끝에 작성일, 학교장명, 직인, 결재란 금지. 마지막은 Ⅷ. 참고 자료 및 문의로 끝내세요.`;
      break;

    case DocType.REPORT:
      specificInstruction = `
작업: [사업 결과 보고서 작성]
[문체] 모든 문장은 학교 결과 보고서에 맞는 간결한 보고서체로 작성하세요. "~완료함.", "~달성함."을 기계적으로 반복하지 말고, 운영 결과에 맞게 '운영 완료', '성과 확인', '개선 필요', '협력 체계 구축'처럼 자연스럽게 끝내세요. '~습니다', '~입니다' 금지.
[서식 규칙] 제목은 본문보다 크게, 굵게, 가운데 정렬하세요. 표가 필요한 부분은 반드시 선이 보이는 table로 작성하세요.
[항목 기호 4단계 위계 — 반드시 준수]
  1단계(대항목): 1.  2.  3.  ...
  2단계(중항목): 가.  나.  다.  ...
  3단계(소항목): 1)  2)  3)  ...
  4단계(세항목): 가)  나)  다)  ...
[필수 구성 — 반드시 이 순서와 항목으로 작성]
1. 추진 개요: 가. 사업명, 나. 기간, 다. 대상, 라. 예산, 마. 추진 목적을 개조식으로 작성 (배경/목적 장황하게 반복 금지)
2. 추진 실적: [계획 vs 결과 비교표] — 항목(일시/대상/횟수 등)별로 계획·결과 2열 표로 작성
3. 세부 운영 결과: 가. 운영 내용, 나. 참여 현황, 다. 주요 성과를 개조식으로 요약한 뒤 회차별/활동별 진행 내용 표 + 하단에 사진 첨부 표(2×2 또는 2×N 셀, 셀 안에 '[사진 첨부]'와 사진 설명 텍스트 삽입)
4. 만족도 조사 결과: 가. 조사 개요, 나. 주요 결과, 다. 개선 의견을 개조식으로 정리하고, 참여자 만족도 설문 결과 요약 표(항목·만족도·주요 의견) 포함 — 해당 정보가 없으면 '별도 조사 실시 예정'으로 기재
5. 예산 정산: [목|세목|산출내역|계획액|집행액|잔액|비고] 7열 표, 합계 행 포함, 집행률 명시
6. 운영 성과 및 제언: 가. 운영 성과, 나. 개선 사항, 다. 차기 계획을 개조식으로 작성. 구체적 수치가 있으면 포함
[개조식 작성 규칙] 표 앞뒤 설명도 긴 문단 금지. 각 항목은 반드시 가. 나. 다. 또는 표로 분리하세요. 각 항목은 한 문장 중심으로 작성하고, 장황하면 둘로 나누세요.
- 가./나./다. 아래에 세부 항목이 필요할 때는 1) 2) 3) 을 사용하고, 1)/2)/3) 아래는 가) 나) 다) 을 사용하세요.
- 가. 항목에서 나. 항목으로 넘어갈 때, 나. 항목에서 다. 항목으로 넘어갈 때는 반드시 <br> 또는 별도 블록으로 줄바꿈하세요. 같은 줄에 가. 나. 다.를 이어 쓰지 마세요.
- 추진 실적, 세부 운영 결과, 만족도 조사, 예산 정산 등 비교·정산·일정 정보는 반드시 선이 있는 표로 구분하세요.
[소제목 금지] 추진 개요와 운영 성과 및 제언의 하위 항목에는 '필요성', '현황', '문제점', '학생 측면', '교사 측면' 같은 분석용 소제목을 붙이지 마세요.
[금지] 계획서와 동일한 '기대효과' 섹션 반복 금지. '추진배경' 독립 항목 금지(추진개요에 통합). 미래형 문장 금지.`;
      break;

    case DocType.NEWSLETTER:
      specificInstruction = `
작업: [가정통신문(안내장) 작성]
[어조] 정중하고 격식 있는 높임말(합쇼체: ~합니다, ~해주십시오) 사용.
[구조] 제목(크고 진하게 중앙) → 인사말 → 본문(핵심 안내) → 맺음말 → 날짜 → 학교장`;
      break;

    case DocType.MESSAGE: {
      const isReplyMode = promptContext.includes('[답장 생성]: 예');
      const relationshipMatch = promptContext.match(/\[나와의 관계\]: (.+)/);
      const relationship = relationshipMatch ? relationshipMatch[1] : '';
      const toneMap: Record<string, string> = {
        '전체메시지': '공식적이고 정중한 표준 어조. 높임말(합쇼체) 사용.',
        '학부모': '정중하고 친절한 어조. 부모님께 드리는 느낌. 높임말(합쇼체) 사용.',
        '상급자': '매우 공손하고 격식 있는 어조. 존경을 표현하는 높임말. 간결하고 명확하게.',
        '동료교직원': '친근하면서도 예의 바른 어조. 해요체 또는 합니다체. 편안하게.',
        '학생': '부드럽고 친근한 어조. 해요체 또는 해라체. 이해하기 쉽게.',
        '친구': '캐주얼하고 친근한 어조. 반말 허용. 자연스럽고 편안하게.',
      };
      const toneInstruction = isReplyMode && relationship
        ? `[답장 어조] ${toneMap[relationship] || '정중한 어조.'}`
        : '[어조] 정중하고 격식 있는 높임말(합쇼체) 사용.';
      specificInstruction = `
작업: ${isReplyMode ? '[받은 메시지에 대한 답장 문자 작성]' : '[학부모 알림 문자 메세지 작성]'}
[단문(SMS)] 절대 40자(90byte) 초과 금지. 인사말 생략, 용건만 작성.
[장문(LMS)] 1000자 이내. [학교명/제목]으로 시작.${isReplyMode ? '' : ' 문의 전화번호 포함.'}
${toneInstruction}
${isReplyMode ? '[형식] 받은 메시지 내용을 인지하고 자연스럽게 이어지는 답장 메시지만 출력. 받은 메시지 반복 금지.' : ''}
[첨부 파일 처리 규칙 — 반드시 준수]
- 첨부 파일은 메시지 작성을 위한 참고 자료입니다.
- 첨부 파일 내용을 그대로 복사하거나 재출력하는 것은 절대 금지입니다.
- 첨부 파일에서 행사명·일시·장소·대상·안내 사항 등 필요한 정보만 추출하여 문자 메시지 형식으로 요약 작성하세요.
- 출력은 반드시 문자 메시지 본문만 생성해야 합니다.`;
      break;
    }

    case DocType.PUMUI:
      specificInstruction = `
작업: [지출품의서 기안문 작성]
[공통 규칙] 항목기호(1.→가.→1)), 붙임 표시, 산출내역은 표(Table) 절대 금지 — 텍스트 한 줄로만.
[문체] 본문 시행문은 반드시 합쇼체로 작성하세요. 예: "구입하고자 합니다.", "지급하고자 합니다.", "실시하고자 합니다." "~함.", "~임."으로 끝내지 마세요.
[금지] 결재란(담당/부서장/원감/원장/학교장 표), 서명란, 직인란을 절대 출력하지 마세요. 업무관리시스템에서 전자결재로 처리하므로 불필요합니다.
[물품] 1.관련 → 2.본문(구입) → 가.내역 나.용도 다.소요예산 라.산출내역
[수당] 1.관련 → 2.본문(지급) → 가.지급대상 나.사업일시 다.소요예산 라.산출내역
[업무추진비] 1.관련 → 2.본문(실시) → 가.일시 나.장소 다.협의사항 라.참석자 마.소요예산 바.산출내역`;
      break;

    case DocType.MEETING_MINUTES:
      specificInstruction = `
작업: [협의회 회의록 작성]
[필수 구성] 제목(중앙, 크게), 학교명(우측 상단), 그리고 아래 표.
[표 작성 규칙] 반드시 아래 4열 구조 템플릿을 그대로 따르세요. 행마다 열 수(colspan 합계 4)가 맞아야 표가 깨지지 않습니다.
<table border="1" style="border-collapse:collapse;width:100%;color:#000000;border:1px solid black;">
  <tr><th style="width:15%;">일시</th><td style="width:35%;">(일시)</td><th style="width:15%;">장소</th><td style="width:35%;">(장소)</td></tr>
  <tr><th>출석위원</th><td colspan="3">(직책·이름을 쉼표로 나열)</td></tr>
  <tr><th>회의안건</th><td colspan="3">(안건)</td></tr>
  <tr><th>발언자</th><th colspan="3">발언 내용</th></tr>
  <tr><td>(발언자1)</td><td colspan="3">(발언 내용 — 발언자별로 행을 나누어 작성)</td></tr>
  <tr><td colspan="4">서명란: 업무관리시스템 결재로 대신함</td></tr>
</table>`;
      break;

    case DocType.PROMOTION:
      specificInstruction = `
작업: [홍보자료 및 보도자료 작성]
[기본 구조] 제목, 본문(도입-전개-결론), 관계자 인터뷰 인용구 형식의 언론 보도자료.
[문체] 객관적 언론 보도용 문체(~했다, ~밝혔다).
[SNS 추가] 보도자료 아래에 [SNS 홍보용 요약]: 친근한 존댓말, 해시태그(#) 3~5개. 과장된 광고 문구는 피하세요.`;
      break;

    case DocType.GONGGO:
      specificInstruction = `
작업: [학교 공고문 작성]
[구조]
1. 상단: 공고 제목(크고 진하게 중앙 정렬) + 공고번호 + 공고일
2. 본문: 공고 내용 상세 서술 (1., 가., 1) 항목 기호 사용)
   - 접수 기간/마감일 명시
   - 지원 자격 및 방법
   - 제출 서류 (해당 시 표 사용)
3. 하단: 문의처, 날짜, 학교장 (직인란: "학 교 장 [직인]" 텍스트)
[작성 규칙]
- 공고 내용 요약을 바탕으로 학교 행정 공고문 형식에 맞게 완성.
- 항목 기호: ${numberingReinforcement}
[첨부 파일 처리 규칙 — 반드시 준수]
- 첨부 파일(계획서, 공문 등)은 공고문 작성에 참고할 자료입니다.
- 첨부 파일 내용을 그대로 복사하거나 재출력하는 것은 절대 금지입니다.
- 첨부 파일에서 사업명·목적·일정·자격 요건·신청 방법 등 공고에 필요한 정보만 추출하여 공고문 형식으로 재구성하세요.
- 공고 내용이 강사·인력·위원 모집인 경우, 지원 자격·담당 업무·신청 기간·제출 서류·선발 방법 항목을 갖춘 채용/모집 공고문으로 작성하세요.
- 출력은 반드시 공고문 형식(공고 제목·공고 내용·접수 방법·문의처)으로만 작성하세요. 계획서 본문은 출력에 포함하지 마세요.`;
      break;
  }

  let templateInstruction = '';
  if (templateFiles.length > 0 || templateText.trim() !== '') {
    templateInstruction = `[양식 (템플릿) 지침]
사용자가 작성 양식을 업로드했거나 직접 입력했습니다.
1. 양식의 텍스트, 구조, 서식을 최대한 그대로 유지하세요.
2. 빈칸, 괄호([]), 밑줄, 작성 지시문만 채워 넣으세요.
3. 양식의 기존 내용을 마음대로 삭제하거나 변형하지 마세요.`;
    if (templateText.trim()) {
      templateInstruction += `\n\n[사용자가 직접 입력한 양식 정보/구조]:\n${templateText}`;
    }
  }

  // Build multipart content
  const parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> = [];

  if (templateFiles.length > 0) {
    parts.push({ text: '--- 아래는 작성 양식(템플릿) 문서입니다. ---' });
    for (const tf of templateFiles) parts.push(fileToPart(tf));
  }

  if (files.length > 0) {
    const fileLabel = docType === DocType.GONGMUN
      ? '--- 아래는 겉공문의 붙임 항목에 기재될 첨부 문서입니다. 이 문서를 재작성하지 마세요. 사업명·일시·장소·대상·주요 내용만 추출하여 겉공문 본문 작성에 활용하세요. ---'
      : '--- 아래는 새 문서 작성에 참고할 자료입니다. 이 자료의 내용을 그대로 재출력하거나 복사하지 마세요. 새 문서를 직접 작성하되, 이 자료에서 필요한 정보(주제·배경·일정·예산 등)를 참고하세요. ---';
    parts.push({ text: fileLabel });
    for (const f of files) parts.push(fileToPart(f));
  }

  const gonggoField = (value: string | undefined): string => (value?.trim() ? value : '(미입력)');
  const gonggoContext =
    docType === DocType.GONGGO && gonggoInputs
      ? `
[공고 정보]
- 공고 제목: ${gonggoField(gonggoInputs.title)}
- 공고 번호: ${gonggoInputs.number || '제2026-001호 (임의 입력)'}
- 공고 내용: ${gonggoField(gonggoInputs.content)}
- 접수 기간/마감: ${gonggoField(gonggoInputs.deadline)}
- 문의처: ${gonggoField(gonggoInputs.contact)}
- 추가 사항: ${gonggoField(gonggoInputs.extraInfo)}`
      : '';

  // 사용자가 모든 입력칸을 채우지 않아도 제목·주제에 어울리는 완성 문서가 나오도록
  const emptyFieldInstruction = `[미입력 항목 처리 — 반드시 준수]
- 입력 정보에 "(미입력)"으로 표시되었거나 값이 비어 있는 항목은, 제목·주제와 문서 맥락에 어울리는 내용을 자연스럽게 추정하여 채워서 완성된 문서를 작성하세요.
- "(미입력)", "미정", "추후 안내", "정보가 제공되지 않음" 같은 표시를 결과물에 절대 남기지 마세요.
- 일시·기간이 비어 있으면 학년도와 오늘 날짜를 참고해 자연스러운 일정을 제안하고, 대상·장소 등은 학교 현장에서 일반적인 값으로 작성하세요.
- 단, 사용자가 실제로 입력한 항목의 내용은 그대로 반영하고 임의로 바꾸지 마세요.
- 법령명·공문번호·통계 등 근거·출처는 이 규칙의 예외입니다. [근거·출처 작성 규칙]에 따라 추측하지 말고 사용자가 채울 자리로 표시하세요.`;

  const referencesInstruction = useSearchGrounding
    ? SEARCH_GROUNDED_REFERENCES_INSTRUCTION
    : NO_FABRICATED_REFERENCES_INSTRUCTION;

  parts.push({
    text: `${specificInstruction}\n${titleHeaderInstruction}\n${reportStyleInstruction}\n${NATURAL_WRITING_INSTRUCTION}\n${FORMAL_PUBLIC_WRITING_INSTRUCTION}\n${referencesInstruction}\n${emptyFieldInstruction}\n${volumeInstruction}\n${commonContext}\n\n${templateInstruction}\n\n[입력 정보 및 요청사항]:\n${gonggoContext || promptContext}`,
  });

  try {
    let usedModel = '';
    let grounding: GroundingInfo | undefined;
    const options = { temperature: 0.3, useSearchGrounding };
    const raw = onProgressText
      ? await aiGenerateMultipartStream(parts, SYSTEM_INSTRUCTION, options, onProgressText, (model) => { usedModel = model; }, (info) => { grounding = info; })
      : await aiGenerateMultipart(parts, SYSTEM_INSTRUCTION, options, (model) => { usedModel = model; }, (info) => { grounding = info; });
    return { text: stripGeneratedCodeFences(raw), model: usedModel, ...(grounding ? { grounding } : {}) };
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    throw new Error(describeGenerationError(error));
  }
};

// ─── 교무 AI — 교사 업무 기록 ─────────────────────────────────────

export const generateLessonObservation = async (inputs: {
  date: string;
  subject: string;
  unit: string;
  grade: string;
  observationNotes: string;
  teacherName: string;
  privacyModeEnabled?: boolean;
  rosterNames?: string[];
}): Promise<{ text: string; model: string; privacyApplied: boolean }> => {
  const prompt = `
${getDateContext()}
교사가 직접 작성한 관찰 내용을 바탕으로 수업관찰기록 문서를 작성해주세요.

[수업 정보]
- 관찰 일시: ${inputs.date || '미입력'}
- 교과: ${inputs.subject}
- 단원/차시: ${inputs.unit || '미입력'}
- 학년반: ${inputs.grade || '미입력'}
- 수업 교사: ${inputs.teacherName || '미입력'}
- 교사 관찰 내용: ${inputs.observationNotes}

[작성 지침]
1. 교사가 입력한 관찰 내용을 있는 그대로 충실히 반영하고, 임의로 추가하거나 변경하지 마세요.
2. 수업 목표, 교사 활동, 학생 반응, 수업 분위기, 개선 제언 순으로 구성하세요.
3. 각 항목은 개조식(~함., ~임., ~였음.)으로 작성하세요.
4. 분량: A4 1~2장 내외.
5. 문서 내용만 출력하세요. 작성 경위·안내 문구·설명 문장을 문서 앞뒤에 절대 추가하지 마세요.`;

  const privacy = withStudentListPrivacy(prompt, inputs.rosterNames ?? [], inputs.privacyModeEnabled);
  let usedModel = '';
  const result = await aiGenerate(
    privacy.prompt,
    '당신은 교사의 수업관찰기록 문서 작성을 돕는 도우미입니다. 교사가 입력한 내용을 최우선으로 존중하고, 문서 형식 정리와 표현 다듬기만 담당하세요. 내용을 임의로 추가하거나 사실을 창작하지 마세요. 반드시 문서 본문만 출력하고, 작성 배경·안내·설명 등 메타 문구는 절대 출력하지 마세요.',
    { temperature: 0.4, maxOutputTokens: TEXT_OUTPUT_TOKEN_LIMIT },
    (model) => { usedModel = model; },
  );
  return { text: privacy.restore(result), model: usedModel, privacyApplied: privacy.applied };
};

export const generateCounselingLog = async (inputs: {
  date: string;
  counselingType: string;
  participants: string;
  studentName: string;
  counselingContent: string;
  followUpPlan: string;
  privacyModeEnabled?: boolean;
}): Promise<{ text: string; model: string; privacyApplied: boolean }> => {
  const prompt = `
${getDateContext()}
교사가 직접 기록한 상담 내용을 바탕으로 상담일지 문서를 작성해주세요.

[상담 정보]
- 일시: ${inputs.date || '미입력'}
- 상담 유형: ${inputs.counselingType}
- 참여자: ${inputs.participants || '미입력'}
- 학생: ${inputs.studentName || '미입력'}
- 교사 상담 내용: ${inputs.counselingContent}
- 후속 지원 계획: ${inputs.followUpPlan || '없음'}

[작성 지침]
1. 교사가 입력한 상담 내용을 있는 그대로 충실히 반영하고, 임의로 추가하거나 변경하지 마세요.
2. 상담 목적, 주요 내용, 학생 반응, 조치 사항, 후속 계획 순으로 구성.
3. 각 항목은 개조식(~함., ~임., ~하기로 함.)으로 작성하세요.
4. 문서 내용만 출력하세요. 작성 경위·안내 문구·설명 문장을 문서 앞뒤에 절대 추가하지 마세요.`;

  const privacy = withStudentPrivacy(prompt, inputs.studentName, inputs.privacyModeEnabled);
  let usedModel = '';
  const result = await aiGenerate(
    privacy.prompt,
    '당신은 교사의 상담일지 문서 작성을 돕는 도우미입니다. 교사가 입력한 내용을 최우선으로 존중하고, 문서 형식 정리와 표현 다듬기만 담당하세요. 내용을 임의로 추가하거나 사실을 창작하지 마세요. 반드시 문서 본문만 출력하고, 작성 배경·안내·설명 등 메타 문구는 절대 출력하지 마세요.',
    { temperature: 0.4, maxOutputTokens: TEXT_OUTPUT_TOKEN_LIMIT },
    (model) => { usedModel = model; },
  );
  return { text: privacy.restore(result), model: usedModel, privacyApplied: privacy.applied };
};

export const generateClassManagementLog = async (inputs: {
  week: string;
  dateRange: string;
  grade: string;
  keyActivities: string;
  studentIssues: string;
  teacherNotes: string;
  privacyModeEnabled?: boolean;
  rosterNames?: string[];
}): Promise<{ text: string; model: string; privacyApplied: boolean }> => {
  const prompt = `
${getDateContext()}
교사가 직접 기록한 학급 운영 내용을 바탕으로 학급경영일지 문서 작성을 보조해주세요.
교사의 기록이 최우선이며, AI는 문서 형식 정리와 표현 보완만 담당합니다.

[주간 정보]
- 주차: ${inputs.week}
- 기간: ${inputs.dateRange}
- 학년/반: ${inputs.grade}
- 교사 기록 — 주요 활동: ${inputs.keyActivities}
- 교사 기록 — 학생 특이사항: ${inputs.studentIssues || '없음'}
- 교사 소감/메모: ${inputs.teacherNotes || '없음'}

[작성 지침]
1. 교사가 입력한 내용을 있는 그대로 충실히 반영하고, 임의로 추가하거나 변경하지 마세요.
2. 주요 학급 활동, 학생 특이사항, 학부모 소통, 다음 주 계획 순으로 구성.
3. 각 항목은 개조식(~함., ~임., ~였음.)으로 작성하세요.`;

  const privacy = withStudentListPrivacy(prompt, inputs.rosterNames ?? [], inputs.privacyModeEnabled);
  let usedModel = '';
  const result = await aiGenerate(
    privacy.prompt,
    '당신은 담임교사의 학급경영일지 문서 작성을 보조하는 도우미입니다. 교사가 입력한 내용을 최우선으로 존중하고, 문서 형식 정리와 표현 다듬기만 담당하세요. 내용을 임의로 추가하거나 사실을 창작하지 마세요.',
    { temperature: 0.4, maxOutputTokens: TEXT_OUTPUT_TOKEN_LIMIT },
    (model) => { usedModel = model; },
  );
  return { text: privacy.restore(result), model: usedModel, privacyApplied: privacy.applied };
};

export const analyzeOfficialDocument = async (inputs: {
  title: string;
  pastedText: string;
  files: FileData[];
}): Promise<{ text: string; model: string }> => {
  const prompt = `
${getDateContext()}
학교 또는 교육청 공문을 분석하여 교사가 바로 확인할 수 있는 짧은 업무 메모로 정리해주세요.

[사용자가 입력한 제목/메모]
${inputs.title || '미입력'}

[사용자가 붙여넣은 공문 내용]
${inputs.pastedText || '없음'}

[정리 지침]
1. 원문에 없는 사실을 추측하거나 추가하지 마세요.
2. 전체 결과는 16줄 이내로 작성하세요.
3. 문장은 짧게 쓰고, 모두 개조식으로 정리하세요.
4. 실제 행동이 필요한 내용만 남기고 배경 설명은 과감히 줄이세요.
5. 일시, 기간, 장소, 대상, 신청/접수/제출 링크, 웹페이지 주소, QR 안내, 회의 ID처럼 실행에 필요한 주요 정보가 있으면 반드시 빠뜨리지 마세요.
6. 마감일, 제출처, 제출 방법, 필요 서류가 있으면 반드시 적으세요.
7. 정보가 없거나 불명확하면 "원문 확인 필요"라고 쓰세요.
8. 원문 전체를 다시 쓰지 마세요.
9. 출력은 아래 형식을 지켜주세요.

## 한 줄 요약
- 

## 할 일
- 

## 일시/장소/링크
- 

## 마감
- 

## 담당/문의
- `;

  const fileParts = inputs.files.map(file => ({
    inlineData: {
      data: file.base64.split(',')[1] || file.base64,
      mimeType: file.mimeType,
    },
  }));

  let usedModel = '';
  const onModel = (model: string) => { usedModel = model; };

  if (fileParts.length > 0) {
    const text = await aiGenerateMultipart(
      [{ text: prompt }, ...fileParts],
      '당신은 학교와 교육청 공문을 짧은 업무 메모로 정리하는 행정 보조자입니다. 원문에 없는 사실을 만들지 말고, 일시·장소·링크·마감·제출 업무를 반드시 간결하게 드러내세요.',
      { temperature: 0.2 },
      onModel,
    );
    return { text, model: usedModel };
  }

  const text = await aiGenerate(
    prompt,
    '당신은 학교와 교육청 공문을 짧은 업무 메모로 정리하는 행정 보조자입니다. 원문에 없는 사실을 만들지 말고, 일시·장소·링크·마감·제출 업무를 반드시 간결하게 드러내세요.',
    { temperature: 0.2 },
    onModel,
  );
  return { text, model: usedModel };
};

export const askEducationQuestion = async (
  question: string,
  history: Array<{ role: 'user' | 'model'; text: string }>,
): Promise<string> => {
  try {
    // 토큰 절약을 위해 최근 대화 6개만 컨텍스트로 보낸다.
    const historyText = history
      .slice(-6)
      .map((m) => `[${m.role === 'user' ? '교사' : 'AI'}]: ${m.text}`)
      .join('\n');
    const fullPrompt = historyText ? `${historyText}\n[교사]: ${question}` : question;
    return await aiGenerate(fullPrompt, EDUCATION_QA_SYSTEM_PROMPT, { temperature: 0.7, maxOutputTokens: TEXT_OUTPUT_TOKEN_LIMIT });
  } catch (error: any) {
    console.error('Education QA Error:', error);
    throw new Error(describeGenerationError(error));
  }
};

// ─── File Parsing Functions (IPC wrappers) ────────────────────────


export const parseAssessmentTasks = async (base64Data: string, mimeType: string, hintSubject?: string): Promise<ParsedTaskData[]> => {
  const isHintProvided = hintSubject && hintSubject.trim().length > 0;
  const prompt = `이 파일은 학교 생활기록부 기재를 위한 '평가 계획서' 또는 '수행평가 목록'입니다.
파일 내용(표나 텍스트)을 주의 깊게 분석하여 교과목과 평가 과제 정보를 추출하세요.
${isHintProvided ? `[중요] 사용자가 현재 선택한 교과목은 '${hintSubject}'입니다.` : '파일에 포함된 모든 교과목의 평가 과제를 찾아내어 추출하세요.'}
[표준 교과목 목록 참고] ${SUBJECT_LIST.join(', ')}
[요구사항] JSON 배열 형태로 반환하세요.
구조: [{ "subject": "국어", "tasks": [{ "task": "과제명", "level": "상" }] }]
오직 JSON 데이터만 반환하세요.`;

  const parts = [
    { inlineData: { data: base64Data, mimeType } },
    { text: prompt },
  ];
  const text = await aiGenerateMultipart(parts, undefined, { temperature: 0.1, responseJson: true });
  const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const parsedData = JSON.parse(cleanJson);
  const results: any[] = Array.isArray(parsedData) ? parsedData : [parsedData];
  return results.map((item: any) => ({
    subject: item.subject || '미확인 교과',
    tasks: Array.isArray(item.tasks)
      ? item.tasks.map((t: any, index: number) => ({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}-${index}`,
          task: t.task || t.content || '',
          level: '상' as const,
        }))
      : [],
  }));
};

export const parseNeisGradeFiles = async (files: { data: string; mimeType: string }[]): Promise<NeisAnalyzedData[]> => {
  if (files.length === 0) throw new Error('No files provided');
  const prompt = `이 파일들은 나이스(NEIS)에서 내려받은 학생들의 개인별 성적 조회 파일입니다.
파일 내용을 정밀 분석하여 다음 JSON 형식으로 반환하세요.
[{ "semester": "1학기", "subject": "국어", "tasks": ["과제명"], "students": [{ "name": "홍길동", "evaluations": ["상"] }] }]
- ◎=상, ○=중, △=하. 오직 JSON 데이터만 반환하세요.`;
  const parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> = [];
  files.forEach((f) => parts.push({ inlineData: { mimeType: f.mimeType, data: f.data } }));
  parts.push({ text: prompt });
  const text = await aiGenerateMultipart(parts, undefined, { temperature: 0.1, responseJson: true });
  const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleanJson);
  return Array.isArray(parsed) ? parsed : [parsed];
};

// 학생 개인의 활동 결과물·기록물(활동지, 수행평가 결과물, 실험/작품 사진, 관찰일지, 포트폴리오 등)을
// 스캔하거나 촬영한 파일을 분석해 학생기록 작성에 참고할 관찰 내용을 정리한다.
// 글자만 옮겨 적는 OCR이 아니라 결과물의 내용·완성도·드러나는 태도와 역량까지 이미지 전체를 분석하도록 지시한다.
export const parseStudentObservationFromFiles = async (
  files: Array<{ data: string; mimeType: string }>,
  hint?: string,
): Promise<string> => {
  if (files.length === 0) return '';
  const prompt = `이 파일들은 한 학생의 활동 결과물이나 관찰 기록(활동지, 수행평가 결과물, 실험·작품 사진, 관찰일지, 포트폴리오 등)을 스캔하거나 촬영한 자료입니다.
단순히 파일 속 글자를 그대로 옮겨 적지 말고, 이미지 전체를 분석하세요. 학생이 수행한 활동 과정과 방법, 결과물의 내용과 완성도, 그 안에서 드러나는 태도·역량·성장을 파악해 학교생활기록부 작성에 참고할 수 있는 구체적인 관찰 내용을 서술형 텍스트로 정리해주세요.
${hint ? `[참고 - 현재 작성 중인 항목]: ${hint}` : ''}
[요구사항]
1. 글자가 있다면 참고하되 그대로 옮겨 적지 말고, 내용을 이해해서 관찰 내용으로 재구성하세요.
2. 결과물의 완성도, 사용한 방법이나 접근 방식, 드러나는 강점이나 보완점을 구체적으로 서술하세요.
3. 파일에 학생 이름이 보이더라도 이름은 결과 텍스트에 절대 포함하지 마세요.
4. 과장하거나 추측하지 말고, 파일에서 실제로 확인 가능한 내용만 서술하세요.
5. 오직 정리된 관찰 내용 텍스트만 출력하세요.`;
  const parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> = [];
  files.forEach((f) => parts.push({ inlineData: f }));
  parts.push({ text: prompt });
  return await aiGenerateMultipart(parts, undefined, { temperature: 0.2 });
};

// ─── 수업 AI — 수업자료 생성 ──────────────────────────────────────

export interface LessonSlide {
  page: number;
  title: string;
  content: string[];
  notes: string;
  imagePrompt?: string;
}

export interface LessonParams {
  grade: string;
  subject: string;
  unit: string;
  topic: string;
  details?: string;
}

const LESSON_SYSTEM_PROMPT = `당신은 대한민국 교육과정 전문가로서 교사의 수업 자료 제작을 돕는 보조자입니다.
한국 국가교육과정 성취기준에 맞는 양질의 수업 자료를 생성하세요.
학습자 수준에 적합한 어휘와 내용을 사용하고, 실제 수업 현장에서 바로 활용 가능하도록 구체적으로 작성하세요.
${NATURAL_WRITING_INSTRUCTION}`;

const getLessonGradeGuidance = (grade: string): string => {
  if (grade.includes('초등')) {
    return `[학년 적합성 - 초등학교]
- 어휘: 쉽고 친숙한 일상 언어, 개념 설명 시 구체적 예시와 비유 활용
- 분량: 슬라이드당 핵심 내용 2~3개, 활동지 활동 1~2개씩 간결하게
- 방식: 놀이·체험·조작 활동 중심, 그림/도표로 시각화
- 수업 시간: 40분 기준으로 도입 5분·전개 25분·정리 10분`;
  } else if (grade.includes('중학')) {
    return `[학년 적합성 - 중학교]
- 어휘: 교과 기본 용어 도입, 기초 학술 언어와 일상 언어 혼용
- 분량: 슬라이드당 핵심 내용 3~4개, 활동지 활동 2~3개
- 방식: 탐구·토의 활동 포함, 실생활 연계 예시로 흥미 유발
- 수업 시간: 45분 기준으로 도입 5분·전개 30분·정리 10분`;
  } else if (grade.includes('고등')) {
    return `[학년 적합성 - 고등학교]
- 어휘: 교과 전문 용어 적극 활용, 학술적·분석적 표현
- 분량: 슬라이드당 핵심 내용 4~5개, 활동지 활동 3~4개 심화
- 방식: 심화 탐구·논술·비판적 사고 포함, 입시와 연계 가능한 활동
- 수업 시간: 50분 기준으로 도입 5분·전개 35분·정리 10분`;
  }
  return '';
};

export async function generateLessonSlides(params: LessonParams, pageCount: number): Promise<{ slides: LessonSlide[]; model: string }> {
  const gradeGuidance = getLessonGradeGuidance(params.grade);
  const prompt = `${getDateContext()}
다음 수업 정보를 바탕으로 프레젠테이션 슬라이드 ${pageCount}장을 생성해주세요.

[수업 정보]
- 학년: ${params.grade}
- 교과: ${params.subject}
- 단원: ${params.unit}
- 주제/수업명: ${params.topic}
${params.details ? `- 추가 요청사항: ${params.details}` : ''}
${gradeGuidance ? `\n${gradeGuidance}` : ''}

[요구사항]
1. 반드시 ${pageCount}장의 슬라이드를 생성하세요.
2. 첫 번째 슬라이드는 제목 슬라이드로 구성하세요.
3. 각 슬라이드의 content는 2~3개의 짧고 임팩트 있는 핵심 bullet point로만 구성하세요. 각 항목은 20자 이내로 간결하게 작성하세요. 뒷자리 학생도 한눈에 읽을 수 있어야 합니다.
4. notes에는 교사용 발표 참고 내용을 작성하세요.
5. 한국 교육과정 성취기준에 맞게 작성하세요.
6. imagePrompt에는 해당 슬라이드 내용을 시각적으로 표현하는 영어 이미지 생성 프롬프트를 20단어 이내로 작성하세요. 교육적이고 텍스트가 없는 이미지를 묘사하세요. 예시: "colorful diagram of photosynthesis in a plant leaf, educational illustration, no text, no labels" / "Korean middle school students conducting science experiment, bright classroom, photorealistic"
7. 슬라이드 제목과 내용에는 이모지, Markdown 기호, 장식용 특수기호를 넣지 마세요.

반드시 아래 JSON 배열 형식으로만 응답하세요 (마크다운 코드블록 없이):
[{"page":1,"title":"슬라이드 제목","content":["내용1","내용2"],"notes":"교사 메모","imagePrompt":"educational image description in english, no text"}]`;

  let usedModel = '';
  const response = await aiGenerate(prompt, LESSON_SYSTEM_PROMPT, { temperature: 0.6, responseJson: true }, (model) => { usedModel = model; });
  const cleaned = response.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (!arrayMatch) throw new Error('슬라이드 JSON 파싱 실패: 올바른 배열 형식이 아닙니다.');
  const parsed = JSON.parse(arrayMatch[0]);
  const slides = Array.isArray(parsed) && parsed.length > 0 ? parsed : (() => { throw new Error('슬라이드 생성 결과가 비어있습니다. 다시 시도해주세요.'); })();
  return { slides, model: usedModel };
}

export async function generateLessonWorksheet(
  params: LessonParams,
  worksheetType: 'activity' | 'assessment',
  questionCount: number,
  includeScore: boolean,
  insertImagePlaceholder = false,
): Promise<{ text: string; model: string }> {
  const typeLabel = worksheetType === 'activity' ? '워크시트' : '평가지';
  const baseFontSize = params.grade.includes('초등') ? '12pt' : params.grade.includes('중학') ? '11pt' : '10pt';
  const h1Size = params.grade.includes('초등') ? '18pt' : params.grade.includes('중학') ? '17pt' : '16pt';
  const h2Size = params.grade.includes('초등') ? '13pt' : params.grade.includes('중학') ? '12pt' : '11pt';
  const tableSize = params.grade.includes('초등') ? '11.5pt' : params.grade.includes('중학') ? '10.5pt' : '9.5pt';
  const gradeGuidance = getLessonGradeGuidance(params.grade);
  const prompt = `${getDateContext()}
다음 수업 정보를 바탕으로 ${typeLabel}를 HTML 형식으로 생성해주세요.

[수업 정보]
- 학년: ${params.grade}
- 교과: ${params.subject}
- 단원: ${params.unit || ''}
- 주제/수업명: ${params.topic}
${params.details ? `- 추가 요청사항: ${params.details}` : ''}
${gradeGuidance ? `\n${gradeGuidance}\n` : ''}
[요구사항]
- 활동 수: ${questionCount}개
- 점수란 포함: ${includeScore ? '예 (각 활동에 점수 배점 표시)' : '아니오'}
- ${questionCount <= 2 ? 'A4 용지를 꽉 채울 수 있도록 각 활동에 충분한 여백과 설명 공간을 배치하세요. 기본 폰트 크기보다 1~2pt 크게 설정하고 줄 간격도 넉넉하게 잡으세요' : questionCount <= 4 ? 'A4 용지를 균형 있게 채울 수 있도록 적당한 여백과 설명을 배치하세요' : '반드시 A4 용지 1장에 모든 내용이 들어가도록 간결하고 컴팩트하게 구성하세요'}
- ${questionCount <= 2 ? '각 활동에 충분한 답변 공간(줄 5~8개)을 확보하여 A4를 꽉 채우세요' : questionCount <= 4 ? '각 활동에 적당한 답변 공간(줄 2~4개)을 배치하세요' : '각 활동은 핵심 내용만 최소한의 공간으로 구성하고, 답변 공간은 줄 1~3개로 제한하세요'}
- 머리글 구조: 문서 제목(h1)에는 반드시 style="text-align:center;" 속성을 추가하세요. 학년/반/이름 기입란은 그 아래 별도 행에 '<div class="student-info" style="display:flex;gap:16pt;justify-content:flex-end;border-bottom:1pt solid #000;padding-bottom:3pt;margin-bottom:6pt;">' 형태로 오른쪽 정렬 배치하고, 각 항목은 '<span>학년: <span class="fill" style="display:inline-block;min-width:50pt;border-bottom:1pt solid #333;">&nbsp;</span></span>' 형태로 작성 공간이 밑줄로 표시되게 하세요.
${insertImagePlaceholder ? "- 학년/반/이름 기입란 바로 아래, 첫 번째 활동 시작 전에 반드시 '<div class=\"worksheet-image\">[WORKSHEET_IMAGE]</div>' 줄을 정확히 이 형태로 삽입하세요." : ''}
- 한글 단어 중간에서 줄바꿈이 일어나지 않도록 word-break: keep-all을 반드시 적용하세요
- 본문에는 이모지, Markdown 기호, 장식용 특수기호를 넣지 말고 자연스러운 학교 자료 문체로 작성하세요.
${insertImagePlaceholder ? "- 이미지는 반드시 '[WORKSHEET_IMAGE]' 플레이스홀더 하나로만 표시하고, 그 외 <img> 태그나 외부 이미지 URL은 절대 사용하지 마세요." : "- <img> 태그, 외부 이미지 URL, 이미지 파일 참조, '[그림: ...]' 형태의 그림 설명 텍스트를 절대 사용하지 마세요. 그림이 필요한 부분은 그림 없이 텍스트와 표만으로 구성하세요."}
- 반드시 A4 용지 1장 안에 모든 내용이 들어가도록 여백과 폰트 크기를 조절하세요. 내용이 잘려 넘어가지 않도록 하세요.
- 한글 단어 중간에서 줄바꿈이 일어나지 않도록 word-break: keep-all을 반드시 적용하고, 단어가 페이지 밖으로 넘치지 않도록 overflow-wrap: break-word도 적용하세요.

반드시 완전한 HTML 문서로 응답하세요. <!DOCTYPE html>부터 </html>까지 포함하세요.
<style> 태그에 다음 CSS를 반드시 포함하세요:
@page { size: A4; margin: 12mm 14mm; }
html, body { width: 100%; max-width: 100%; box-sizing: border-box; }
body { font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; font-size: ${baseFontSize}; color: #000; margin: 0; padding: 0; word-break: keep-all; overflow-wrap: break-word; }
h1 { font-size: ${h1Size}; text-align: center; margin: 0 0 4pt; word-break: keep-all; }
h2, h3 { font-size: ${h2Size}; margin: 6pt 0 3pt; page-break-after: avoid; word-break: keep-all; }
.student-info { display: flex; gap: 16pt; justify-content: flex-end; margin-bottom: 6pt; font-size: ${baseFontSize}; border-bottom: 1pt solid #000; padding-bottom: 3pt; }
.student-info span { white-space: nowrap; }
.student-info .fill { display: inline-block; min-width: 50pt; border-bottom: 1pt solid #333; }
.activity, section, .question { page-break-inside: avoid; margin-bottom: 8pt; }
.answer-lines { border-bottom: 1pt solid #999; min-height: 14pt; margin-top: 3pt; }
.worksheet-image { text-align: center; margin: 6pt 0 10pt; page-break-inside: avoid; }
.worksheet-image img { max-width: 100%; max-height: 140pt; object-fit: contain; }
table { width: 100%; border-collapse: collapse; font-size: ${tableSize}; word-break: keep-all; table-layout: fixed; }
th, td { border: 0.8pt solid #444; padding: 3pt 5pt; word-break: keep-all; overflow-wrap: break-word; }
p { margin: 2pt 0; line-height: 1.5; }
* { box-sizing: border-box; max-width: 100%; }
또한 모든 <table> 태그에 style="border-collapse:collapse;width:100%;table-layout:fixed;" 속성을, 모든 <th>와 <td>에 style="border:0.8pt solid #444;padding:3pt 5pt;word-break:keep-all;" 속성을 반드시 추가하세요.
마크다운 코드블록 없이 HTML 코드만 응답하세요.`;

  let usedModel = '';
  const raw = await aiGenerate(prompt, LESSON_SYSTEM_PROMPT, { temperature: 0.5 }, (model) => { usedModel = model; });
  return { text: stripGeneratedCodeFences(raw), model: usedModel };
}

export type QuizType = 'MULTIPLE_CHOICE' | 'SHORT_ANSWER' | 'OX';

export interface QuizQuestion {
  type: 'multiple-choice' | 'short-answer' | 'ox';
  question: string;
  options?: string[];
  answer: string;
}

export interface QuizData {
  title: string;
  questions: QuizQuestion[];
}

function parseQuizJson(raw: string): QuizData {
  let s = raw.trim().replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/m, '');
  const m = s.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('퀴즈 데이터를 생성하지 못했습니다. 다시 시도해주세요.');
  const data = JSON.parse(m[0]) as QuizData;
  if (!data.title || !Array.isArray(data.questions) || data.questions.length === 0) {
    throw new Error('퀴즈 데이터 형식이 올바르지 않습니다. 다시 시도해주세요.');
  }
  return data;
}

function buildQuizHtml(data: QuizData): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const qJson = JSON.stringify(data.questions).replace(/<\/script>/gi, '<\\/script>');
  const title = esc(data.title);
  const count = data.questions.length;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif;background:linear-gradient(135deg,#eff6ff 0%,#fef9ee 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px}
.card{background:#fff;border-radius:20px;box-shadow:0 8px 40px rgba(0,0,0,.13);width:min(580px,100%);padding:36px 28px}
.title{font-size:1.75em;font-weight:800;color:#1e293b;text-align:center;margin-bottom:8px;line-height:1.3}
.sub{color:#64748b;text-align:center;margin-bottom:28px;font-size:.95em}
.prog-wrap{background:#e2e8f0;border-radius:99px;height:8px;margin-bottom:18px;overflow:hidden}
.prog-bar{background:linear-gradient(90deg,#f59e0b,#fb923c);border-radius:99px;height:100%;transition:width .35s ease}
.q-num{color:#94a3b8;font-size:.9em;margin-bottom:10px}
.question{font-size:1.1em;font-weight:700;color:#1e293b;margin-bottom:20px;line-height:1.55}
.options{display:flex;flex-direction:column;gap:9px}
.opt-btn{background:#f8fafc;border:2px solid #e2e8f0;border-radius:12px;padding:12px 16px;text-align:left;font-size:1em;cursor:pointer;transition:all .15s;font-family:inherit;color:#334155}
.opt-btn:hover:not([disabled]){border-color:#f59e0b;background:#fffbeb}
.opt-btn.correct{border-color:#22c55e!important;background:#f0fdf4!important;color:#166534!important;font-weight:700}
.opt-btn.wrong{border-color:#ef4444!important;background:#fef2f2!important;color:#991b1b!important}
.opt-btn[disabled]{cursor:default}
.ox-wrap{display:flex;gap:20px;justify-content:center}
.ox-btn{width:96px;height:96px;border-radius:50%;border:3px solid #e2e8f0;font-size:2.6em;font-weight:900;cursor:pointer;transition:all .15s;background:#f8fafc;font-family:inherit;display:flex;align-items:center;justify-content:center}
.o-btn{color:#3b82f6}.x-btn{color:#ef4444}
.ox-btn:hover:not([disabled]){transform:scale(1.07)}
.ox-btn.correct{background:#f0fdf4!important;border-color:#22c55e!important}
.ox-btn.wrong{background:#fef2f2!important;border-color:#ef4444!important}
.ox-btn[disabled]{cursor:default;transform:none}
.sa-wrap{display:flex;gap:8px}
.sa-input{flex:1;border:2px solid #e2e8f0;border-radius:10px;padding:11px 14px;font-size:1em;font-family:inherit;outline:none;transition:border-color .15s}
.sa-input:focus{border-color:#f59e0b}
.sa-input[disabled]{background:#f8fafc;color:#94a3b8}
.sa-submit{background:#f59e0b;color:#fff;border:none;border-radius:10px;padding:11px 18px;font-size:1em;font-weight:700;cursor:pointer;font-family:inherit;transition:background .15s;white-space:nowrap}
.sa-submit:hover:not([disabled]){background:#d97706}
.sa-submit[disabled]{background:#d1d5db;cursor:default}
.feedback{min-height:26px;font-weight:700;font-size:1em;margin-top:14px}
.feedback.correct{color:#16a34a}.feedback.wrong{color:#dc2626}.feedback.open{color:#3b82f6}
.next-btn,.start-btn,.restart-btn{display:block;width:100%;padding:14px;border-radius:12px;border:none;font-size:1.1em;font-weight:800;cursor:pointer;transition:background .15s;font-family:inherit;margin-top:16px}
.start-btn,.next-btn{background:#f59e0b;color:#fff}
.start-btn:hover,.next-btn:hover{background:#d97706}
.restart-btn{background:#64748b;color:#fff}
.restart-btn:hover{background:#475569}
.score{font-size:2.6em;font-weight:900;color:#f59e0b;text-align:center;margin:16px 0}
.result-list{list-style:none;display:flex;flex-direction:column;gap:10px;margin-bottom:4px;max-height:48vh;overflow-y:auto}
.r-item{background:#f8fafc;border-radius:12px;padding:14px 16px;font-size:.93em;border-left:4px solid #e2e8f0}
.r-item.ok{border-left-color:#22c55e}.r-item.ng{border-left-color:#ef4444}.r-item.open{border-left-color:#94a3b8}
.r-q{font-weight:700;color:#1e293b;margin-bottom:4px}
.r-my{color:#64748b;margin-bottom:2px}
.r-ans{color:#16a34a;font-weight:700}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.card>div{animation:fadeUp .3s ease-out}
</style>
</head>
<body>
<div class="card">
  <div id="startScreen">
    <h1 class="title">${title}</h1>
    <p class="sub">총 ${count}개의 문제가 준비되어 있습니다</p>
    <button id="quizStartBtn" class="start-btn">퀴즈 시작</button>
  </div>
  <div id="questionScreen" style="display:none">
    <div class="prog-wrap"><div id="progBar" class="prog-bar" style="width:0%"></div></div>
    <p id="qNum" class="q-num"></p>
    <p id="qText" class="question"></p>
    <div id="optWrap" class="options" style="display:none"></div>
    <div id="saWrap" class="sa-wrap" style="display:none">
      <input id="saInput" class="sa-input" type="text" placeholder="정답을 입력하세요">
      <button id="saBtn" class="sa-submit">확인</button>
    </div>
    <div id="oxWrap" class="ox-wrap" style="display:none">
      <button class="ox-btn o-btn" data-val="O">O</button>
      <button class="ox-btn x-btn" data-val="X">X</button>
    </div>
    <p id="fb" class="feedback"></p>
    <button id="nextBtn" class="next-btn" style="display:none">다음 문제</button>
  </div>
  <div id="resultScreen" style="display:none">
    <h2 class="title">퀴즈 완료!</h2>
    <p id="scoreEl" class="score"></p>
    <ul id="resultList" class="result-list"></ul>
    <button id="restartBtn" class="restart-btn">다시 풀기</button>
  </div>
</div>
<script>
var Q=${qJson};
var idx=0,score=0,answered=false,log=[];
function g(id){return document.getElementById(id);}
function show(el){el.style.display='block';}
function hide(el){el.style.display='none';}
g('quizStartBtn').addEventListener('click',function(){
  hide(g('startScreen'));show(g('questionScreen'));
  idx=0;score=0;answered=false;log=[];loadQ();
});
function loadQ(){
  answered=false;
  var q=Q[idx];
  g('qNum').textContent='문제 '+(idx+1)+' / '+Q.length;
  g('qText').textContent=q.question;
  g('fb').textContent='';g('fb').className='feedback';
  hide(g('nextBtn'));g('optWrap').innerHTML='';
  hide(g('optWrap'));hide(g('saWrap'));hide(g('oxWrap'));
  g('progBar').style.width=Math.round((idx+1)/Q.length*100)+'%';
  if(q.type==='multiple-choice'){
    show(g('optWrap'));
    (q.options||[]).forEach(function(opt){
      var b=document.createElement('button');
      b.className='opt-btn';b.textContent=opt;
      b.onclick=function(){checkMC(opt,b);};
      g('optWrap').appendChild(b);
    });
  } else if(q.type==='short-answer'){
    show(g('saWrap'));
    g('saInput').value='';
    g('saInput').disabled=false;g('saBtn').disabled=false;
    g('saInput').onkeydown=function(e){if(e.key==='Enter')checkSA();};
    g('saBtn').onclick=checkSA;
    setTimeout(function(){g('saInput').focus();},80);
  } else if(q.type==='ox'){
    show(g('oxWrap'));
    g('oxWrap').querySelectorAll('.ox-btn').forEach(function(b){
      b.disabled=false;
      b.className=b.getAttribute('data-val')==='O'?'ox-btn o-btn':'ox-btn x-btn';
      b.onclick=function(){checkOX(b.getAttribute('data-val'),b);};
    });
  }
}
function checkMC(sel,btn){
  if(answered)return;answered=true;
  var q=Q[idx];var ok=sel===q.answer;if(ok)score++;
  log.push({q:q.question,user:sel,ans:q.answer,ok:ok});
  g('optWrap').querySelectorAll('.opt-btn').forEach(function(b){
    b.disabled=true;
    if(b.textContent===q.answer)b.classList.add('correct');
    else if(b===btn&&!ok)b.classList.add('wrong');
  });
  setFB(ok,q.answer);showNext();
}
function checkSA(){
  if(answered)return;
  var val=g('saInput').value.trim();if(!val)return;
  answered=true;g('saInput').disabled=true;g('saBtn').disabled=true;
  var q=Q[idx];
  if(q.answer===''){
    log.push({q:q.question,user:val,ans:'',ok:null});
    g('fb').textContent='잘 작성했어요!';g('fb').className='feedback open';
  } else {
    var ok=val.toLowerCase()===q.answer.toLowerCase();if(ok)score++;
    log.push({q:q.question,user:val,ans:q.answer,ok:ok});
    setFB(ok,q.answer);
  }
  showNext();
}
function checkOX(sel,btn){
  if(answered)return;answered=true;
  var q=Q[idx];var ok=sel===q.answer;if(ok)score++;
  log.push({q:q.question,user:sel,ans:q.answer,ok:ok});
  g('oxWrap').querySelectorAll('.ox-btn').forEach(function(b){
    b.disabled=true;
    var v=b.getAttribute('data-val');
    if(v===q.answer)b.classList.add('correct');
    else if(b===btn&&!ok)b.classList.add('wrong');
  });
  setFB(ok,q.answer);showNext();
}
function setFB(ok,ans){
  g('fb').textContent=ok?'정답입니다!':'틀렸어요. 정답: '+ans;
  g('fb').className='feedback '+(ok?'correct':'wrong');
}
function showNext(){setTimeout(function(){show(g('nextBtn'));},350);}
g('nextBtn').addEventListener('click',function(){
  idx++;if(idx<Q.length)loadQ();else showResult();
});
function showResult(){
  hide(g('questionScreen'));show(g('resultScreen'));
  var sc=log.filter(function(a){return a.ok!==null;}).length;
  g('scoreEl').textContent=score+' / '+sc;
  var ul=g('resultList');ul.innerHTML='';
  log.forEach(function(a,i){
    var li=document.createElement('li');
    var cls=a.ok===null?'open':a.ok?'ok':'ng';
    li.className='r-item '+cls;
    li.innerHTML='<div class="r-q">Q'+(i+1)+'. '+eH(a.q)+'</div>'
      +'<div class="r-my">내 답: '+eH(a.user||'(미입력)')+'</div>'
      +(a.ok!==null?'<div class="r-ans">정답: '+eH(a.ans)+'</div>':'<div class="r-ans">자유 응답</div>');
    ul.appendChild(li);
  });
}
function eH(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
g('restartBtn').addEventListener('click',function(){hide(g('resultScreen'));show(g('startScreen'));});
</script>
</body>
</html>`;
}

export async function generateLessonQuiz(params: LessonParams, questionCount: number, quizTypes: QuizType[]): Promise<{ text: string; model: string }> {
  const gradeGuidance = getLessonGradeGuidance(params.grade);
  const types = quizTypes.length > 0 ? quizTypes : ['MULTIPLE_CHOICE' as QuizType];
  const typeLines = types.map(t => {
    if (t === 'MULTIPLE_CHOICE') return '  - "multiple-choice": options 배열(4개) 필수, answer는 options 중 하나';
    if (t === 'SHORT_ANSWER') return '  - "short-answer": options 없음, answer는 짧은 단어/구 (자유 응답이면 answer를 빈 문자열 ""로)';
    return '  - "ox": options 없음, answer는 반드시 "O" 또는 "X"';
  }).join('\n');

  const prompt = `다음 수업 정보를 바탕으로 퀴즈 데이터를 JSON으로 생성해주세요.

[수업 정보]
- 학년: ${params.grade}
- 교과: ${params.subject}
- 단원: ${params.unit}
- 주제/수업명: ${params.topic}
${params.details ? `- 추가 요청사항: ${params.details}` : ''}
${gradeGuidance ? `\n${gradeGuidance}` : ''}
[요구사항]
- 문항 수: ${questionCount}개
- 사용할 문항 유형:
${typeLines}
- 문항은 수업 내용과 관련 있고 학년 수준에 맞게 출제
- 객관식 오답 보기는 그럴듯하게 작성

반드시 아래 JSON 형식으로만 응답하세요. 설명이나 마크다운 없이 JSON만:
{
  "title": "퀴즈 제목",
  "questions": [
    { "type": "multiple-choice", "question": "문제", "options": ["보기1","보기2","보기3","보기4"], "answer": "정답보기" },
    { "type": "short-answer", "question": "문제", "answer": "정답" },
    { "type": "ox", "question": "문제 (참이면 O, 거짓이면 X)", "answer": "O" }
  ]
}`;

  let usedModel = '';
  const raw = await aiGenerate(prompt, LESSON_SYSTEM_PROMPT, { temperature: 0.5, responseJson: true }, (model) => { usedModel = model; });
  const data = parseQuizJson(raw);
  return { text: buildQuizHtml(data), model: usedModel };
}

export async function generateLessonPlan(params: LessonParams): Promise<{ text: string; model: string }> {
  const gradeGuidance = getLessonGradeGuidance(params.grade);
  const prompt = `${getDateContext()}
다음 수업 정보를 바탕으로 상세한 수업 계획서를 HTML 형식으로 생성해주세요.

[수업 정보]
- 학년: ${params.grade}
- 교과: ${params.subject}
- 단원: ${params.unit}
- 주제/수업명: ${params.topic}
${params.details ? `- 추가 요청사항: ${params.details}` : ''}
${gradeGuidance ? `\n${gradeGuidance}\n` : ''}
[필수 구성 요소]
1. 수업 개요 (학년, 교과, 단원, 주제, 차시)
2. 학습 목표 (지식, 기능, 태도 영역)
3. 교수·학습 과정안 (도입-전개-정리 단계별 표로 작성)
   - 단계, 학습활동, 교수·학습 활동, 시간(분), 자료/유의점 포함
4. 평가 계획 (평가 기준, 방법)
5. 준비물 및 참고자료

수업 개요, 학습 목표, 교수·학습 과정안, 평가 계획, 준비물 및 참고자료는 모두 표 형태로 작성하세요.
긴 문단 설명보다 한눈에 보기 쉬운 표를 우선 사용하세요.
본문에는 이모지, Markdown 기호, 장식용 특수기호를 넣지 말고 실제 수업 계획서 문체로 작성하세요.

반드시 완전한 HTML 문서로 응답하세요. <!DOCTYPE html>부터 </html>까지 포함하세요.
<style> 태그에 다음 CSS를 반드시 포함하세요:
@page { size: A4; margin: 20mm 15mm; }
body { font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; font-size: 10.5pt; color: #000; margin: 0; padding: 0; }
table { width: 100%; border-collapse: collapse; page-break-inside: avoid; }
th, td { border: 1pt solid #333; padding: 5pt 8pt; }
section, .section, tr, h2, h3 { page-break-inside: avoid; }
h1, h2, h3 { page-break-after: avoid; }
또한 모든 <table> 태그에 style="border-collapse:collapse;width:100%;" 속성을, 모든 <th>와 <td>에 style="border:1pt solid #333;padding:5pt 8pt;" 속성을 반드시 추가하세요.
마크다운 코드블록 없이 HTML 코드만 응답하세요.`;

  let usedModel = '';
  const raw = await aiGenerate(prompt, LESSON_SYSTEM_PROMPT, { temperature: 0.4 }, (model) => { usedModel = model; });
  return { text: stripGeneratedCodeFences(raw), model: usedModel };
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildFallbackLessonGame = (params: LessonParams): string => {
  const title = escapeHtml(params.topic || params.unit || '수업 미션');
  const subject = escapeHtml(params.subject || '교과');
  const grade = escapeHtml(params.grade || '학생');
  const items = [
    params.topic || '오늘의 핵심 개념',
    params.unit || '단원 핵심',
    params.subject || '교과 개념',
    '핵심 용어',
    '수업 미션',
    '정리 문제',
  ].filter(Boolean).slice(0, 6);
  const missions = JSON.stringify(items.map((item, index) => ({
    q: `${item}와 관련해 가장 알맞은 설명을 고르세요.`,
    a: `${item}의 핵심을 확인함`,
    choices: [
      `${item}의 핵심을 확인함`,
      '수업 내용과 관계없는 설명을 고름',
      '근거 없이 추측함',
      '문제를 건너뜀',
    ].sort(() => index % 2 ? 1 : -1),
  })));

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} 퀘스트</title>
<style>
body{margin:0;font-family:'Malgun Gothic',Arial,sans-serif;background:linear-gradient(135deg,#0ea5e9,#f59e0b);color:#111827;min-height:100vh;display:flex;align-items:center;justify-content:center}
.app{width:min(920px,94vw);background:#fff;border-radius:24px;box-shadow:0 24px 70px rgba(0,0,0,.25);overflow:hidden}
header{padding:28px;background:#111827;color:#fff}
h1{margin:0;font-size:32px} .meta{margin-top:8px;color:#cbd5e1;font-weight:700}
.screen{display:none;padding:28px}.screen.active{display:block}
button{border:0;border-radius:16px;padding:14px 18px;font-weight:900;cursor:pointer}
#gameStartBtn,.primary{background:#f59e0b;color:#111827;font-size:20px;box-shadow:0 10px 24px rgba(245,158,11,.35)}
.choice{display:block;width:100%;text-align:left;margin:10px 0;background:#eef2ff;color:#1e1b4b}
.choice.correct{background:#bbf7d0}.choice.wrong{background:#fecaca}
.hud{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px}.badge{background:#f1f5f9;border-radius:999px;padding:8px 12px;font-weight:800}
.mission{font-size:22px;font-weight:900;margin:14px 0}.character{font-size:56px;line-height:1}.reward{font-size:18px;font-weight:900;color:#2563eb}
</style>
</head>
<body>
<div class="app">
  <header>
    <div class="character">GAME</div>
    <h1>${title} 퀘스트</h1>
    <div class="meta">${grade} · ${subject} · 퍼즐 미션형 게임</div>
  </header>
  <section id="startScreen" class="screen active">
    <p class="reward">미션을 해결해 별을 모으고 최종 레벨에 도전하세요.</p>
    <button id="gameStartBtn">게임 시작</button>
  </section>
  <section id="playScreen" class="screen">
    <div class="hud"><span class="badge" id="level">레벨 1</span><span class="badge" id="score">점수 0</span><span class="badge" id="stars">별 0</span></div>
    <div class="mission" id="question"></div>
    <div id="choices"></div>
    <button class="primary" id="nextBtn" style="display:none">다음 미션</button>
  </section>
  <section id="resultScreen" class="screen">
    <h2>미션 완료</h2>
    <p class="reward" id="finalText"></p>
    <button class="primary" id="retryBtn">다시 하기</button>
  </section>
</div>
<script>
document.addEventListener('DOMContentLoaded', function(){
  var missions = ${missions};
  var index = 0, score = 0, stars = 0, audioCtx = null;
  function $(id){ return document.getElementById(id); }
  function show(id){ ['startScreen','playScreen','resultScreen'].forEach(function(s){ $(s).classList.toggle('active', s===id); }); }
  function sound(type){
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.frequency.value = type === 'ok' ? 720 : type === 'done' ? 520 : 180;
      gain.gain.setValueAtTime(.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + .18);
      osc.start(); osc.stop(audioCtx.currentTime + .2);
    } catch(e) {}
  }
  function render(){
    var m = missions[index];
    $('level').textContent = '레벨 ' + (index + 1);
    $('score').textContent = '점수 ' + score;
    $('stars').textContent = '별 ' + stars;
    $('question').textContent = m.q;
    $('choices').innerHTML = '';
    $('nextBtn').style.display = 'none';
    m.choices.forEach(function(choice){
      var btn = document.createElement('button');
      btn.className = 'choice';
      btn.textContent = choice;
      btn.addEventListener('click', function(){
        var ok = choice === m.a;
        btn.classList.add(ok ? 'correct' : 'wrong');
        score += ok ? 10 : 0;
        stars += ok ? 1 : 0;
        sound(ok ? 'ok' : 'no');
        document.querySelectorAll('.choice').forEach(function(b){ b.disabled = true; });
        $('score').textContent = '점수 ' + score;
        $('stars').textContent = '별 ' + stars;
        $('nextBtn').style.display = '';
      });
      $('choices').appendChild(btn);
    });
  }
  $('gameStartBtn').addEventListener('click', function(){ sound('ok'); index = 0; score = 0; stars = 0; show('playScreen'); render(); });
  $('nextBtn').addEventListener('click', function(){ index++; if(index >= missions.length){ sound('done'); $('finalText').textContent = '최종 점수 ' + score + '점, 별 ' + stars + '개를 획득했습니다.'; show('resultScreen'); } else render(); });
  $('retryBtn').addEventListener('click', function(){ index = 0; score = 0; stars = 0; show('startScreen'); });
});
</script>
</body>
</html>`;
};

export async function generateLessonGame(params: LessonParams): Promise<string> {
  const gradeGuidance = getLessonGradeGuidance(params.grade);
  const prompt = `다음 수업 주제를 바탕으로 학생들이 직접 플레이할 수 있는 교육용 미니 게임을 HTML 형식으로 만들어주세요.

[수업 정보]
- 학년: ${params.grade}
- 교과: ${params.subject}
- 단원: ${params.unit || ''}
- 주제/수업명: ${params.topic}
${params.details ? `- 추가 요청사항: ${params.details}` : ''}
${gradeGuidance ? `\n${gradeGuidance}\n` : ''}
[게임 요구사항]
- 게임 유형: 수업 주제와 학년에 가장 어울리는 형식을 아래 중 하나 이상 선택해 완성도 있게 만드세요.
  퍼즐형, 아케이드형, 롤플레이형, 미션 수행형, 카드/보드게임형, 타임어택형, 탐험/탈출형, 퀘스트형
- 학생들이 흥미를 느끼도록 목표, 보상, 레벨, 캐릭터, 미션, 즉각 피드백 중 3가지 이상을 자연스럽게 포함하세요.
- 게임 내용: 해당 수업의 핵심 개념·용어·사실을 바탕으로 8~15개 문항 또는 게임 요소를 만드세요
- 난이도: ${params.grade}에 맞게 설정하세요
- 시작 화면에는 반드시 실제로 동작하는 <button id="gameStartBtn">게임 시작</button> 요소를 넣고, document.getElementById('gameStartBtn').addEventListener('click', ...) 코드로 게임 본 화면을 열어야 합니다.
- 버튼 클릭 전까지 게임 본 화면은 숨기고, 클릭 후 시작 화면은 숨겨야 합니다.
- 버튼 클릭 처리는 addEventListener로 등록하고, inline onclick에만 의존하지 마세요.
- DOMContentLoaded 이후에 시작 버튼과 게임 버튼 이벤트를 등록하세요.
- 앱 내 iframe 미리보기에서 바로 실행되어야 하므로 window.open, location.href 같은 외부 이동 코드를 쓰지 마세요.
- meta Content-Security-Policy 태그를 넣지 마세요. 앱 미리보기에서 인라인 스크립트가 실행되어야 합니다.
- 정답, 오답, 레벨업, 게임 종료에 어울리는 짧은 사운드 효과를 Web Audio API로 구현하세요. 외부 오디오 파일이나 CDN은 사용하지 마세요.
- 사운드는 사용자가 시작 버튼을 누른 뒤 AudioContext를 생성하거나 resume하여 브라우저 자동재생 제한에 걸리지 않게 하세요.
- 타이머: 전체 또는 문항별 타이머를 포함하면 더욱 좋습니다
- 점수 시스템: 점수·콤보·별점 등 성취감을 줄 수 있는 시스템 포함
- 결과 화면: 최종 점수·소요 시간·"다시 하기" 버튼 포함
- 디자인: 학생들이 흥미를 느낄 수 있도록 밝고 컬러풀하게, 애니메이션 효과 포함
- 접근성: 마우스와 키보드 모두 사용 가능하도록 구현
- 화면에 보이는 문구에는 이모지, Markdown 기호, 장식용 특수기호를 넣지 마세요. 캐릭터나 보상은 색상, 도형, 레벨명, 배지 디자인으로 표현하세요.

반드시 완전한 HTML 문서로 응답하세요. <!DOCTYPE html>부터 </html>까지 포함하세요.
학생에게 그대로 배포할 수 있는 단일 HTML 파일이어야 하므로 인라인 CSS와 JavaScript로 모든 게임 로직을 구현하세요. 외부 라이브러리(CDN), 외부 이미지, 외부 폰트 없이 순수 HTML/CSS/JS만 사용하세요.
한국어 UI, 밝은 색상, 학생 친화적인 디자인으로 작성하세요.
마크다운 코드블록 없이 HTML 코드만 응답하세요.`;

  try {
    const html = stripGeneratedCodeFences(await aiGenerate(prompt, LESSON_SYSTEM_PROMPT, { temperature: 0.65 })).trim();
    if (!/<(?:!DOCTYPE|html|body|script)\b/i.test(html)) throw new Error('게임 HTML 형식이 아닙니다.');
    return html;
  } catch (error) {
    console.warn('Lesson game generation fallback:', error);
    return buildFallbackLessonGame(params);
  }
}

export const parseAnnualPlanFromImages = async (images: string[]): Promise<string> => {
  if (images.length === 0) return '';
  const prompt = `이 이미지들은 학교 생활기록부 기재를 위한 연간 지도 계획 또는 활동 계획표입니다.
이미지에 포함된 내용을 분석하여 월별/시기별 활동을 시간 순서대로 텍스트로 정리해주세요.
예시: - [3월]: 학급 임원 선출`;
  const parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> = [];
  images.forEach((base64) => parts.push({ inlineData: { mimeType: 'image/png', data: base64 } }));
  parts.push({ text: prompt });
  return await aiGenerateMultipart(parts, undefined, { temperature: 0.1 });
};

export const parseAnnualPlanFromDocuments = async (
  docs: Array<{ data: string; mimeType: string }>
): Promise<string> => {
  if (docs.length === 0) return '';
  const prompt = `이 문서들은 학교 생활기록부 기재를 위한 연간 지도 계획 또는 활동 계획표입니다.
문서에 포함된 내용을 분석하여 월별/시기별 활동을 시간 순서대로 텍스트로 정리해주세요.
예시: - [3월]: 학급 임원 선출`;
  const parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> = [];
  docs.forEach((doc) => parts.push({ inlineData: doc }));
  parts.push({ text: prompt });
  return await aiGenerateMultipart(parts, undefined, { temperature: 0.1 });
};

// ─── AI스킬즈 ──────────────────────────────────────────────────────

export const runCustomTool = async (
  tool: CustomTool,
  fieldValues: Record<string, string>,
  fileValues: Record<string, FileData[]>,
  onProgress?: (current: number, total: number) => void,
  signal?: AbortSignal,
  schoolLevel?: string,
): Promise<{ text: string; model: string }> => {
  const withTimeout = <T>(p: Promise<T>): Promise<T> => {
    let timer: ReturnType<typeof setTimeout>;
    let onAbort: (() => void) | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('요청 시간이 초과되었습니다. (90초) 다시 시도해 주세요.')), 90_000);
    });
    const abort = signal
      ? new Promise<never>((_, reject) => {
          if (signal.aborted) { reject(new Error('취소되었습니다.')); return; }
          onAbort = () => reject(new Error('취소되었습니다.'));
          signal.addEventListener('abort', onAbort, { once: true });
        })
      : null;
    // 승리 경로와 상관없이 타이머·리스너를 정리한다(누수 방지).
    return Promise.race([p, timeout, ...(abort ? [abort] : [])]).finally(() => {
      clearTimeout(timer);
      if (onAbort) signal?.removeEventListener('abort', onAbort);
    });
  };

  const schoolLevelCtx = schoolLevel ? `[대상 학교급: ${schoolLevel}]\n` : '';
  let basePrompt = `${getDateContext()}\n${schoolLevelCtx}${tool.promptTemplate}`;
  for (const [key, value] of Object.entries(fieldValues)) {
    basePrompt = basePrompt.replaceAll(`{{${key}}}`, value);
  }

  const allFiles = Object.values(fileValues).flat();
  let usedModel = '';
  const onModel = (model: string) => { usedModel = model; };

  if (allFiles.length > 0) {
    // 파일이 여러 개일 때 배치 크기(10)로 묶어 한 번에 전송 → 표 하나로 합산
    const BATCH = 10;
    const batches: FileData[][] = [];
    for (let i = 0; i < allFiles.length; i += BATCH) {
      batches.push(allFiles.slice(i, i + BATCH));
    }

    const batchResults: string[] = [];
    let processed = 0;
    for (const batch of batches) {
      if (signal?.aborted) throw new Error('취소되었습니다.');
      processed += batch.length;
      onProgress?.(processed, allFiles.length);
      const parts = [
        ...batch.map(f => ({ inlineData: { data: f.base64.split(',')[1], mimeType: f.mimeType } })),
        { text: basePrompt },
      ];
      batchResults.push(await withTimeout(aiGenerateMultipart(parts, '', { temperature: 0.8 }, onModel)));
    }

    if (batchResults.length === 1) return { text: batchResults[0], model: usedModel };

    // 배치가 2개 이상이면 최종 병합 호출
    if (signal?.aborted) throw new Error('취소되었습니다.');
    const mergePrompt = `다음 표들을 헤더 한 번, 중복 없이 하나의 표로 합쳐줘:\n\n${batchResults.join('\n\n---\n\n')}`;
    const merged = await withTimeout(aiGenerate(mergePrompt, '', { temperature: 0.3 }, onModel));
    return { text: merged, model: usedModel };
  }

  const text = await withTimeout(aiGenerate(basePrompt, '', { temperature: 0.8 }, onModel));
  return { text, model: usedModel };
};

export const generateToolPrompt = async (
  description: string,
  inputs: CustomToolInput[],
  existingPrompt?: string,
  templateFile?: FileData | null,
): Promise<string> => {
  const fieldList = inputs
    .map(i => `- {{${i.id}}} : ${i.label} (${i.type === 'file-upload' ? '파일 첨부' : i.type === 'textarea' ? '여러 줄 텍스트' : '한 줄 텍스트'})`)
    .join('\n');
  const templateNote = templateFile
    ? '\n- 첨부된 양식 파일을 분석하여, 출력 결과가 이 양식의 형식과 구조를 따르도록 프롬프트에 명시해줘'
    : '';

  const prompt = existingPrompt?.trim()
    ? `교사가 사용할 AI 도구의 프롬프트 템플릿을 개선해줘.
도구 설명: ${description}
사용 가능한 변수:
${fieldList}

기존 프롬프트:
${existingPrompt}

개선 방향:
- 먼저 도구 설명, 변수명, 기존 프롬프트를 종합해 이 도구의 실제 의도와 결과물 장르를 파악해줘.
- 파악한 의도와 장르 안에서만 지시를 더 구체적이고 명확하게 보완해줘.
- 기존 프롬프트가 일기 분석, 감상문 피드백, 상담 기록, 문서 요약, 공문서 작성, 수업자료 제작 등 어떤 작업을 요구하는지 구분하고, 다른 장르로 바꾸지 마.
- 예를 들어 일기 분석 도구를 공문서/계획서/보고서 형식으로 바꾸거나, 상담 기록 도구를 세특 작성 도구로 바꾸는 식의 전환은 금지해.
- 기존 프롬프트에 명시된 출력 형식이 있으면 그 형식을 보존하고 더 선명하게 다듬어줘. 형식이 불명확할 때만 도구 의도에 맞는 자연스러운 형식을 제안해줘.
- 교육 현장에 맞는 어조와 표현을 사용하되, 도구 목적과 맞지 않는 공문서체·생기부체·보고서체를 억지로 적용하지 마.
- 기존 변수({{변수명}})는 그대로 유지하고, 필요하면 추가해줘${templateNote}
결과물은 개선된 프롬프트 텍스트만 출력해.`
    : `교사가 사용할 AI 도구의 프롬프트 템플릿을 작성해줘.
도구 설명: ${description}
사용 가능한 변수:
${fieldList}${templateNote}
작성 방향:
- 도구 설명과 변수명을 바탕으로 이 도구의 실제 의도와 결과물 장르를 먼저 파악해.
- 파악한 의도에 맞는 프롬프트만 작성하고, 다른 장르로 임의 전환하지 마.
- 일기 분석, 감상문 피드백, 상담 기록, 문서 요약, 공문서 작성, 수업자료 제작, 학생 기록 작성 등 서로 다른 작업을 혼동하지 마.
- 도구 목적에 맞는 출력 형식과 어조를 지정하되, 목적과 맞지 않는 공문서체·생기부체·보고서체를 억지로 적용하지 마.
- 변수는 반드시 {{변수명}} 형태로 삽입하고, 결과물은 프롬프트 텍스트만 출력해.`;

  if (templateFile) {
    const parts = [
      { inlineData: { data: templateFile.base64.split(',')[1], mimeType: templateFile.mimeType } },
      { text: prompt },
    ];
    return await aiGenerateMultipart(parts, '', { temperature: 0.7 });
  }
  return await aiGenerate(prompt, '', { temperature: 0.7 });
};

// 대화 내용으로 AI 스킬을 설계한다. includeAppSpec이 true면 같은 주제를
// HTML 앱으로 구현할 때의 상세 요구사항(appSpec)도 함께 설계해 돌려준다.
export const generateToolFromChat = async (
  chatHistory: { role: 'ai' | 'user'; text: string }[],
  templateFile?: FileData | null,
  includeAppSpec = false,
): Promise<(Omit<CustomTool, 'id' | 'createdAt' | 'updatedAt'> & { appSpec?: string }) | null> => {
  const conversation = chatHistory.map(m => `${m.role === 'ai' ? 'AI' : '교사'}: ${m.text}`).join('\n');
  const templateNote = templateFile
    ? '\n첨부된 양식 파일을 분석하여, promptTemplate에 양식의 구조(항목 구성·표 형식·문체)를 따라 출력하라는 지시를 구체적으로 명시해줘.'
    : '';
  const appSpecLine = includeAppSpec
    ? '\n  "appSpec": "이 도구를 단일 HTML 웹앱으로 구현할 때의 요구사항을 한국어 5~10문장으로 구체적으로 서술 (화면 구성, 핵심 기능, 사용자 조작 흐름, 디자인 톤)",'
    : '';
  const prompt = `다음 대화를 바탕으로 교사용 AI 도구를 JSON으로 설계해줘.
대화:
${conversation}
${templateNote}
아래 형식으로만 출력해 (JSON만, 설명 없이):
{
  "name": "도구 이름 (간결하게)",
  "description": "어떤 입력을 받아 무엇을 만들어 주는지 한 문장 요약",
  "category": "admin",${appSpecLine}
  "inputs": [{ "id": "field_0", "label": "...", "type": "text", "placeholder": "...", "required": true }],
  "promptTemplate": "..."
}
[설계 규칙]
- category는 admin(교무 행정)/lesson(수업 자료)/student(학생 기록)/other 중 대화 주제에 맞는 것 하나.
- inputs: 대화에서 언급된 입력 정보를 빠짐없이 필드로 만들고, id는 field_0부터 순서대로 붙여. 긴 글 입력은 type을 "textarea", 파일 첨부는 "file-upload", 짧은 값은 "text"로. 입력이 필요 없다고 했으면 빈 배열 [].
- promptTemplate: AI에게 보낼 완성형 지시문. 역할(예: 당신은 학교 업무에 능숙한 교사입니다), 작업 내용, 출력 형식(항목 구성·표 사용 여부·문체)을 대화에서 파악한 대로 충실히 담아 작성해.
- promptTemplate 안에서 각 입력값을 반드시 {{field_0}}, {{field_1}} 형태의 자리표시자로 모두 참조해야 해. (file-upload 필드는 제외 — 파일은 자동으로 첨부됨)`;
  try {
    let raw: string;
    if (templateFile) {
      const parts = [
        { inlineData: { data: templateFile.base64.split(',')[1], mimeType: templateFile.mimeType } },
        { text: prompt },
      ];
      raw = await aiGenerateMultipart(parts, '', { temperature: 0.3, responseJson: true });
    } else {
      raw = await aiGenerate(prompt, '', { temperature: 0.3, responseJson: true });
    }
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
};

export const generateHtmlApp = async (
  description: string,
  signal?: AbortSignal,
): Promise<{ text: string; model: string }> => {
  const prompt = `교사가 교실에서 사용할 수 있는 인터랙티브 HTML 앱을 만들어줘.

요청: ${description}

[필수 조건 — 반드시 지킬 것]
1. 완전한 단일 HTML 파일로 출력. <!DOCTYPE html>부터 </html>까지 하나의 파일에 모두 포함
2. 외부 CDN·외부 폰트·외부 이미지 URL 절대 사용 금지 (Vue/React/Chart.js 등 모든 외부 라이브러리 포함). 모든 CSS는 <style>, 모든 JS는 <script> 태그에 인라인으로 작성
3. <script type="module"> 사용 금지 (ES 모듈 import 문 금지). 일반 <script> 태그만 사용
4. localStorage, sessionStorage, document.cookie 사용 금지. 앱 상태는 JavaScript 변수/객체에만 저장
5. window.open() 사용 금지
6. 사운드 효과가 필요하면 Web Audio API (AudioContext)만 사용. base64 오디오·외부 오디오 파일·<audio src="..."> 절대 사용 금지
7. AudioContext는 반드시 사용자 클릭 이벤트 핸들러 안에서 생성 또는 resume() 후 사용 (자동재생 정책 우회)
8. 한국어 UI, 반응형 디자인 (모바일·PC 모두 동작)
9. HTML 코드만 출력 (마크다운 코드블록·설명 없이)`;

  let onAbort: (() => void) | undefined;
  const abortPromise = signal
    ? new Promise<never>((_, reject) => {
        if (signal.aborted) { reject(new Error('취소되었습니다.')); return; }
        onAbort = () => reject(new Error('취소되었습니다.'));
        signal.addEventListener('abort', onAbort, { once: true });
      })
    : null;

  let usedModel = '';
  const generatePromise = aiGenerate(prompt, '', { temperature: 0.7 }, (model) => { usedModel = model; });
  try {
    const raw = abortPromise
      ? await Promise.race([generatePromise, abortPromise])
      : await generatePromise;
    return { text: raw.replace(/^```html\n?/i, '').replace(/\n?```\s*$/, '').trim(), model: usedModel };
  } finally {
    if (onAbort) signal?.removeEventListener('abort', onAbort);
  }
};

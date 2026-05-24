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
} from '../types';
import { GUIDELINE_CONTEXT, GENERATION_EXAMPLES, SYSTEM_INSTRUCTION, SUBJECT_LIST } from '../constants';

// ─── IPC Helper ───────────────────────────────────────────────────

const aiGenerate = (prompt: string, systemInstruction?: string, options?: { temperature?: number }) =>
  window.electronAPI.aiGenerate(prompt, systemInstruction, options);

const aiGenerateMultipart = (
  parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }>,
  systemInstruction?: string,
  options?: { temperature?: number },
) => window.electronAPI.aiGenerateMultipart(parts, systemInstruction, options);

const fileToPart = (fileData: FileData) => ({
  inlineData: {
    data: fileData.base64.split(',')[1],
    mimeType: fileData.mimeType,
  },
});

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

const QA_SYSTEM_PROMPT = (schoolLevel: SchoolLevel) => `
당신은 대한민국 ${schoolLevel} 학교생활기록부 기재요령 전문가이자 진학지도 컨설턴트입니다.
제공된 '2026학년도 학교생활기록부 기재요령'과 '2028 대입 개편안' 지침을 기반으로 사용자의 질문에 전문적으로 답변해야 합니다.

[답변 원칙]
1. 최신성: 2026학년도부터 적용되는 고교학점제(1, 2학년) 및 5등급 성적 산출 체계를 정확히 반영하세요.
2. 구체성: 입시 현장에서 선생님들이 즉각 활용할 수 있도록 법적 근거와 구체적인 기재 팁을 함께 제공하세요.
3. 출처 명시: 답변 끝에 근거가 되는 파일명과 페이지 정보를 반드시 포함하세요.
4. 전문 용어: 수행평가, 과정중심 평가, 성취도별 분포비율, 고교학점제 등 전문 교육 용어를 적절히 사용하세요.

[기재요령 핵심 컨텍스트]
${GUIDELINE_CONTEXT}
`;

const RECORD_CHATBOT_SYSTEM_PROMPT = (schoolLevel: SchoolLevel) => `
당신은 대한민국 ${schoolLevel} 교사를 돕는 학교생활기록부 전문 AI 도우미입니다.
2026학년도 학교생활기록부 기재요령 및 최신 대입 평가 기준을 바탕으로 실용적인 도움을 제공합니다.

[대화 스타일]
- 친근하고 실용적인 어조로 대화하세요.
- 질문의 맥락에 맞춰 구체적인 예시와 팁을 제공하세요.
- 문구 예시 요청 시 입학사정관이 4~5점을 주는 '가점 구조'로 작성해 주세요.
- 부정확한 정보는 제공하지 말고, 확인이 필요한 경우 솔직하게 안내하세요.

[학교급 컨텍스트: ${schoolLevel}]
${getDevelopmentalGuidance(schoolLevel)}

${EVALUATION_FRAMEWORK_2026}

[기재요령 핵심 컨텍스트]
${GUIDELINE_CONTEXT}
`;

const OPINION_GENERATOR_SYSTEM_PROMPT = (schoolLevel: SchoolLevel) => `
당신은 ${schoolLevel} 교사가 학생의 '행동특성 및 종합의견'을 작성하는 것을 돕는 보조자입니다.
제공된 긍정적 특성과 보완이 필요한 특성을 바탕으로 작성하되,
입학사정관이 실제로 높이 평가하는 '공동체역량과 사고 과정이 드러나는 문장'으로 구성하세요.
단순 태도·성격 묘사(감점)가 아닌, 구체적 행동→과정→역할 구조화(가점)로 서술해야 합니다.

${getDevelopmentalGuidance(schoolLevel)}

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
   - **주어 없음**: 문장에서 '학생은', 'OO이는' 등의 주어를 생략하고 철저히 관찰자 시점에서 서술하세요.
   - **문체 및 종결**: 문장은 반드시 '~임', '~함' 등 명사형 종결 어미(보고서체)로 끝맺고, 마지막에는 무조건 온점(.)을 찍으세요.
   - **구성**: 여러 문장으로 구성된 하나의 문단으로 작성하세요.

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

[입시 우수 기재 사례 분석]
${GENERATION_EXAMPLES.SUBJECT[schoolLevel]}

[필수 작성 규칙]
- 주어 생략, 명사형 종결어미(~함, ~임), 마지막 온점 필수
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

[2026 스포츠클럽 평가 기준 — 공동체역량 중심]
- 낮은 평가: "열심히 참여함", "팀워크가 좋음", "기술이 향상됨"
- 높은 평가: 역할 분담 과정에서 드러난 리더십, 갈등 상황 해결 방식, 반복 훈련을 통한 전략적 사고, 팀 목표 달성을 위한 자기 역할 조정 과정

[기재요령 참고 우수 예시]
${GENERATION_EXAMPLES.SPORTS[schoolLevel]}

[필수 규칙]
- 주어 생략, 명사형 종결어미(~함, ~임), 마지막 온점 필수
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

[기재요령 참고 우수 예시]
${GENERATION_EXAMPLES.CREATIVE[schoolLevel]}

[필수 작성 규칙]
1. 주어 없음, 명사형 종결어미(~함, ~임, ~됨), 마지막 온점 필수
2. '~였음', '~했음', '~하였음' 등 어색한 과거형 절대 금지
3. 따옴표(', ") 절대 금지
4. 단순 활동 나열 지양 → 활동 속 사고 과정과 탐구 흐름에 초점
`;

const EDUCATION_QA_SYSTEM_PROMPT = `
당신은 대한민국 학교 현장의 교육 전반에 관해 도움을 주는 전문 AI 도우미입니다.
교육 정책, 교수법, 학급 경영, 학생 상담, 행정 업무 등 교사들이 실무에서 마주치는 다양한 질문에 친절하고 실용적으로 답변하세요.
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

export const askGuidelineQuestion = async (schoolLevel: SchoolLevel, question: string): Promise<string> => {
  try {
    return await aiGenerate(question, QA_SYSTEM_PROMPT(schoolLevel), { temperature: 0.3 });
  } catch (error: any) {
    console.error('Gemini QA Error:', error);
    return '⚠️ [사용량 초과] 현재 이용자가 많아 AI 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.';
  }
};

export const askRecordChatbot = async (
  schoolLevel: SchoolLevel,
  history: Array<{ role: 'user' | 'model'; text: string }>,
  question: string,
): Promise<string> => {
  try {
    const historyText = history
      .map((m) => `[${m.role === 'user' ? '교사' : 'AI'}]: ${m.text}`)
      .join('\n');
    const fullPrompt = historyText ? `${historyText}\n[교사]: ${question}` : question;
    return await aiGenerate(fullPrompt, RECORD_CHATBOT_SYSTEM_PROMPT(schoolLevel), { temperature: 0.7 });
  } catch (error: any) {
    console.error('Record Chatbot Error:', error);
    return '⚠️ AI 응답 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
  }
};

export const generateOpinion = async (request: GenerationRequest): Promise<string> => {
  try {
    const positiveStr = request.positiveTags.length > 0 ? request.positiveTags.join(', ') : '특별히 지정되지 않음';
    const negativeStr = request.negativeTags.length > 0 ? request.negativeTags.join(', ') : '특별히 지정되지 않음';
    const lengthInstruction = getLengthInstruction(request.lengthOption, request.customLength, request.lengthUnit);
    const avoidInstruction =
      request.avoidPhrases && request.avoidPhrases.length > 0
        ? `\n[주의 - 절대 사용 금지 문구]: 다음 문장이나 표현은 이미 사용되었으므로 절대 똑같이 작성하지 마세요. 문장 구조와 단어를 완전히 다르게 바꾸세요: "${request.avoidPhrases.join('", "')}"`
        : '';

    const prompt = `
다음 학생의 '행동특성 및 종합의견'을 작성해줘.

[학생 정보 - 이름: ${request.studentName}] (이름은 참고만 하고 본문에는 절대 쓰지 말 것)
[긍정적 특성]: ${positiveStr}
[보완할 점]: ${negativeStr}
[추가 참고사항]: ${request.additionalContext}

[작성 길이]: ${lengthInstruction}

[요구사항]
1. 주어(학생 이름, '학생은' 등)를 절대 사용하지 마세요.
2. 문장은 반드시 '~임', '~함'으로 끝내고, 반드시 온점(.)을 찍으세요.
3. 금지어(대회, 수상, 자격증, 모의고사 등)를 절대 포함하지 마세요.
4. 따옴표(', ")나 특수기호를 절대 쓰지 마세요.
5. 하나의 문단으로 작성하세요.
6. 오직 결과 텍스트만 출력하세요.
7. 작성 길이를 엄격히 준수하세요.
8. 문장의 시작을 다양하게 하세요.
${avoidInstruction}`;

    return await aiGenerate(prompt, OPINION_GENERATOR_SYSTEM_PROMPT(request.schoolLevel), {
      temperature: 0.85,
    });
  } catch (error: any) {
    console.error('Gemini Generator Error:', error);
    return '⚠️ [사용량 알림] 현재 AI 생성량이 많아 잠시 지연되었습니다. 내용을 백업하시고 1분 후 다시 시도해주세요.';
  }
};

export const generateSubjectReport = async (request: SubjectGenerationRequest): Promise<string> => {
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
다음 정보를 바탕으로 학교생활기록부 '교과학습발달상황 세부능력 및 특기사항'을 작성해줘.

[학생 정보 - 이름: ${request.studentName}] (이름은 참고만 하고 본문에는 절대 쓰지 말 것)
[학교급]: ${request.schoolLevel}
[교과목]: ${request.subject}

[수행한 평가 과제 및 성취수준]:
${tasksText}

[추가 관찰내용]: ${request.additionalContext}

[작성 길이]: ${lengthInstruction}

[요구사항]
1. 주어 절대 금지. 2. 과제명 직접 언급 금지. 3. [동기→수행→결과→성장] 흐름.
4. 명사형 종결어미 + 온점 필수. 5. 따옴표/특수기호 금지. 6. 결과 텍스트만 출력.
7. 작성 길이 엄수. 8. 문장 시작 다양화. 9. '중'/'하' 수준 과제에 과장 표현 금지.
${avoidInstruction}`;

    return await aiGenerate(prompt, SUBJECT_GENERATOR_SYSTEM_PROMPT(request.schoolLevel), {
      temperature: 0.9,
    });
  } catch (error: any) {
    console.error('Subject Generator Error:', error);
    return '⚠️ [사용량 알림] AI 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
  }
};

export const generateSportsClubReport = async (request: SportsGenerationRequest): Promise<string> => {
  try {
    const lengthInstruction = getLengthInstruction(request.lengthOption, request.customLength, request.lengthUnit);
    const avoidInstruction =
      request.avoidPhrases && request.avoidPhrases.length > 0
        ? `\n[주의 - 절대 사용 금지 문구]: "${request.avoidPhrases.join('", "')}"`
        : '';

    const prompt = `
다음 정보를 바탕으로 학교생활기록부 '학교스포츠클럽 특기사항'을 작성해줘.

[학생 정보 - 이름: ${request.studentName}] (이름은 참고만 하고 본문에는 절대 쓰지 말 것)
[학교급]: ${request.schoolLevel}
[종목]: ${request.sportName}
[클럽명]: ${request.clubName}

[개별 활동 내용 및 태도]: ${request.additionalContext}

[작성 길이]: ${lengthInstruction}

[요구사항]
1. 주어 절대 금지. 2. 스포츠맨십, 협동심, 기술 향상 등이 드러나게 작성.
3. 명사형 종결어미 + 온점 필수. 4. 따옴표/특수기호 금지. 5. 결과 텍스트만 출력.
6. 작성 길이 엄수. 7. 문장 시작 다양화.
${avoidInstruction}`;

    return await aiGenerate(prompt, SPORTS_GENERATOR_SYSTEM_PROMPT(request.schoolLevel), {
      temperature: 0.9,
    });
  } catch (error: any) {
    console.error('Sports Generator Error:', error);
    return '⚠️ [사용량 알림] AI 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
  }
};

export const generateCreativeActivityReport = async (
  request: CreativeActivityGenerationRequest,
): Promise<string> => {
  try {
    const lengthInstruction = getLengthInstruction(request.lengthOption, request.customLength, request.lengthUnit);
    const keywordsStr = request.keywords.length > 0 ? request.keywords.join(', ') : '없음';
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

    const prompt = `
다음 정보를 바탕으로 학교생활기록부 '창의적 체험활동 특기사항'을 작성해줘.

[학생 정보 - 이름: ${request.studentName}] (이름은 참고만 하고 본문에는 절대 쓰지 말 것)
[학교급]: ${request.schoolLevel}
[활동명]: ${request.activityName}
[활동 유형]: ${request.activityType}

[연간 지도 계획(공통)]: ${request.annualPlan}

[개별 관찰 내용 및 역할]: ${request.additionalContext}
[주요 활동 키워드]: ${keywordsStr}

[작성 길이]: ${lengthInstruction}

[요구사항]
1. 주어 절대 금지. 2. 명사형 종결어미 + 온점 필수.
3. '~였음', '~하였음' 등 어색한 과거형 금지 → '~함', '~보임', '~나타냄' 사용.
4. 따옴표(', ") 절대 금지. 5. 결과 텍스트만 출력. 6. 작성 길이 엄수.
7. 단순 활동 나열 지양 → 학생의 구체적인 변화와 성장에 초점.
${leadershipInstruction}
${avoidInstruction}`;

    return await aiGenerate(prompt, CREATIVE_ACTIVITY_SYSTEM_PROMPT(request.schoolLevel), {
      temperature: 0.9,
    });
  } catch (error: any) {
    console.error('Creative Activity Generator Error:', error);
    return '⚠️ [사용량 알림] AI 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
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
): Promise<string> => {
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
[항목 기호 준수사항]
본문의 대항목(1., 2. ...) 하위 내용은 무조건 '가., 나.' -> '1), 2)' -> '가), 나)' 순서의 단계별 기호와 들여쓰기를 사용해야 합니다.
- OOOO (X) -> 1. OOOO (O)
- - OOO (X) -> 가. OOO (O)`;

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
        complexityInstruction = `[작성 모드: 상세] 구성: 1.관련, 2.본문, 개요, 행정사항(표 포함), 붙임.`;
        outputExample = `1. 관련: ...<br>2. 위 호와 관련하여 ... 다음과 같이 실시합니다.<br><br>가.일시: ... 나.장소: ... 다.대상: ... 라.주요내용: ... 마.행정사항(표)<br><br>${attachmentText || '붙임 &nbsp;운영 계획서 1부. &nbsp;끝.'}`;
      }

      specificInstruction = `
작업: [교육행정 공문서(겉공문) 표지 작성]
${complexityInstruction}
[공통 작성 규칙]
1. 글자 색상: 무조건 검정색(#000000)만 사용.
2. 발신 명의 제외.
3. 마무리: '붙임' 표시 후 "끝."으로 마무리.
4. 항목 기호: ${numberingReinforcement}
[출력 예시]
<div>수신 &nbsp;${isInternal ? '(내부결재)' : '수신자 참조'}<br>(경유)<br>제목 &nbsp;<strong>(제목)</strong><br><br>${outputExample}</div>`;
      break;
    }

    case DocType.PLAN:
      specificInstruction = `
작업: [세부 운영 계획서 작성]
[필수 구성] 1.추진배경 2.목적 3.운영방침 4.세부추진계획 5.소요예산(표) 6.기대효과
[작성 규칙] 항목 기호 준수, 소요예산은 표(Table)로 작성, 제목 아래 창의적인 부제 포함.`;
      break;

    case DocType.REPORT:
      specificInstruction = `
작업: [결과 보고서 작성]
[필수 구성] 1.추진배경 2.목적 3.운영방침 4.세부추진계획(결과) 5.소요예산 정산(표) 6.기대효과(성과)
[작성 규칙] 계획서와 동일한 항목 기호 사용, 예산 정산은 [계획액|집행액|잔액] 표로 작성.`;
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
${isReplyMode ? '[형식] 받은 메시지 내용을 인지하고 자연스럽게 이어지는 답장 메시지만 출력. 받은 메시지 반복 금지.' : ''}`;
      break;
    }

    case DocType.PUMUI:
      specificInstruction = `
작업: [지출품의서 기안문 작성]
[공통 규칙] 항목기호(1.→가.→1)), 붙임 표시, 산출내역은 표(Table) 절대 금지 — 텍스트 한 줄로만.
[물품] 1.관련 → 2.본문(구입) → 가.내역 나.용도 다.소요예산 라.산출내역
[수당] 1.관련 → 2.본문(지급) → 가.지급대상 나.사업일시 다.소요예산 라.산출내역
[업무추진비] 1.관련 → 2.본문(실시) → 가.일시 나.장소 다.협의사항 라.참석자 마.소요예산 바.산출내역`;
      break;

    case DocType.MEETING_MINUTES:
      specificInstruction = `
작업: [협의회 회의록 작성]
[필수 구성] 제목(중앙, 크게), 학교명(우측 상단), 표(Table) 형태로:
1행: 일시 | 장소
2행: 출석위원 (colspan=3)
3행: 회의안건 (colspan=3)
4행: 회의내용(제목행)
5행~: 발언자 | 발언내용(colspan=3) — 발언자별로 나누어 작성
마지막 행: 서명란 (업무관리시스템 결재로 대신함)
표 스타일: border="1" style="border-collapse:collapse;width:100%;color:#000000;border:1px solid black;"`;
      break;

    case DocType.PROMOTION:
      specificInstruction = `
작업: [홍보자료 및 보도자료 작성]
[기본 구조] 제목, 본문(도입-전개-결론), 관계자 인터뷰 인용구 형식의 언론 보도자료.
[문체] 객관적 언론 보도용 문체(~했다, ~밝혔다).
[SNS 추가] 보도자료 아래에 [SNS 홍보용 요약]: 친근한 존댓말, 이모지, 해시태그(#) 3~5개.`;
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
- 항목 기호: ${numberingReinforcement}`;
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
    parts.push({ text: '--- 아래는 작성에 참고해야 할 참고/증빙 문서입니다. ---' });
    for (const f of files) parts.push(fileToPart(f));
  }

  const gonggoContext =
    docType === DocType.GONGGO && gonggoInputs
      ? `
[공고 정보]
- 공고 제목: ${gonggoInputs.title}
- 공고 번호: ${gonggoInputs.number || '제2026-001호 (임의 입력)'}
- 공고 내용: ${gonggoInputs.content}
- 접수 기간/마감: ${gonggoInputs.deadline}
- 문의처: ${gonggoInputs.contact}
- 추가 사항: ${gonggoInputs.extraInfo}`
      : '';

  parts.push({
    text: `${specificInstruction}\n${volumeInstruction}\n${commonContext}\n\n${templateInstruction}\n\n[입력 정보 및 요청사항]:\n${gonggoContext || promptContext}`,
  });

  try {
    return await aiGenerateMultipart(parts, SYSTEM_INSTRUCTION, { temperature: 0.3 });
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    throw new Error('AI 문서 생성 중 오류가 발생했습니다. (잠시 후 다시 시도해주세요)');
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
}): Promise<string> => {
  const prompt = `
교사가 직접 작성한 관찰 내용을 바탕으로 수업관찰기록 문서 작성을 보조해주세요.
교사의 관찰 내용이 최우선이며, AI는 문서 형식 정리와 표현 보완만 담당합니다.

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
4. 분량: A4 1~2장 내외.`;

  return await aiGenerate(
    prompt,
    '당신은 교사의 수업관찰기록 문서 작성을 보조하는 도우미입니다. 교사가 입력한 내용을 최우선으로 존중하고, 문서 형식 정리와 표현 다듬기만 담당하세요. 내용을 임의로 추가하거나 사실을 창작하지 마세요.',
    { temperature: 0.4 },
  );
};

export const generateCounselingLog = async (inputs: {
  date: string;
  counselingType: string;
  participants: string;
  studentName: string;
  counselingContent: string;
  followUpPlan: string;
}): Promise<string> => {
  const prompt = `
교사가 직접 기록한 상담 내용을 바탕으로 상담일지 문서 작성을 보조해주세요.
교사의 기록이 최우선이며, AI는 문서 형식 정리와 표현 보완만 담당합니다.

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
3. 각 항목은 개조식(~함., ~임., ~하기로 함.)으로 작성하세요.`;

  return await aiGenerate(
    prompt,
    '당신은 교사의 상담일지 문서 작성을 보조하는 도우미입니다. 교사가 입력한 내용을 최우선으로 존중하고, 문서 형식 정리와 표현 다듬기만 담당하세요. 내용을 임의로 추가하거나 사실을 창작하지 마세요.',
    { temperature: 0.4 },
  );
};

export const generateClassManagementLog = async (inputs: {
  week: string;
  dateRange: string;
  grade: string;
  keyActivities: string;
  studentIssues: string;
  teacherNotes: string;
}): Promise<string> => {
  const prompt = `
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

  return await aiGenerate(
    prompt,
    '당신은 담임교사의 학급경영일지 문서 작성을 보조하는 도우미입니다. 교사가 입력한 내용을 최우선으로 존중하고, 문서 형식 정리와 표현 다듬기만 담당하세요. 내용을 임의로 추가하거나 사실을 창작하지 마세요.',
    { temperature: 0.4 },
  );
};

export const askEducationQuestion = async (
  question: string,
  history: Array<{ role: 'user' | 'model'; text: string }>,
): Promise<string> => {
  try {
    const historyText = history
      .map((m) => `[${m.role === 'user' ? '교사' : 'AI'}]: ${m.text}`)
      .join('\n');
    const fullPrompt = historyText ? `${historyText}\n[교사]: ${question}` : question;
    return await aiGenerate(fullPrompt, EDUCATION_QA_SYSTEM_PROMPT, { temperature: 0.7 });
  } catch (error: any) {
    console.error('Education QA Error:', error);
    return '⚠️ AI 응답 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
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
  const text = await aiGenerateMultipart(parts, undefined, { temperature: 0.1 });
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
  const text = await aiGenerateMultipart(parts, undefined, { temperature: 0.1 });
  const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleanJson);
  return Array.isArray(parsed) ? parsed : [parsed];
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
학습자 수준에 적합한 어휘와 내용을 사용하고, 실제 수업 현장에서 바로 활용 가능하도록 구체적으로 작성하세요.`;

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

export async function generateLessonSlides(params: LessonParams, pageCount: number): Promise<LessonSlide[]> {
  const gradeGuidance = getLessonGradeGuidance(params.grade);
  const prompt = `다음 수업 정보를 바탕으로 프레젠테이션 슬라이드 ${pageCount}장을 생성해주세요.

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

반드시 아래 JSON 배열 형식으로만 응답하세요 (마크다운 코드블록 없이):
[{"page":1,"title":"슬라이드 제목","content":["내용1","내용2"],"notes":"교사 메모","imagePrompt":"educational image description in english, no text"}]`;

  const response = await aiGenerate(prompt, LESSON_SYSTEM_PROMPT, { temperature: 0.6 });
  const cleaned = response.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (!arrayMatch) throw new Error('슬라이드 JSON 파싱 실패: 올바른 배열 형식이 아닙니다.');
  const parsed = JSON.parse(arrayMatch[0]);
  return Array.isArray(parsed) && parsed.length > 0 ? parsed : (() => { throw new Error('슬라이드 생성 결과가 비어있습니다. 다시 시도해주세요.'); })();
}

export async function generateLessonWorksheet(
  params: LessonParams,
  worksheetType: 'activity' | 'assessment',
  questionCount: number,
  includeScore: boolean,
): Promise<string> {
  const typeLabel = worksheetType === 'activity' ? '워크시트' : '평가지';
  const baseFontSize = params.grade.includes('초등') ? '12pt' : params.grade.includes('중학') ? '11pt' : '10pt';
  const h1Size = params.grade.includes('초등') ? '15pt' : params.grade.includes('중학') ? '14pt' : '13pt';
  const h2Size = params.grade.includes('초등') ? '13pt' : params.grade.includes('중학') ? '12pt' : '11pt';
  const tableSize = params.grade.includes('초등') ? '11.5pt' : params.grade.includes('중학') ? '10.5pt' : '9.5pt';
  const gradeGuidance = getLessonGradeGuidance(params.grade);
  const prompt = `다음 수업 정보를 바탕으로 ${typeLabel}를 HTML 형식으로 생성해주세요.

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
- 반드시 A4 용지 1장에 모든 내용이 들어가도록 간결하고 컴팩트하게 구성하세요
- 각 활동은 핵심 내용만 최소한의 공간으로 구성하고, 답변 공간은 줄 1~3개로 제한하세요
- 제목, 이름/날짜 기입란, 활동별 구분선 포함

반드시 완전한 HTML 문서로 응답하세요. <!DOCTYPE html>부터 </html>까지 포함하세요.
<style> 태그에 다음 CSS를 반드시 포함하세요:
@page { size: A4; margin: 10mm 12mm; }
body { font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; font-size: ${baseFontSize}; color: #000; margin: 0; padding: 0; }
h1 { font-size: ${h1Size}; margin: 0 0 4pt; }
h2, h3 { font-size: ${h2Size}; margin: 6pt 0 3pt; page-break-after: avoid; }
.header-row { display: flex; gap: 16pt; margin-bottom: 6pt; font-size: ${baseFontSize}; }
.activity, section, .question { page-break-inside: avoid; margin-bottom: 8pt; }
.answer-lines { border-bottom: 1pt solid #999; min-height: 14pt; margin-top: 3pt; }
table { width: 100%; border-collapse: collapse; font-size: ${tableSize}; }
th, td { border: 0.8pt solid #444; padding: 3pt 5pt; }
p { margin: 2pt 0; line-height: 1.5; }
마크다운 코드블록 없이 HTML 코드만 응답하세요.`;

  return await aiGenerate(prompt, LESSON_SYSTEM_PROMPT, { temperature: 0.5 });
}

export async function generateLessonQuiz(params: LessonParams, questionCount: number): Promise<string> {
  const gradeGuidance = getLessonGradeGuidance(params.grade);
  const prompt = `다음 수업 정보를 바탕으로 인터랙티브 퀴즈를 HTML 형식으로 생성해주세요.

[수업 정보]
- 학년: ${params.grade}
- 교과: ${params.subject}
- 단원: ${params.unit}
- 주제/수업명: ${params.topic}
${params.details ? `- 추가 요청사항: ${params.details}` : ''}
${gradeGuidance ? `\n${gradeGuidance}\n` : ''}
[요구사항]
- 문항 수: ${questionCount}개 (4지선다형 또는 O/X 혼합)
- 각 문항에 정답 표시 기능 포함
- 학생이 답을 선택하면 정답/오답 표시
- 최종 점수 계산 기능 포함
- 모바일 친화적이고 시각적으로 매력적인 디자인

반드시 완전한 HTML 문서로 응답하세요. <!DOCTYPE html>부터 </html>까지 포함하세요.
인라인 CSS와 JavaScript로 인터랙티브 기능을 구현하세요.
한국어 폰트와 밝은 색상을 사용하여 학생들이 흥미를 가질 수 있는 디자인으로 작성하세요.
마크다운 코드블록 없이 HTML 코드만 응답하세요.`;

  return await aiGenerate(prompt, LESSON_SYSTEM_PROMPT, { temperature: 0.5 });
}

export async function generateLessonPlan(params: LessonParams): Promise<string> {
  const gradeGuidance = getLessonGradeGuidance(params.grade);
  const prompt = `다음 수업 정보를 바탕으로 상세한 수업 계획서를 HTML 형식으로 생성해주세요.

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

반드시 완전한 HTML 문서로 응답하세요. <!DOCTYPE html>부터 </html>까지 포함하세요.
<style> 태그에 다음 CSS를 반드시 포함하세요:
@page { size: A4; margin: 20mm 15mm; }
body { font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; font-size: 10.5pt; color: #000; margin: 0; padding: 0; }
table { width: 100%; border-collapse: collapse; page-break-inside: avoid; }
th, td { border: 1pt solid #333; padding: 5pt 8pt; }
section, .section, tr, h2, h3 { page-break-inside: avoid; }
h1, h2, h3 { page-break-after: avoid; }
마크다운 코드블록 없이 HTML 코드만 응답하세요.`;

  return await aiGenerate(prompt, LESSON_SYSTEM_PROMPT, { temperature: 0.4 });
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

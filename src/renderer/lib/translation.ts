import { stripGeneratedCodeFences } from './generatedContent';
import { sanitizeHtml } from './security';

// 다문화 가정에서 많이 쓰는 언어 목록 (가정통신문·메시지 번역, 간단 번역 공용)
export const TRANSLATION_LANGUAGES = [
  { code: 'en', label: '영어', native: 'English' },
  { code: 'zh', label: '중국어(간체)', native: '中文(简体)' },
  { code: 'ja', label: '일본어', native: '日本語' },
  { code: 'vi', label: '베트남어', native: 'Tiếng Việt' },
  { code: 'tl', label: '필리핀어(타갈로그)', native: 'Tagalog' },
  { code: 'ru', label: '러시아어', native: 'Русский' },
  { code: 'uz', label: '우즈베크어', native: 'Oʻzbekcha' },
  { code: 'mn', label: '몽골어', native: 'Монгол' },
  { code: 'th', label: '태국어', native: 'ไทย' },
  { code: 'km', label: '캄보디아어(크메르)', native: 'ខ្មែរ' },
  { code: 'id', label: '인도네시아어', native: 'Bahasa Indonesia' },
  { code: 'ne', label: '네팔어', native: 'नेपाली' },
  { code: 'my', label: '미얀마어', native: 'မြန်မာ' },
] as const;

export type TranslationLanguage = (typeof TRANSLATION_LANGUAGES)[number];

export function languageByCode(code: string): TranslationLanguage | undefined {
  return TRANSLATION_LANGUAGES.find(lang => lang.code === code);
}

// 한국 학교 문서에 흔한 표기를 도착 언어의 표기 관습으로 바꾸는 규칙.
// 다문화 가정 학부모가 날짜와 장소를 스스로 이해하고 실제로 찾아갈 수 있어야 하므로,
// 표기는 도착 언어로 바꾸되 학교·기관·지명처럼 현장에서 대조해야 하는 이름은
// 번역어 뒤에 원문 표기를 괄호로 병기한다. 외국어 → 한국어 방향에도 같은 규칙을 쓴다.
export const LOCALIZATION_RULES = [
  '- 날짜는 도착 언어의 표기 순서와 월·요일 이름으로 바꿉니다. 예: "2026. 4. 18.(토)" → 영어 "Saturday, April 18, 2026", 일본어 "2026年4月18日(土)".',
  '- 시간은 도착 언어에서 흔히 쓰는 형식으로 바꿉니다. 12시간제를 쓰는 언어는 오전·오후 표기로 바꾸고, 24시간제를 쓰는 언어는 그대로 둡니다. 예: "15:30 ~ 16:30" → 영어 "3:30 p.m. – 4:30 p.m.".',
  '- 기간과 기한(2박 3일, 2026. 4. 11.(금)까지)도 같은 기준으로 바꿉니다.',
  '- 기관명, 학교명, 부서명, 직위는 도착 언어로 옮기고 처음 나올 때만 괄호 안에 원문 표기를 함께 적습니다. 예: "충청북도교육청" → "Chungcheongbuk-do Office of Education (충청북도교육청)", "교감" → "Vice Principal (교감)".',
  '- 지명, 주소, 시설 이름도 같은 방식으로 옮기고 원문 표기를 괄호로 병기합니다. 읽는 사람이 표지판이나 지도에서 그대로 찾을 수 있어야 합니다.',
  '- 학년·반·학기, 명절, 화폐 단위처럼 한쪽 나라에만 있는 표기는 도착 언어에서 통하는 말로 풀어 씁니다. 예: "3학년 2반" → "Grade 3, Class 2", "추석" → "Chuseok (Korean Thanksgiving)", "5,000원" → "5,000 KRW".',
  '- 사람 이름, 전화번호, 이메일, 웹 주소, 금액·수량의 숫자 자체는 바꾸지 않습니다.',
  '- 원문에 없는 날짜·시간·장소를 만들지 말고 표기 방식만 바꿉니다.',
];

// HTML 문서를 구조를 유지한 채 번역한다 (가정통신문·메시지 출력물용).
export async function translateHtml(html: string, language: TranslationLanguage): Promise<string> {
  const prompt = [
    `다음 HTML 문서를 ${language.label}(${language.native})로 번역하세요.`,
    '규칙:',
    '- HTML 태그, 속성, 구조는 그대로 유지하고 텍스트만 번역합니다.',
    ...LOCALIZATION_RULES,
    '- 학부모 안내문에 맞는 정중한 문체를 사용합니다.',
    '- 설명 없이 번역된 HTML만 출력합니다.',
    '',
    html,
  ].join('\n');
  const { text: result } = await window.electronAPI.aiGenerate(prompt, undefined, { temperature: 0.2 });
  // 모델 출력이 그대로 미리보기·저장에 쓰이므로 스크립트 등 활성 콘텐츠를 제거한다.
  return sanitizeHtml(stripGeneratedCodeFences(result).trim());
}

// 평문을 번역한다 (간단 번역 도구용). targetLabel 예: '한국어', '러시아어(Русский)'
export async function translateText(text: string, targetLabel: string): Promise<string> {
  const prompt = [
    `다음 글을 ${targetLabel}로 번역하세요.`,
    '규칙:',
    '- 원문의 의미와 어조를 유지합니다.',
    ...LOCALIZATION_RULES,
    '- 설명이나 주석 없이 번역문만 출력합니다.',
    '',
    text,
  ].join('\n');
  const { text: result } = await window.electronAPI.aiGenerate(prompt, undefined, { temperature: 0.2 });
  return stripGeneratedCodeFences(result).trim();
}

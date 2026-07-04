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

// HTML 문서를 구조를 유지한 채 번역한다 (가정통신문·메시지 출력물용).
export async function translateHtml(html: string, language: TranslationLanguage): Promise<string> {
  const prompt = [
    `다음 HTML 문서를 ${language.label}(${language.native})로 번역하세요.`,
    '규칙:',
    '- HTML 태그, 속성, 구조는 그대로 유지하고 텍스트만 번역합니다.',
    '- 학교명, 사람 이름, 날짜, 숫자, 연락처는 번역하지 않고 그대로 둡니다.',
    '- 학부모 안내문에 맞는 정중한 문체를 사용합니다.',
    '- 설명 없이 번역된 HTML만 출력합니다.',
    '',
    html,
  ].join('\n');
  const result = await window.electronAPI.aiGenerate(prompt, undefined, { temperature: 0.2 });
  // 모델 출력이 그대로 미리보기·저장에 쓰이므로 스크립트 등 활성 콘텐츠를 제거한다.
  return sanitizeHtml(stripGeneratedCodeFences(result).trim());
}

// 평문을 번역한다 (간단 번역 도구용). targetLabel 예: '한국어', '러시아어(Русский)'
export async function translateText(text: string, targetLabel: string): Promise<string> {
  const prompt = [
    `다음 글을 ${targetLabel}로 번역하세요.`,
    '규칙:',
    '- 원문의 의미와 어조를 유지합니다.',
    '- 설명이나 주석 없이 번역문만 출력합니다.',
    '',
    text,
  ].join('\n');
  const result = await window.electronAPI.aiGenerate(prompt, undefined, { temperature: 0.2 });
  return stripGeneratedCodeFences(result).trim();
}

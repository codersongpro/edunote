import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  generateLessonPlan,
  generateLessonQuiz,
  generateLessonSlides,
  type LessonParams,
} from '../geminiService';

const aiGenerate = vi.fn();

const baseParams: LessonParams = {
  grade: '중학교 1학년',
  subject: '과학',
  unit: '생물의 다양성',
  topic: '생물 분류',
};

const latestPrompt = (): string => String(aiGenerate.mock.calls.at(-1)?.[0] ?? '');
const latestSystemPrompt = (): string => String(aiGenerate.mock.calls.at(-1)?.[1] ?? '');

beforeEach(() => {
  aiGenerate.mockReset();
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { aiGenerate },
  });
});

const generateSlidePrompt = async (params: LessonParams) => {
  aiGenerate.mockResolvedValueOnce({
    text: JSON.stringify([{ page: 1, title: '제목', content: ['핵심 개념', '확인 활동'], notes: '교사 설명' }]),
    model: 'gemini-test',
    fallbacks: [],
  });
  await generateLessonSlides(params, 1);
  return `${latestSystemPrompt()}\n${latestPrompt()}`;
};

describe('수업자료 공통 프롬프트', () => {
  it.each([
    ['초등학교 1학년', '생활 속 낱말과 짧고 구체적인 문장', '놀이·조작'],
    ['초등학교 6학년', '교과 기본 용어의 뜻을 풀어서 설명', '탐구·협력'],
    ['중학교 1학년', '교과 기본 용어와 기초 학술 언어', '근거를 들어 설명'],
    ['고등학교 1학년', '교과 전문 용어와 학술적·분석적 표현', '비판적 사고'],
  ])('%s 슬라이드는 학습자 수준만 안내하고 수량·시간 규칙을 중복하지 않는다', async (grade, vocabulary, method) => {
    const prompt = await generateSlidePrompt({ ...baseParams, grade });

    expect(prompt).toContain(vocabulary);
    expect(prompt).toContain(method);
    expect(prompt.match(/2~3개/g)).toHaveLength(1);
    expect(prompt).not.toMatch(/활동지 활동|3~4개|4~5개|40분 기준|45분 기준|50분 기준/);
  });

  it('선택한 성취기준의 코드와 원문을 별도 입력 블록에 그대로 둔다', async () => {
    const prompt = await generateSlidePrompt({
      ...baseParams,
      topic: '',
      details: '학생들이 직접 분류표를 만들게 해 주세요.',
      achievementStandard: {
        code: '[6과03-01]',
        text: '생물의 특징을 관찰하여 공통점과 차이점을 설명할 수 있다.',
      },
    });

    expect(prompt).toContain('[선택한 성취기준 — 코드와 원문을 그대로 유지]');
    expect(prompt).toContain('- 코드: [6과03-01]');
    expect(prompt).toContain('- 원문: 생물의 특징을 관찰하여 공통점과 차이점을 설명할 수 있다.');
    expect(prompt).toContain('- 주제/수업명: (미입력 — 선택한 성취기준 중심)');
    expect(prompt).toContain('- 추가 요청사항: 학생들이 직접 분류표를 만들게 해 주세요.');
    expect(prompt).toContain('주제와 성취기준이 충돌하면 억지로 연계하지 말고');
  });

  it('성취기준이 없으면 공식 코드나 원문을 만들어 내지 않게 한다', async () => {
    const prompt = await generateSlidePrompt(baseParams);

    expect(prompt).toContain('[선택한 성취기준]');
    expect(prompt).toContain('선택된 성취기준 없음');
    expect(prompt).toContain('공식 코드나 원문을 추정하거나 만들어 내지 마세요');
  });
});

describe('수업 계획서 시간과 목표 정합성', () => {
  it('사용자가 지정한 80분·2차시를 우선하고 단계 합계를 일치시킨다', async () => {
    aiGenerate.mockResolvedValueOnce({ text: '<!DOCTYPE html><html><body>계획</body></html>', model: 'gemini-test', fallbacks: [] });
    await generateLessonPlan({ ...baseParams, grade: '초등학교 1학년', details: '80분, 2차시 수업으로 구성' });
    const prompt = latestPrompt();

    expect(prompt).toContain('사용자가 명시한 총 수업 시간: 80분');
    expect(prompt).toContain('사용자가 명시한 차시 수: 2차시');
    expect(prompt).toContain('각 단계 시간의 합계는 반드시 80분');
    expect(prompt).not.toContain('40분 기준');
    expect(prompt).not.toContain('지식, 기능, 태도 영역');
    expect(prompt).toContain('성취기준 → 관찰 가능한 학습 목표 → 연습 활동 → 평가');
  });

  it('시간을 지정하지 않은 중학교 수업안에만 45분 기본값을 적용한다', async () => {
    aiGenerate.mockResolvedValueOnce({ text: '<!DOCTYPE html><html><body>계획</body></html>', model: 'gemini-test', fallbacks: [] });
    await generateLessonPlan(baseParams);

    expect(latestPrompt()).toContain('별도 시간 지정이 없으므로 총 45분을 기본값으로 사용');
  });
});

describe('수업 퀴즈 문항 정합성', () => {
  it('수업에서 다룬 개념과 단일 정답, 설명 가능한 오답을 요구한다', async () => {
    aiGenerate.mockResolvedValueOnce({
      text: JSON.stringify({
        title: '퀴즈',
        questions: [{
          type: 'multiple-choice',
          question: '척추동물은 어느 것인가?',
          options: ['개구리', '소나무', '버섯', '아메바'],
          answer: '개구리',
        }],
      }),
      model: 'gemini-test',
      fallbacks: [],
    });
    await generateLessonQuiz(baseParams, 1, ['MULTIPLE_CHOICE']);
    const prompt = latestPrompt();

    expect(prompt).toContain('수업에서 실제로 다룬 개념');
    expect(prompt).toContain('정답은 정확히 하나');
    expect(prompt).toContain('각 오답이 왜 틀렸는지 교사가 설명할 수');
  });
});

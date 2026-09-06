import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateLessonQuiz, generateLessonSlides, type LessonParams, type QuizType } from '../geminiService';

const aiGenerate = vi.fn();
const params: LessonParams = {
  grade: '중학교 1학년',
  subject: '과학',
  unit: '생물의 다양성',
  topic: '생물 분류',
};

beforeEach(() => {
  aiGenerate.mockReset();
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { aiGenerate },
  });
});

const slide = (page: number) => ({
  page,
  title: `${page}쪽`,
  content: ['핵심 개념', '확인 활동'],
  notes: '교사 설명',
});

const generateSlidesFrom = async (value: unknown, pageCount = 2) => {
  aiGenerate.mockResolvedValueOnce({ text: JSON.stringify(value), model: 'gemini-test', fallbacks: [] });
  return generateLessonSlides(params, pageCount);
};

const generateQuizFrom = async (value: unknown, questionCount: number, quizTypes: QuizType[]) => {
  aiGenerate.mockResolvedValueOnce({ text: JSON.stringify(value), model: 'gemini-test', fallbacks: [] });
  return generateLessonQuiz(params, questionCount, quizTypes);
};

describe('수업 슬라이드 응답 검증', () => {
  it('요청 장수와 페이지 순서, 필드 타입이 맞는 정상 응답을 반환한다', async () => {
    await expect(generateSlidesFrom([slide(1), slide(2)])).resolves.toEqual({
      slides: [slide(1), slide(2)],
      model: 'gemini-test',
    });
  });

  it('요청 장수보다 부족한 응답을 거부한다', async () => {
    await expect(generateSlidesFrom([slide(1)], 2)).rejects.toThrow('슬라이드');
  });

  it('content가 배열이 아닌 문자열이면 거부한다', async () => {
    await expect(generateSlidesFrom([{ ...slide(1), content: '핵심 개념' }], 1)).rejects.toThrow('슬라이드');
  });

  it('빈 제목이나 요청 순서와 다른 page를 거부한다', async () => {
    await expect(generateSlidesFrom([{ ...slide(1), title: '  ' }], 1)).rejects.toThrow('슬라이드');
    await expect(generateSlidesFrom([{ ...slide(1), page: 2 }], 1)).rejects.toThrow('슬라이드');
  });
});

describe('수업 퀴즈 응답 검증', () => {
  const mc = {
    type: 'multiple-choice',
    question: '척추동물은 어느 것인가?',
    options: ['개구리', '소나무', '버섯', '아메바'],
    answer: '개구리',
  };

  it('요청한 세 유형의 정상 문항을 채점 HTML로 만든다', async () => {
    const data = {
      title: '생물 분류 퀴즈',
      questions: [
        mc,
        { type: 'short-answer', question: '생물을 나누는 기준은?', answer: '공통 특징' },
        { type: 'ox', question: '개구리는 척추동물이다.', answer: 'O' },
      ],
    };
    const result = await generateQuizFrom(data, 3, ['MULTIPLE_CHOICE', 'SHORT_ANSWER', 'OX']);
    expect(result.model).toBe('gemini-test');
    expect(result.text).toContain('생물 분류 퀴즈');
    expect(result.text).toContain('"answer":"개구리"');
  });

  it('객관식 정답이 보기 밖에 있거나 보기 수가 4개가 아니면 거부한다', async () => {
    await expect(generateQuizFrom({
      title: '퀴즈',
      questions: [{ ...mc, answer: '고래' }],
    }, 1, ['MULTIPLE_CHOICE'])).rejects.toThrow('퀴즈');
    await expect(generateQuizFrom({
      title: '퀴즈',
      questions: [{ ...mc, options: ['개구리', '소나무'] }],
    }, 1, ['MULTIPLE_CHOICE'])).rejects.toThrow('퀴즈');
  });

  it('요청하지 않았거나 알 수 없는 유형을 거부한다', async () => {
    await expect(generateQuizFrom({
      title: '퀴즈',
      questions: [{ type: 'essay', question: '설명하시오.', answer: '' }],
    }, 1, ['SHORT_ANSWER'])).rejects.toThrow('퀴즈');
    await expect(generateQuizFrom({
      title: '퀴즈',
      questions: [{ type: 'ox', question: '참인가?', answer: 'O' }],
    }, 1, ['MULTIPLE_CHOICE'])).rejects.toThrow('퀴즈');
  });

  it('빈 문항과 요청 수보다 부족한 문항을 거부한다', async () => {
    await expect(generateQuizFrom({
      title: '퀴즈',
      questions: [{ type: 'short-answer', question: '  ', answer: '답' }],
    }, 1, ['SHORT_ANSWER'])).rejects.toThrow('퀴즈');
    await expect(generateQuizFrom({ title: '퀴즈', questions: [mc] }, 2, ['MULTIPLE_CHOICE'])).rejects.toThrow('퀴즈');
  });

  it('O/X 이외 정답과 잘린 JSON을 거부한다', async () => {
    await expect(generateQuizFrom({
      title: '퀴즈',
      questions: [{ type: 'ox', question: '참인가?', answer: '맞음' }],
    }, 1, ['OX'])).rejects.toThrow('퀴즈');
    aiGenerate.mockResolvedValueOnce({ text: '{"title":"퀴즈","questions":[', model: 'gemini-test', fallbacks: [] });
    await expect(generateLessonQuiz(params, 1, ['OX'])).rejects.toThrow('퀴즈');
  });
});

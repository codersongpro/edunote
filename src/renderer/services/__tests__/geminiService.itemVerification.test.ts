import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateLessonQuiz, generateLessonWorksheet, verifyLessonItems, type LessonParams } from '../geminiService';

const aiGenerate = vi.fn();
const params: LessonParams = { grade: '중학교 1학년', subject: '과학', unit: '광합성', topic: '광합성의 재료' };

beforeEach(() => {
  aiGenerate.mockReset();
  Object.defineProperty(window, 'electronAPI', { configurable: true, value: { aiGenerate } });
});

const reply = (value: unknown) => aiGenerate.mockResolvedValueOnce({ text: JSON.stringify(value), model: 'gemini-test', fallbacks: [] });

describe('문항 독립 풀이 검증', () => {
  const quiz = [
    { type: 'multiple-choice' as const, question: '광합성에 필요한 기체는?', options: ['산소', '이산화 탄소', '질소', '수소'], answer: '이산화 탄소' },
    { type: 'ox' as const, question: '광합성은 빛이 없어도 일어난다.', answer: 'X' },
    { type: 'short-answer' as const, question: '광합성이 일어나는 세포 기관은?', answer: '엽록체' },
    { type: 'multiple-choice' as const, question: '광합성 결과 나오는 것은?', options: ['녹말', '산소', '물', '질소'], answer: '녹말' },
  ];

  it('정답을 빼고 보내며, 번호로 답해도 보기와 맞춰 비교한다', async () => {
    reply([
      { no: 1, answer: '②', defensibleAnswers: 1, solvable: true, issues: [] },
      { no: 2, answer: 'O', defensibleAnswers: 1, solvable: true, issues: [] },
      { no: 3, answer: '엽 록 체', defensibleAnswers: 1, solvable: true, issues: [] },
      { no: 4, answer: '녹말', defensibleAnswers: 2, solvable: true, issues: [] },
    ]);
    const { results, model } = await verifyLessonItems({ kind: 'quiz', items: quiz }, params);
    const prompt = String(aiGenerate.mock.calls.at(-1)?.[0]);
    expect(prompt).toContain('② 이산화 탄소');
    expect(prompt).not.toContain('"answer":"이산화 탄소"');
    expect(prompt).not.toContain('엽록체');
    expect(model).toBe('gemini-test');
    expect(results.map(r => r.status)).toEqual(['ok', 'mismatch', 'ok', 'check']);
    expect(results[0].aiAnswer).toBe('이산화 탄소');
    expect(results[3].issues[0]).toContain('둘 이상');
  });

  it('워크시트는 풀 수 없는 문항과 확인할 문항을 구분한다', async () => {
    reply([
      { no: 1, answer: '빛, 물, 이산화 탄소', defensibleAnswers: 1, solvable: true, issues: [] },
      { no: 2, answer: '', defensibleAnswers: 1, solvable: false, issues: ['그래프가 문항에 없음'] },
    ]);
    const { results } = await verifyLessonItems({
      kind: 'worksheet',
      items: [{ id: 'q1', text: '광합성의 재료 세 가지를 쓰세요.', html: '' }, { id: 'q2', text: '그래프를 보고 답하세요.', html: '' }],
    }, params);
    expect(results.map(r => r.status)).toEqual(['ok', 'unsolvable']);
    expect(results[1].issues).toEqual(['그래프가 문항에 없음']);
  });

  it('결과 개수가 다르면 오류로 알린다', async () => {
    reply([{ no: 1, answer: 'O' }]);
    await expect(verifyLessonItems({ kind: 'quiz', items: quiz }, params)).rejects.toThrow('검증 결과를 읽지 못했습니다');
  });
});

describe('문항 작성 원칙', () => {
  it('평가지에는 객관식·서술형 원칙과 부정어 강조를 넣는다', async () => {
    aiGenerate.mockResolvedValueOnce({ text: '<!DOCTYPE html><html><body><section class="question">1</section></body></html>', model: 'm', fallbacks: [] });
    await generateLessonWorksheet(params, 'assessment', 1, false);
    const prompt = String(aiGenerate.mock.calls.at(-1)?.[0]);
    expect(prompt).toContain('[문항 작성 원칙');
    expect(prompt).toContain('정답 위치(보기 번호)를 문항마다 고르게');
    expect(prompt).toContain('부정어를 <strong>으로 강조');
    expect(prompt).toContain('답할 범위와 조건');
  });

  it('저학년 활동지는 조작형 과제를, 퀴즈는 긍정 질문을 요구한다', async () => {
    aiGenerate.mockResolvedValueOnce({ text: '<!DOCTYPE html><html><body><section class="activity">1</section></body></html>', model: 'm', fallbacks: [] });
    await generateLessonWorksheet({ ...params, grade: '초등학교 1학년' }, 'activity', 1, false);
    const activity = String(aiGenerate.mock.calls.at(-1)?.[0]);
    expect(activity).toContain('선 잇기');
    expect(activity).not.toContain('보기의 길이와 문장 형태');

    aiGenerate.mockResolvedValueOnce({ text: JSON.stringify({ title: '퀴즈', questions: [{ type: 'ox', question: '가', answer: 'O' }] }), model: 'm', fallbacks: [] });
    await generateLessonQuiz(params, 1, ['OX']);
    const quizPrompt = String(aiGenerate.mock.calls.at(-1)?.[0]);
    expect(quizPrompt).toContain('긍정 질문으로 쓰세요');
    expect(quizPrompt).not.toContain('<strong>으로 강조');
  });
});

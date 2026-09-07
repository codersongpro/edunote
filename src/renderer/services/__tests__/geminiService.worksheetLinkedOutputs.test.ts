import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  generateWorksheetTeacherGuide,
  generateWorksheetVariant,
  type LessonParams,
} from '../geminiService';

const aiGenerate = vi.fn();
const params: LessonParams = { grade: '초등학교 5학년', subject: '수학', unit: '분수', topic: '분수의 덧셈' };
const source = '<!DOCTYPE html><html><body><section data-question-id="q1">1. 계산하세요.</section></body></html>';

beforeEach(() => {
  aiGenerate.mockReset();
  Object.defineProperty(window, 'electronAPI', { configurable: true, value: { aiGenerate } });
});

describe('원본 연결 워크시트 출력', () => {
  it('도움형은 문항 순서·개수·ID와 정답 비노출을 요구한다', async () => {
    aiGenerate.mockResolvedValueOnce({ text: source, model: 'gemini-test' });
    await generateWorksheetVariant(source, 'support', params);
    const prompt = String(aiGenerate.mock.calls[0][0]);
    expect(prompt).toContain('도움형');
    expect(prompt).toContain('순서와 개수');
    expect(prompt).toContain('data-source-question-id="q1"');
    expect(prompt).toContain('정답, 해설, 채점 기준');
    expect(prompt).toContain(source);
  });

  it('도전형은 같은 정답을 유지하면서 확장 질문을 요구한다', async () => {
    aiGenerate.mockResolvedValueOnce({ text: source, model: 'gemini-test' });
    await generateWorksheetVariant(source, 'challenge', params);
    const prompt = String(aiGenerate.mock.calls[0][0]);
    expect(prompt).toContain('도전형');
    expect(prompt).toContain('핵심 목표와 정답은 유지');
    expect(prompt).toContain('적용·확장 질문');
  });

  it('교사용 자료는 문항 ID별 정답·해설·채점 기준을 별도 HTML로 요구한다', async () => {
    const guide = '<!DOCTYPE html><html><body><p>q1 정답과 해설</p></body></html>';
    aiGenerate.mockResolvedValueOnce({ text: guide, model: 'gemini-test' });
    const result = await generateWorksheetTeacherGuide(source, 'assessment', params);
    const prompt = String(aiGenerate.mock.calls[0][0]);
    expect(prompt).toContain('별도의 교사용 답안·해설');
    expect(prompt).toContain('q1, q2');
    expect(prompt).toContain('부분 점수 기준');
    expect(result).toEqual({ text: guide, model: 'gemini-test' });
  });
});

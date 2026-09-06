import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const serviceMocks = vi.hoisted(() => ({
  generateLessonSlides: vi.fn(),
  generateLessonWorksheet: vi.fn(),
  generateLessonQuiz: vi.fn(),
  generateLessonPlan: vi.fn(),
}));

vi.mock('../../services/geminiService', () => serviceMocks);
vi.mock('../../TourContext', () => ({ useTour: () => ({ startTour: vi.fn() }) }));
vi.mock('../../hooks/useGenerationTracker', () => ({
  useGenerationTracker: () => ({ startGeneration: vi.fn(), endGeneration: vi.fn() }),
}));
vi.mock('../../lib/soundEffect', () => ({ playSuccessSound: vi.fn() }));

import LessonMaterialGenerator from '../LessonMaterialGenerator';

const setInputValue = async (input: HTMLInputElement, value: string) => {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

const clickButton = async (container: HTMLElement, label: string) => {
  const button = Array.from(container.querySelectorAll('button'))
    .find(candidate => candidate.textContent?.includes(label));
  expect(button).toBeDefined();
  await act(async () => {
    (button as HTMLButtonElement).click();
    await Promise.resolve();
  });
};

describe('LessonMaterialGenerator 결과 보존', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    serviceMocks.generateLessonSlides.mockReset();
    serviceMocks.generateLessonQuiz.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        readJsonData: vi.fn().mockResolvedValue([]),
        getConfig: vi.fn().mockResolvedValue(''),
      },
    });
    await act(async () => {
      root.render(React.createElement(LessonMaterialGenerator));
      await Promise.resolve();
    });
    const topic = container.querySelector<HTMLInputElement>('input[placeholder="예: 소화 기관의 역할과 구조"]');
    expect(topic).not.toBeNull();
    await setInputValue(topic!, '생물 분류');
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('슬라이드 재생성 검증이 실패해도 이전 정상 슬라이드를 유지한다', async () => {
    serviceMocks.generateLessonSlides.mockResolvedValueOnce({
      slides: [{ page: 1, title: '기존 슬라이드', content: ['기존 내용', '확인 활동'], notes: '메모' }],
      model: 'gemini-test',
    });
    await clickButton(container, '수업 자료 생성');
    expect(container.textContent).toContain('기존 슬라이드');

    serviceMocks.generateLessonSlides.mockRejectedValueOnce(new Error('슬라이드 형식 오류'));
    await clickButton(container, '수업 자료 생성');
    expect(container.textContent).toContain('슬라이드 형식 오류');
    expect(container.textContent).toContain('기존 슬라이드');
  });

  it('퀴즈 재생성 검증이 실패해도 이전 정상 퀴즈를 유지한다', async () => {
    await clickButton(container, '퀴즈 앱');
    serviceMocks.generateLessonQuiz.mockResolvedValueOnce({ text: '<html>기존 퀴즈</html>', model: 'gemini-test' });
    await clickButton(container, '수업 자료 생성');
    expect(container.textContent).toContain('새 창에서 열기');

    serviceMocks.generateLessonQuiz.mockRejectedValueOnce(new Error('퀴즈 형식 오류'));
    await clickButton(container, '수업 자료 생성');
    expect(container.textContent).toContain('퀴즈 형식 오류');
    expect(container.textContent).toContain('새 창에서 열기');
  });
});

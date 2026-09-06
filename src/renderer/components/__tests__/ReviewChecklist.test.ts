import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REVIEW_CHECKLIST_UPDATED_EVENT, ReviewChecklist } from '../ReviewChecklist';

describe('ReviewChecklist', () => {
  let container: HTMLDivElement;
  let root: Root;
  let enabled = true;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    (globalThis as any).window.electronAPI = {
      getConfig: vi.fn().mockImplementation(() => Promise.resolve(enabled)),
    };
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const render = async (content: string, resetKey: string) => {
    await act(async () => {
      root.render(React.createElement(ReviewChecklist, { content, resetKey }));
      await Promise.resolve();
    });
  };

  it('설정이 켜지고 결과가 있을 때 세 가지 교사 확인 항목을 표시한다', async () => {
    await render('생성 결과', 'student-1:first');
    expect(container.textContent).toContain('개인정보');
    expect(container.textContent).toContain('관찰 근거·과장');
    expect(container.textContent).toContain('적용 지침');
    expect(container.textContent).toContain('교사가 직접 확인');
  });

  it('설정이 꺼졌거나 결과가 비어 있으면 표시하지 않는다', async () => {
    enabled = false;
    await render('생성 결과', 'off');
    expect(container.textContent).toBe('');

    enabled = true;
    await act(async () => window.dispatchEvent(new CustomEvent(REVIEW_CHECKLIST_UPDATED_EVENT, { detail: true })));
    await render('', 'empty');
    expect(container.textContent).toBe('');
  });

  it('설정 변경 이벤트를 받으면 현재 결과에 즉시 표시하거나 숨긴다', async () => {
    await render('생성 결과', 'same');
    await act(async () => window.dispatchEvent(new CustomEvent(REVIEW_CHECKLIST_UPDATED_EVENT, { detail: false })));
    expect(container.textContent).toBe('');
    await act(async () => window.dispatchEvent(new CustomEvent(REVIEW_CHECKLIST_UPDATED_EVENT, { detail: true })));
    expect(container.textContent).toContain('개인정보');
  });

  it('문서·학생·결과·직접 편집을 나타내는 resetKey가 바뀌면 체크를 초기화한다', async () => {
    await render('첫 결과', 'student-1:first');
    const first = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    await act(async () => first.click());
    expect(first.checked).toBe(true);

    await render('편집 결과', 'student-1:edited');
    expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(false);
    await render('새 학생 결과', 'student-2:new');
    expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(false);
  });
});

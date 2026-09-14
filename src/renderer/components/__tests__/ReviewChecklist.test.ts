import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  REVIEW_CHECKLIST_UPDATED_EVENT,
  ReviewChecklist,
  reviewChecklistItems,
  type ReviewChecklistKind,
} from '../ReviewChecklist';

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

  const render = async (content: string, resetKey: string, kind?: ReviewChecklistKind) => {
    await act(async () => {
      root.render(React.createElement(ReviewChecklist, { content, resetKey, kind }));
      await Promise.resolve();
    });
  };

  it('개인정보·보안 항목은 모든 영역에서 공통으로 들어간다', () => {
    const kinds: ReviewChecklistKind[] = ['student', 'document', 'lesson'];
    for (const kind of kinds) {
      expect(reviewChecklistItems(kind)[0]).toContain('개인정보·보안');
    }
  });

  it('학생기록과 교무행정은 공통 항목 외에 서로 다른 확인 항목을 쓴다', () => {
    const student = reviewChecklistItems('student');
    const document = reviewChecklistItems('document');
    expect(student[0]).toBe(document[0]);
    expect(student.slice(1)).not.toEqual(document.slice(1));
    expect(student.slice(1).some(item => item.includes('관찰 근거'))).toBe(true);
    expect(student.slice(1).some(item => item.includes('기재요령'))).toBe(true);
    expect(document.slice(1).some(item => item.includes('사실 확인'))).toBe(true);
    expect(document.slice(1).some(item => item.includes('붙임'))).toBe(true);
    // 학생기록 전용 표현이 교무행정 목록에 섞이지 않아야 한다.
    expect(document.some(item => item.includes('학교생활기록부'))).toBe(false);
    expect(student.some(item => item.includes('공문서'))).toBe(false);
  });

  it('설정이 켜지고 결과가 있을 때 학생기록 확인 항목을 표시한다', async () => {
    await render('생성 결과', 'student-1:first', 'student');
    expect(container.textContent).toContain('사용 전 체크리스트');
    expect(container.textContent).toContain('개인정보·보안');
    expect(container.textContent).toContain('관찰 근거·과장');
    expect(container.textContent).toContain('기재 요령');
    expect(container.textContent).toContain('자동검토 방식이 아니라, 교사가 직접 확인하기 위한 체크리스트');
  });

  it('kind를 생략하면 교무행정 문서 확인 항목을 표시한다', async () => {
    await render('생성 결과', 'doc-1:first');
    expect(container.textContent).toContain('사실 확인');
    expect(container.textContent).toContain('근거·붙임');
    expect(container.textContent).not.toContain('관찰 근거·과장');
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
    await render('생성 결과', 'same', 'student');
    await act(async () => window.dispatchEvent(new CustomEvent(REVIEW_CHECKLIST_UPDATED_EVENT, { detail: false })));
    expect(container.textContent).toBe('');
    await act(async () => window.dispatchEvent(new CustomEvent(REVIEW_CHECKLIST_UPDATED_EVENT, { detail: true })));
    expect(container.textContent).toContain('개인정보·보안');
  });

  it('문서·학생·결과·직접 편집을 나타내는 resetKey가 바뀌면 체크를 초기화한다', async () => {
    await render('첫 결과', 'student-1:first', 'student');
    const first = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    await act(async () => first.click());
    expect(first.checked).toBe(true);

    await render('편집 결과', 'student-1:edited', 'student');
    expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(false);
    await render('새 학생 결과', 'student-2:new', 'student');
    expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(false);
  });

  it('영역이 바뀌면 체크를 초기화한다', async () => {
    await render('결과', 'same-key', 'student');
    const first = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    await act(async () => first.click());
    expect(first.checked).toBe(true);

    await render('결과', 'same-key', 'document');
    expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(false);
  });
});

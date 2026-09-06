import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ModelDiagnostics } from '../../../preload/types';
import { ModelDiagnosticsPanel } from '../ModelDiagnosticsPanel';

describe('ModelDiagnosticsPanel', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const render = async (overrides: Partial<ModelDiagnostics> = {}) => {
    const info: ModelDiagnostics = {
      apiTier: 'free',
      chain: ['gemini-3.8-flash', 'gemini-3.7-flash'],
      available: ['gemini-3.8-flash', 'gemini-3.7-flash'],
      listFailed: false,
      blocked: [],
      selectedModel: 'gemini-3.8-flash',
      actualModel: 'gemini-3.7-flash',
      verificationStatus: 'verified',
      checkedAt: '2026-09-06T08:00:00.000Z',
      policyUpdatedAt: '2026-09-06',
      policySource: '공식 문서',
      selectionReason: '무료·정식·생성 가능 후보 중 최신 순서',
      ...overrides,
    };
    await act(async () => root.render(React.createElement(ModelDiagnosticsPanel, { info })));
  };

  it('후보·현재 선택·실제 생성·확인 시각·근거와 이유를 함께 표시한다', async () => {
    await render();
    const text = container.textContent ?? '';
    expect(text).toContain('검증 후보: gemini-3.8-flash → gemini-3.7-flash');
    expect(text).toContain('현재 선택: gemini-3.8-flash');
    expect(text).toContain('최근 실제 생성: gemini-3.7-flash');
    expect(text).toContain('확인 시각');
    expect(text).toContain('정책 기준: 공식 문서');
    expect(text).toContain('선택 이유: 무료·정식·생성 가능 후보 중 최신 순서');
  });

  it('목록 실패로 마지막 검증 후보를 쓰면 최신 여부 미확인을 표시한다', async () => {
    await render({ listFailed: true, verificationStatus: 'latest-unconfirmed' });
    expect(container.textContent).toContain('최신 여부 미확인');
    expect(container.textContent).toContain('24시간 안에 같은 키와 요금제로 확인한 기록');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  list: vi.fn(),
  generateContent: vi.fn(),
}));

vi.mock('@google/genai', async importOriginal => {
  const actual = await importOriginal<typeof import('@google/genai')>();
  return {
    ...actual,
    GoogleGenAI: class {
      models = sdk;
    },
  };
});

import { generateContent, getModelDiagnostics, resetModelCache, testApiKey } from '../GeminiService';

function modelPager(names: string[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const name of names) yield { name: `models/${name}`, supportedActions: ['generateContent'] };
    },
  };
}

describe('GeminiService 모델 선택 통합', () => {
  beforeEach(() => {
    resetModelCache();
    sdk.list.mockReset();
    sdk.generateContent.mockReset();
  });

  it('키 테스트도 고정 모델이 아니라 실제 생성과 같은 최신 검증 체인을 쓴다', async () => {
    sdk.list.mockResolvedValue(modelPager(['gemini-3.5-flash-lite', 'gemini-3.8-flash']));
    sdk.generateContent.mockResolvedValue({ text: 'ok' });

    await expect(testApiKey('key-a', 'free')).resolves.toEqual({ ok: true });
    expect(sdk.generateContent).toHaveBeenCalledTimes(1);
    expect(sdk.generateContent.mock.calls[0][0].model).toBe('gemini-3.8-flash');
  });

  it('목록 조회 성공 시 검증 대상이 없으면 미등재 모델을 호출하지 않고 실패한다', async () => {
    sdk.list.mockResolvedValue(modelPager(['gemini-9-flash-preview', 'gemini-embedding-001']));

    await expect(getModelDiagnostics('key-a', 'free', true)).rejects.toThrow('공식 확인된 정식 생성 모델');
    expect(sdk.generateContent).not.toHaveBeenCalled();
  });

  it('목록 조회 실패 시 같은 키·요금제의 유효한 마지막 검증 후보만 사용한다', async () => {
    sdk.list.mockResolvedValueOnce(modelPager(['gemini-3.8-flash', 'gemini-3.7-flash']));
    await getModelDiagnostics('key-a', 'free', true);
    sdk.list.mockRejectedValueOnce(new Error('network down'));

    const info = await getModelDiagnostics('key-a', 'free', true);
    expect(info.chain).toEqual(['gemini-3.8-flash', 'gemini-3.7-flash']);
    expect(info.verificationStatus).toBe('latest-unconfirmed');
    expect(info.listFailed).toBe(true);
  });

  it('목록 조회 실패 후 마지막 검증 후보도 없으면 오류를 반환한다', async () => {
    sdk.list.mockRejectedValue(new Error('network down'));
    await expect(getModelDiagnostics('new-key', 'free', true)).rejects.toThrow('network down');
  });

  it('최신 후보가 한도 초과면 다음 후보와 실제 성공 모델을 진단에 남긴다', async () => {
    sdk.list.mockResolvedValue(modelPager(['gemini-3.8-flash', 'gemini-3.7-flash']));
    sdk.generateContent
      .mockRejectedValueOnce({ status: 429, message: 'PerDay quota exceeded' })
      .mockResolvedValueOnce({ text: '완료', candidates: [{ finishReason: 'STOP' }] });

    await expect(generateContent('key-a', '작성', { apiTier: 'paid' })).resolves.toMatchObject({
      text: '완료',
      model: 'gemini-3.7-flash',
    });
    const info = await getModelDiagnostics('key-a', 'paid');
    expect(info.actualModel).toBe('gemini-3.7-flash');
    expect(info.selectedModel).toBe('gemini-3.7-flash');
    expect(info.blocked).toContain('gemini-3.8-flash');
  });
});

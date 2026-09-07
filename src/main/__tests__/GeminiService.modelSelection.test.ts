import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  list: vi.fn(),
  generateContent: vi.fn(),
  generateContentStream: vi.fn(),
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

vi.mock('../requestPacer', () => ({
  RequestPacer: class {
    reserve() {
      return Promise.resolve();
    }
  },
}));

import { generateContent, generateContentMultipartStream, getModelDiagnostics, resetModelCache, testApiKey } from '../GeminiService';

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
    sdk.generateContentStream.mockReset();
  });

  it('무료 키 테스트와 실제 생성 모두 최신 검증 Lite를 기본으로 쓴다', async () => {
    sdk.list.mockResolvedValue(modelPager(['gemini-3.5-flash-lite', 'gemini-3.8-flash']));
    sdk.generateContent.mockResolvedValue({ text: 'ok' });

    await expect(testApiKey('key-a', 'free')).resolves.toEqual({ ok: true });
    expect(sdk.generateContent).toHaveBeenCalledTimes(1);
    expect(sdk.generateContent.mock.calls[0][0].model).toBe('gemini-3.5-flash-lite');
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

  it('최신 Lite 한도 초과 시 다음 Lite와 Flash까지 순서대로 폴백한다', async () => {
    sdk.list.mockResolvedValue(modelPager([
      'gemini-3.8-flash',
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
    ]));
    sdk.generateContent
      .mockRejectedValueOnce({ status: 429, message: 'PerDay quota exceeded' })
      .mockRejectedValueOnce({ status: 429, message: 'PerDay quota exceeded' })
      .mockResolvedValueOnce({ text: '완료', candidates: [{ finishReason: 'STOP' }] });

    await expect(generateContent('key-a', '작성', { apiTier: 'free' })).resolves.toMatchObject({
      text: '완료',
      model: 'gemini-3.8-flash',
    });
    const info = await getModelDiagnostics('key-a', 'free');
    expect(info.actualModel).toBe('gemini-3.8-flash');
    expect(info.selectedModel).toBe('gemini-3.8-flash');
    expect(info.blocked).toContain('gemini-3.5-flash-lite');
    expect(info.blocked).toContain('gemini-3.1-flash-lite');
  });

  it('스트림 중 429도 Lite를 차단하고 다음 무료 후보에서 처음부터 완성한다', async () => {
    sdk.list.mockResolvedValue(modelPager([
      'gemini-3.8-flash',
      'gemini-3.7-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
    ]));
    const interrupted = {
      async *[Symbol.asyncIterator]() {
        yield { text: '미완성', candidates: [{ finishReason: 'STOP' }] };
        throw { status: 429, message: 'PerDay quota exceeded during stream' };
      },
    };
    const complete = (text: string) => ({
      async *[Symbol.asyncIterator]() {
        yield { text, candidates: [{ finishReason: 'STOP' }] };
      },
    });
    sdk.generateContentStream
      .mockResolvedValueOnce(interrupted)
      .mockRejectedValueOnce({ status: 429, message: 'PerDay quota exceeded' })
      .mockResolvedValueOnce(complete('Lite 완성'))
      .mockResolvedValueOnce(complete('다음 결과'));

    const progress: string[] = [];
    const first = await generateContentMultipartStream(
      'key-a',
      [{ text: '작성' }],
      { apiTier: 'free' },
      event => progress.push(event.type === 'chunk' ? event.text : event.type),
    );
    expect(first).toMatchObject({
      text: 'Lite 완성',
      model: 'gemini-3.8-flash',
      fallbacks: [
        { fromModel: 'gemini-3.5-flash-lite', reason: 'quota' },
        { fromModel: 'gemini-3.1-flash-lite', reason: 'quota' },
      ],
    });
    expect(progress).toEqual(['start', '미완성', 'start', 'start', 'Lite 완성']);

    const diagnostics = await getModelDiagnostics('key-a', 'free');
    expect(diagnostics.blocked).toEqual(expect.arrayContaining(['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']));
    expect(diagnostics.selectedModel).toBe('gemini-3.8-flash');

    await expect(generateContentMultipartStream(
      'key-a',
      [{ text: '다음 작성' }],
      { apiTier: 'free' },
      () => {},
    )).resolves.toMatchObject({ text: '다음 결과', model: 'gemini-3.8-flash' });
  });
});

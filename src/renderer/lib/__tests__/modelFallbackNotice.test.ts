import { describe, expect, it } from 'vitest';
import { buildModelFallbackNotice } from '../modelFallbackNotice';

describe('buildModelFallbackNotice', () => {
  it('사용량 제한 모델과 실제 완성 모델을 사용자에게 안내한다', () => {
    expect(buildModelFallbackNotice({
      usedModel: 'gemini-3.5-flash-lite',
      fallbacks: [
        { fromModel: 'gemini-3.8-flash', reason: 'quota' },
        { fromModel: 'gemini-3.7-flash', reason: 'quota' },
      ],
    })).toEqual({
      type: 'info',
      title: '사용량 제한으로 모델을 전환했습니다.',
      description: 'gemini-3.8-flash, gemini-3.7-flash의 사용량 제한을 감지해 gemini-3.5-flash-lite에서 결과를 처음부터 다시 완성했습니다.',
    });
  });

  it('사용량 제한 폴백이 없으면 안내를 만들지 않는다', () => {
    expect(buildModelFallbackNotice({
      usedModel: 'gemini-3.7-flash',
      fallbacks: [{ fromModel: 'gemini-3.8-flash', reason: 'stream' }],
    })).toBeNull();
  });
});

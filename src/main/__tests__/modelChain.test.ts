import { describe, it, expect } from 'vitest';
import {
  FREE_MODEL_PREFERENCE,
  PAID_MODEL_PREFERENCE,
  buildModelChain,
  getRetryDelayMs,
  isDailyQuotaError,
} from '../modelChain';

describe('buildModelChain', () => {
  it('실제 제공되는 모델만 선호 순서대로 고른다', () => {
    const available = ['models/gemini-2.5-flash', 'models/gemini-2.5-flash-lite', 'models/gemini-embedding-001'];
    expect(buildModelChain(FREE_MODEL_PREFERENCE, available)).toEqual([
      'gemini-2.5-flash-lite',
      'gemini-2.5-flash',
    ]);
  });

  it('models/ 접두사가 없어도 동작한다', () => {
    expect(buildModelChain(PAID_MODEL_PREFERENCE, ['gemini-2.5-pro'])).toEqual(['gemini-2.5-pro']);
  });

  it('목록 조회 실패(null) 시 기본 모델 1개로 동작한다', () => {
    expect(buildModelChain(FREE_MODEL_PREFERENCE, null)).toEqual([FREE_MODEL_PREFERENCE[0]]);
    expect(buildModelChain(FREE_MODEL_PREFERENCE, [])).toEqual([FREE_MODEL_PREFERENCE[0]]);
  });

  it('선호 모델이 하나도 없으면 기본 모델 1개로 동작한다', () => {
    expect(buildModelChain(FREE_MODEL_PREFERENCE, ['models/some-unknown-model'])).toEqual([FREE_MODEL_PREFERENCE[0]]);
  });

  it('폴백 체인은 최대 3개로 제한한다', () => {
    const all = FREE_MODEL_PREFERENCE.map(m => `models/${m}`);
    expect(buildModelChain(FREE_MODEL_PREFERENCE, all)).toHaveLength(3);
  });
});

describe('getRetryDelayMs', () => {
  it('RetryInfo의 retryDelay를 파싱한다', () => {
    const error = new Error('{"error":{"code":429,"details":[{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"22s"}]}}');
    expect(getRetryDelayMs(error)).toBe(22000);
  });

  it('소수점 초와 문장형 안내도 파싱한다', () => {
    expect(getRetryDelayMs(new Error('"retryDelay":"7.5s"'))).toBe(7500);
    expect(getRetryDelayMs(new Error('Please retry in 12.34s.'))).toBe(12340);
  });

  it('대기 정보가 없으면 null을 반환한다', () => {
    expect(getRetryDelayMs(new Error('429 Too Many Requests'))).toBeNull();
    expect(getRetryDelayMs(undefined)).toBeNull();
  });
});

describe('isDailyQuotaError', () => {
  it('일일 한도 quotaId를 감지한다', () => {
    expect(isDailyQuotaError(new Error('quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier"'))).toBe(true);
  });

  it('분당 제한은 일일 한도가 아니다', () => {
    expect(isDailyQuotaError(new Error('quotaId: "GenerateRequestsPerMinutePerProjectPerModel-FreeTier"'))).toBe(false);
    expect(isDailyQuotaError(new Error('429 rate limit exceeded'))).toBe(false);
  });
});

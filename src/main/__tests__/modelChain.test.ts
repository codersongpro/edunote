import { describe, it, expect } from 'vitest';
import {
  type VerifiedModelPolicy,
  MODEL_POLICY_UPDATED_AT,
  VERIFIED_GENERAL_MODELS,
  buildModelChain,
  selectVerifiedModels,
  LastVerifiedModelCache,
  getRetryDelayMs,
  isDailyQuotaError,
  isSearchGroundingUnavailableError,
} from '../modelChain';

describe('buildModelChain', () => {
  it('실제 제공되는 모델만 선호 순서대로 고른다', () => {
    const available = ['models/gemini-2.5-flash', 'models/gemini-2.5-flash-lite', 'models/gemini-embedding-001'];
    expect(buildModelChain(['gemini-2.5-flash-lite', 'gemini-2.5-flash'], available)).toEqual([
      'gemini-2.5-flash-lite',
      'gemini-2.5-flash',
    ]);
  });

  it('models/ 접두사가 없어도 동작한다', () => {
    expect(buildModelChain(['gemini-2.5-pro'], ['gemini-2.5-pro'])).toEqual(['gemini-2.5-pro']);
  });

  it('목록 조회 실패나 빈 목록이면 미등재 기본 모델을 추측하지 않는다', () => {
    expect(buildModelChain(['gemini-3.8-flash'], null)).toEqual([]);
    expect(buildModelChain(['gemini-3.8-flash'], [])).toEqual([]);
  });

  it('목록 조회가 성공해도 검증 후보가 없으면 미등재 모델로 폴백하지 않는다', () => {
    expect(buildModelChain(['gemini-3.8-flash'], ['models/some-unknown-model'])).toEqual([]);
  });

  it('폴백 체인은 최대 3개로 제한한다', () => {
    const preferred = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'];
    expect(buildModelChain(preferred, preferred.map(m => `models/${m}`))).toHaveLength(3);
  });
});

describe('selectVerifiedModels', () => {
  it('무료 모드는 최신 검증 Lite를 Flash보다 기본으로 사용한다', () => {
    expect(selectVerifiedModels('free', [
      'models/gemini-3.5-flash-lite',
      'models/gemini-3.8-flash',
    ])).toEqual(['gemini-3.5-flash-lite', 'gemini-3.8-flash']);
  });

  it('무료 후보가 많으면 최신 Lite부터 다음 Lite와 Flash 순으로 폴백한다', () => {
    expect(selectVerifiedModels('free', [
      'gemini-3.8-flash',
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
    ])).toEqual([
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
      'gemini-3.8-flash',
    ]);
  });

  it('Pro도 정책에서 무료로 확인되면 이름만으로 제외하지 않는다', () => {
    const policy: VerifiedModelPolicy[] = [
      { name: 'gemini-4-pro', releaseOrder: 400, free: true, paid: true, stable: true, generative: true },
      { name: 'gemini-3.8-flash', releaseOrder: 380, free: true, paid: true, stable: true, generative: true },
    ];
    expect(selectVerifiedModels('free', ['gemini-3.8-flash', 'gemini-4-pro'], policy)).toEqual([
      'gemini-4-pro',
      'gemini-3.8-flash',
    ]);
  });

  it('유료 모드는 기존 Pro → Flash → Lite 우선순위를 유지한다', () => {
    const policy: VerifiedModelPolicy[] = [
      { name: 'gemini-4-flash', releaseOrder: 400, free: false, paid: true, stable: true, generative: true, paidPriority: 1 },
      { name: 'gemini-3-pro', releaseOrder: 300, free: false, paid: true, stable: true, generative: true, paidPriority: 0 },
      { name: 'gemini-5-flash-lite', releaseOrder: 500, free: false, paid: true, stable: true, generative: true, paidPriority: 2 },
    ];
    expect(selectVerifiedModels('paid', policy.map(model => model.name), policy)).toEqual([
      'gemini-3-pro',
      'gemini-4-flash',
      'gemini-5-flash-lite',
    ]);
  });

  it('미리보기·실험판·비생성 모델과 정책에 없는 이름은 제외한다', () => {
    expect(selectVerifiedModels('free', [
      'gemini-3.8-flash-preview',
      'gemini-3.8-flash-exp',
      'gemini-embedding-001',
      'gemini-9-flash',
      'gemini-3.7-flash',
    ])).toEqual(['gemini-3.7-flash']);
  });

  it('정책에 있어도 정식 또는 생성 가능 조건을 통과하지 못하면 제외한다', () => {
    const policy: VerifiedModelPolicy[] = [
      { name: 'gemini-4-flash-preview', releaseOrder: 400, free: true, paid: true, stable: false, generative: true },
      { name: 'gemini-4-embed', releaseOrder: 401, free: true, paid: true, stable: true, generative: false },
      { name: 'gemini-3.8-flash', releaseOrder: 380, free: true, paid: true, stable: true, generative: true },
    ];
    expect(selectVerifiedModels('free', policy.map(model => model.name), policy)).toEqual(['gemini-3.8-flash']);
  });

  it('공식 목록에 검증된 무료 후보가 없으면 빈 체인을 반환한다', () => {
    expect(selectVerifiedModels('free', ['gemini-unknown'])).toEqual([]);
  });

  it('정책의 확인 시점과 현재 검증 목록을 명시한다', () => {
    expect(MODEL_POLICY_UPDATED_AT).toBe('2026-09-06');
    expect(VERIFIED_GENERAL_MODELS.some(model => model.name === 'gemini-3.8-flash' && model.free)).toBe(true);
  });
});

describe('LastVerifiedModelCache', () => {
  it('키와 요금제를 분리하고 수동 갱신으로 해당 키의 기록만 비운다', () => {
    const cache = new LastVerifiedModelCache(1_000);
    cache.set('key-a', 'free', ['gemini-3.8-flash'], 100);
    cache.set('key-a', 'paid', ['gemini-3.7-flash'], 100);
    cache.set('key-b', 'free', ['gemini-3.6-flash'], 100);

    expect(cache.get('key-a', 'free', 500)).toEqual(['gemini-3.8-flash']);
    expect(cache.get('key-a', 'paid', 500)).toEqual(['gemini-3.7-flash']);
    cache.clearKey('key-a');
    expect(cache.get('key-a', 'free', 500)).toBeNull();
    expect(cache.get('key-a', 'paid', 500)).toBeNull();
    expect(cache.get('key-b', 'free', 500)).toEqual(['gemini-3.6-flash']);
  });

  it('유효 시간이 지나거나 현재 정책에서 제외된 후보는 재사용하지 않는다', () => {
    const cache = new LastVerifiedModelCache(1_000);
    cache.set('key-a', 'free', ['gemini-3.8-flash'], 100);
    expect(cache.get('key-a', 'free', 1_101)).toBeNull();

    cache.set('key-a', 'free', ['gemini-3.8-flash'], 200);
    expect(cache.get('key-a', 'free', 500, new Set(['gemini-3.7-flash']))).toBeNull();
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

describe('isSearchGroundingUnavailableError', () => {
  it('모델의 구글 검색 미지원 오류를 감지한다', () => {
    expect(isSearchGroundingUnavailableError({
      status: 400,
      message: 'Google Search grounding is not supported for this model',
    })).toBe(true);
  });

  it('무료 등급에서 검색 그라운딩을 쓸 수 없다는 오류를 감지한다', () => {
    expect(isSearchGroundingUnavailableError({
      status: 429,
      message: 'Grounding with Google Search is not available on the free tier',
    })).toBe(true);
  });

  it('일반 쿼터 초과와 일반 입력 오류는 검색 미지원으로 오인하지 않는다', () => {
    expect(isSearchGroundingUnavailableError(new Error('429 rate limit exceeded'))).toBe(false);
    expect(isSearchGroundingUnavailableError({ status: 400, message: 'Invalid prompt format' })).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import {
  FREE_MODEL_PREFERENCE,
  PAID_MODEL_PREFERENCE,
  FREE_TIER_ORDER,
  PAID_TIER_ORDER,
  buildModelChain,
  buildDynamicPreference,
  resolvePreference,
  getRetryDelayMs,
  isDailyQuotaError,
  isSearchGroundingUnavailableError,
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

describe('buildDynamicPreference', () => {
  // 회귀 방지: v1.20.1에서 세대(버전)를 등급보다 먼저 따지도록 만들었다가, 무료 키에서
  // gemini-3.7-flash(무료 등급 미확인 모델)가 구세대 flash-lite보다 먼저 시도되어
  // 생성이 느려지고 자주 실패하는 문제가 있었다. 등급이 항상 세대보다 우선해야 한다.
  it('무료 등급은 구세대 flash-lite를 신세대 flash보다 우선한다', () => {
    const available = ['models/gemini-2.5-flash-lite', 'models/gemini-3.7-flash'];
    expect(buildDynamicPreference(FREE_TIER_ORDER, available)).toEqual([
      'gemini-2.5-flash-lite',
      'gemini-3.7-flash',
    ]);
  });

  it('같은 등급 안에서는 최신 세대를 앞세운다 (신모델을 자동으로 1순위로)', () => {
    const available = ['gemini-2.5-flash-lite', 'gemini-3.5-flash-lite'];
    expect(buildDynamicPreference(FREE_TIER_ORDER, available)).toEqual([
      'gemini-3.5-flash-lite',
      'gemini-2.5-flash-lite',
    ]);
  });

  it('같은 세대에서는 tierOrder를 따른다 (무료: flash-lite 우선)', () => {
    const available = ['gemini-3.5-flash', 'gemini-3.5-flash-lite'];
    expect(buildDynamicPreference(FREE_TIER_ORDER, available)).toEqual([
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
    ]);
  });

  it('유료 등급은 pro를 최우선으로 하되, 더 최신 세대가 있으면 그쪽을 앞세운다', () => {
    const available = ['gemini-2.5-pro', 'gemini-3.1-pro', 'gemini-2.5-flash'];
    expect(buildDynamicPreference(PAID_TIER_ORDER, available)).toEqual([
      'gemini-3.1-pro',
      'gemini-2.5-pro',
      'gemini-2.5-flash',
    ]);
  });

  // 구글이 소수점 없는 세대 이름을 내놓아도 자동 감지에서 빠지지 않아야 한다.
  it('소수점 없는 세대 이름(gemini-4-flash-lite)도 인식한다', () => {
    const available = ['gemini-3.5-flash-lite', 'gemini-4-flash-lite'];
    expect(buildDynamicPreference(FREE_TIER_ORDER, available)).toEqual([
      'gemini-4-flash-lite',
      'gemini-3.5-flash-lite',
    ]);
  });

  it('소수점 없는 이름은 minor 0으로 보아 같은 세대의 소수점 버전보다 뒤에 둔다', () => {
    const available = ['gemini-4-flash-lite', 'gemini-4.1-flash-lite'];
    expect(buildDynamicPreference(FREE_TIER_ORDER, available)).toEqual([
      'gemini-4.1-flash-lite',
      'gemini-4-flash-lite',
    ]);
  });

  it('실험판·프리뷰·임베딩 등 정식 이름 규칙을 벗어난 모델은 제외한다', () => {
    const available = [
      'gemini-3.7-flash-preview',
      'gemini-embedding-001',
      'gemini-2.0-flash-exp-image-generation',
      'gemini-2.5-flash',
    ];
    expect(buildDynamicPreference(FREE_TIER_ORDER, available)).toEqual(['gemini-2.5-flash']);
  });

  it('목록 조회 실패(null)면 빈 배열을 반환한다', () => {
    expect(buildDynamicPreference(FREE_TIER_ORDER, null)).toEqual([]);
  });
});

describe('resolvePreference', () => {
  it('동적으로 감지한 최신 모델을 먼저 두고, 기존 고정 목록을 안전망으로 뒤에 붙인다', () => {
    const available = ['gemini-3.7-flash'];
    const result = resolvePreference(FREE_TIER_ORDER, FREE_MODEL_PREFERENCE, available);
    expect(result[0]).toBe('gemini-3.7-flash');
    expect(result).toEqual(['gemini-3.7-flash', ...FREE_MODEL_PREFERENCE]);
  });

  it('동적 감지 결과와 고정 목록에 겹치는 이름은 중복 제거한다', () => {
    const available = ['gemini-2.5-flash-lite'];
    const result = resolvePreference(FREE_TIER_ORDER, FREE_MODEL_PREFERENCE, available);
    expect(result.filter(m => m === 'gemini-2.5-flash-lite')).toHaveLength(1);
  });

  it('목록 조회 실패(null)면 기존 고정 목록만 그대로 반환한다', () => {
    expect(resolvePreference(FREE_TIER_ORDER, FREE_MODEL_PREFERENCE, null)).toEqual(FREE_MODEL_PREFERENCE);
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

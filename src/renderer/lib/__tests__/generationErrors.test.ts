import { describe, it, expect } from 'vitest';
import { describeGenerationError, isTemporaryApiError } from '../generationErrors';

describe('isTemporaryApiError', () => {
  it('쿼터·요청 제한 패턴을 일시적 오류로 본다', () => {
    expect(isTemporaryApiError(new Error('429 Too Many Requests'))).toBe(true);
    expect(isTemporaryApiError(new Error('RESOURCE_EXHAUSTED: quota'))).toBe(true);
    expect(isTemporaryApiError(new Error('API 사용을 위해 잠시 기다리세요! 토큰 소모 또는 잦은 요청'))).toBe(true);
    expect(isTemporaryApiError(new Error('사용 가능한 모델이 없습니다. 잠시 후 다시 시도해주세요.'))).toBe(true);
  });

  it('그 밖의 오류는 일시적 오류가 아니다', () => {
    expect(isTemporaryApiError(new Error('API key not valid'))).toBe(false);
    expect(isTemporaryApiError(new Error('fetch failed'))).toBe(false);
  });
});

describe('describeGenerationError', () => {
  it('API 키 미설정을 안내한다', () => {
    expect(describeGenerationError(new Error('API 키가 설정되지 않았습니다. 설정에서 Gemini API 키를 입력해주세요.')))
      .toContain('[API 키 없음]');
  });

  it('유효하지 않은 API 키를 안내한다', () => {
    expect(describeGenerationError(new Error('API key not valid. Please pass a valid API key.')))
      .toContain('[API 키 오류]');
    expect(describeGenerationError(new Error('403 PERMISSION DENIED'))).toContain('[API 키 오류]');
  });

  it('쿼터 초과를 안내한다', () => {
    expect(describeGenerationError(new Error('429 quota exceeded'))).toContain('[사용량 알림]');
  });

  it('시간 초과를 안내한다', () => {
    expect(describeGenerationError(new Error('요청 시간이 초과되었습니다. 네트워크 상태를 확인하고 다시 시도해주세요.')))
      .toContain('[시간 초과]');
  });

  it('네트워크 오류를 안내한다', () => {
    expect(describeGenerationError(new Error('fetch failed'))).toContain('[네트워크 오류]');
  });

  it('알 수 없는 오류는 원본 메시지 일부를 포함한다', () => {
    expect(describeGenerationError(new Error('이상한 내부 오류'))).toContain('이상한 내부 오류');
  });

  it('메시지가 없으면 일반 안내문을 반환한다', () => {
    expect(describeGenerationError('')).toContain('잠시 후 다시 시도해주세요');
  });
});

describe('describeGenerationError — 일일 한도', () => {
  it('일일 한도 소진 메시지를 구분해 안내한다', () => {
    expect(describeGenerationError(new Error('오늘 사용할 수 있는 무료 API 한도를 모두 사용했습니다. 내일 다시 시도하거나 설정에서 다른 API 키를 사용해주세요.')))
      .toContain('[일일 한도 소진]');
  });
});

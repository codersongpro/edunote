import { describe, it, expect } from 'vitest';
import { getByteLength, DEFAULT_BYTE_LIMITS, RECORD_KINDS, isValidByteLimit, getByteLimitState, parseByteLimits } from '../textLength';

describe('getByteLength', () => {
  it('한글은 3바이트로 계산한다', () => {
    expect(getByteLength('가')).toBe(3);
    expect(getByteLength('안녕')).toBe(6);
  });

  it('영문·숫자·공백은 1바이트로 계산한다', () => {
    expect(getByteLength('abc 123')).toBe(7);
  });

  it('한글과 영문이 섞인 문자열을 정확히 계산한다', () => {
    expect(getByteLength('안녕 hi')).toBe(9); // 안녕(6) + 공백(1) + hi(2)
  });

  it('빈 문자열은 0바이트다', () => {
    expect(getByteLength('')).toBe(0);
  });
});

describe('DEFAULT_BYTE_LIMITS', () => {
  it('생기부 4개 항목의 기본 상한을 모두 정의한다', () => {
    for (const kind of RECORD_KINDS) {
      expect(typeof DEFAULT_BYTE_LIMITS[kind]).toBe('number');
      expect(DEFAULT_BYTE_LIMITS[kind]).toBeGreaterThan(0);
    }
  });
});

describe('isValidByteLimit', () => {
  it('양의 정수만 허용한다', () => {
    expect(isValidByteLimit(1500)).toBe(true);
    expect(isValidByteLimit(1)).toBe(true);
    expect(isValidByteLimit(0)).toBe(false);
    expect(isValidByteLimit(-100)).toBe(false);
    expect(isValidByteLimit(1500.5)).toBe(false);
  });

  it('과도하게 큰 값은 거부한다', () => {
    expect(isValidByteLimit(100_000)).toBe(false);
  });
});

describe('getByteLimitState', () => {
  it('상한에 여유가 있으면 ok를 반환한다', () => {
    // '가' 3바이트 × 3 = 9바이트
    expect(getByteLimitState('가가가', 100)).toBe('ok');
  });

  it('상한을 넘으면 over를 반환한다', () => {
    expect(getByteLimitState('가가가', 8)).toBe('over');
  });

  it('상한의 90% 이상이면 near를 반환한다', () => {
    expect(getByteLimitState('가가가', 10)).toBe('near'); // 9/10 = 90%
    expect(getByteLimitState('가가가', 9)).toBe('near');  // 9/9 = 100%, 넘지는 않음
  });

  it('상한이 유효하지 않으면 판정하지 않고 unknown을 반환한다', () => {
    expect(getByteLimitState('가가가', 0)).toBe('unknown');
    expect(getByteLimitState('가가가', -1)).toBe('unknown');
  });

  it('빈 문자열은 항상 ok다', () => {
    expect(getByteLimitState('', 1500)).toBe('ok');
  });
});

describe('parseByteLimits', () => {
  it('값이 없으면 기본값을 그대로 돌려준다', () => {
    expect(parseByteLimits('')).toEqual(DEFAULT_BYTE_LIMITS);
    expect(parseByteLimits(undefined)).toEqual(DEFAULT_BYTE_LIMITS);
    expect(parseByteLimits(null)).toEqual(DEFAULT_BYTE_LIMITS);
  });

  it('깨진 JSON이면 기본값으로 되돌린다', () => {
    expect(parseByteLimits('{ 깨진')).toEqual(DEFAULT_BYTE_LIMITS);
    expect(parseByteLimits('[1,2,3]')).toEqual(DEFAULT_BYTE_LIMITS);
  });

  it('저장된 값으로 항목별 상한을 덮어쓴다', () => {
    const result = parseByteLimits(JSON.stringify({ opinion: 800, sports: 300 }));
    expect(result.opinion).toBe(800);
    expect(result.sports).toBe(300);
    // 지정하지 않은 항목은 기본값 유지
    expect(result.subject).toBe(DEFAULT_BYTE_LIMITS.subject);
  });

  it('범위를 벗어나거나 형식이 틀린 항목만 기본값으로 되돌린다', () => {
    const result = parseByteLimits(JSON.stringify({ opinion: 0, subject: '1500', creative: 900 }));
    expect(result.opinion).toBe(DEFAULT_BYTE_LIMITS.opinion);
    expect(result.subject).toBe(DEFAULT_BYTE_LIMITS.subject);
    expect(result.creative).toBe(900);
  });

  it('알 수 없는 키는 무시한다', () => {
    const result = parseByteLimits(JSON.stringify({ opinion: 800, __proto__: { polluted: true }, hacker: 1 }));
    expect(result.opinion).toBe(800);
    expect(Object.keys(result).sort()).toEqual([...RECORD_KINDS].sort());
  });
});


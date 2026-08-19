import { describe, it, expect } from 'vitest';
import { sanitizeConfigEntry } from '../configValidation';

describe('sanitizeConfigEntry', () => {
  it('boolean 키는 boolean 값만 허용한다', () => {
    expect(sanitizeConfigEntry('darkMode', true)).toBe(true);
    expect(sanitizeConfigEntry('darkMode', false)).toBe(false);
    expect(sanitizeConfigEntry('darkMode', 'true')).toBeUndefined();
    expect(sanitizeConfigEntry('alwaysAskPath', { evil: 1 })).toBeUndefined();
    expect(sanitizeConfigEntry('privacyModeEnabled', 1)).toBeUndefined();
  });

  it('apiTier는 free/paid만 허용한다', () => {
    expect(sanitizeConfigEntry('apiTier', 'free')).toBe('free');
    expect(sanitizeConfigEntry('apiTier', 'paid')).toBe('paid');
    expect(sanitizeConfigEntry('apiTier', 'premium')).toBeUndefined();
    expect(sanitizeConfigEntry('apiTier', true)).toBeUndefined();
  });

  it('경로 키는 빈 문자열 또는 절대 경로만 허용한다', () => {
    expect(sanitizeConfigEntry('saveDir', '')).toBe('');
    const abs = process.platform === 'win32' ? 'C:\\Users\\test' : '/home/test';
    expect(sanitizeConfigEntry('saveDir', abs)).toBe(abs);
    expect(sanitizeConfigEntry('saveDir', '../../../etc')).toBeUndefined();
    expect(sanitizeConfigEntry('appDataDir', 'relative/path')).toBeUndefined();
    expect(sanitizeConfigEntry('appDataDir', 123)).toBeUndefined();
  });

  it('일반 문자열 키는 문자열만 허용하고 과도한 길이를 거부한다', () => {
    expect(sanitizeConfigEntry('teacherName', '홍길동')).toBe('홍길동');
    expect(sanitizeConfigEntry('teacherName', { name: '홍길동' })).toBeUndefined();
    expect(sanitizeConfigEntry('studentNames', 'a'.repeat(10_001))).toBeUndefined();
    expect(sanitizeConfigEntry('cautionTerms', 'a'.repeat(10_000))).toBe('a'.repeat(10_000));
  });

  it('fontSize는 75~150 범위의 정수만 허용한다', () => {
    expect(sanitizeConfigEntry('fontSize', 100)).toBe(100);
    expect(sanitizeConfigEntry('fontSize', 75)).toBe(75);
    expect(sanitizeConfigEntry('fontSize', 150)).toBe(150);
    expect(sanitizeConfigEntry('fontSize', 74)).toBeUndefined();
    expect(sanitizeConfigEntry('fontSize', 151)).toBeUndefined();
    expect(sanitizeConfigEntry('fontSize', 100.5)).toBeUndefined();
    expect(sanitizeConfigEntry('fontSize', '100')).toBeUndefined();
  });
});

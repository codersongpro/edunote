import { describe, it, expect } from 'vitest';
import { getByteLength } from '../textLength';

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

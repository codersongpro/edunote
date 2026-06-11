import { describe, it, expect, vi, afterEach } from 'vitest';
import { safeSetItem } from '../safeStorage';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('safeSetItem', () => {
  it('정상 저장 시 true를 반환하고 값이 저장된다', () => {
    expect(safeSetItem('test-key', 'value')).toBe(true);
    expect(localStorage.getItem('test-key')).toBe('value');
  });

  it('용량 초과 등으로 setItem이 던져도 예외 없이 false를 반환한다', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    });
    expect(() => safeSetItem('test-key', 'value')).not.toThrow();
    expect(safeSetItem('test-key', 'value')).toBe(false);
  });
});

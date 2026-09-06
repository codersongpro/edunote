import { describe, expect, it } from 'vitest';
import { selectActiveApiKey } from '../apiKeySelection';

describe('selectActiveApiKey', () => {
  it('무료 모드에서는 유료 키가 있어도 대신 사용하지 않는다', () => {
    expect(selectActiveApiKey('free', '', 'paid-key')).toBe('');
    expect(selectActiveApiKey('free', 'free-key', 'paid-key')).toBe('free-key');
  });

  it('유료 모드에서는 설정된 유료 키를 우선한다', () => {
    expect(selectActiveApiKey('paid', 'free-key', 'paid-key')).toBe('paid-key');
  });
});

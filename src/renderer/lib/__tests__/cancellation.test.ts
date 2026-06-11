import { describe, it, expect } from 'vitest';
import { CancellationRegistry } from '../cancellation';

describe('CancellationRegistry', () => {
  it('같은 키는 같은 신호를 돌려준다', () => {
    const registry = new CancellationRegistry();
    expect(registry.signalFor('a')).toBe(registry.signalFor('a'));
  });

  it('한 키를 중단해도 다른 키의 신호는 중단되지 않는다', () => {
    const registry = new CancellationRegistry();
    const a = registry.signalFor('a');
    const b = registry.signalFor('b');
    registry.cancel('a');
    expect(a.aborted).toBe(true);
    expect(b.aborted).toBe(false);
  });

  it('중단 후 같은 키는 새 신호를 받는다', () => {
    const registry = new CancellationRegistry();
    const before = registry.signalFor('a');
    registry.cancel('a');
    const after = registry.signalFor('a');
    expect(after).not.toBe(before);
    expect(after.aborted).toBe(false);
  });

  it('등록되지 않은 키 중단은 아무 일도 하지 않는다', () => {
    const registry = new CancellationRegistry();
    expect(() => registry.cancel('none')).not.toThrow();
  });

  it('cancelAll은 모든 신호를 중단한다', () => {
    const registry = new CancellationRegistry();
    const a = registry.signalFor('a');
    const b = registry.signalFor('b');
    registry.cancelAll();
    expect(a.aborted).toBe(true);
    expect(b.aborted).toBe(true);
    expect(registry.signalFor('a').aborted).toBe(false);
  });
});

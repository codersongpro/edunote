import { describe, it, expect, vi } from 'vitest';
import { CancellationRegistry, prepareAndRunWithAbort, runWithAbortSignal } from '../cancellation';

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

  it('삭제 전 요청은 새 요청이 시작된 뒤 완료돼도 결과를 반환하지 않는다', async () => {
    const registry = new CancellationRegistry();
    const oldSignal = registry.signalFor('student-record');
    let finishOldRequest: ((value: string) => void) | undefined;
    const oldRequest = runWithAbortSignal(
      oldSignal,
      () => new Promise<string>(resolve => { finishOldRequest = resolve; }),
    );

    registry.cancelAll();
    expect(registry.signalFor('student-record').aborted).toBe(false);
    finishOldRequest?.('삭제 전 결과');

    await expect(oldRequest).rejects.toThrow('CANCELLED');
  });

  it('생성 준비 중 삭제되면 준비가 끝나도 AI 요청을 시작하지 않는다', async () => {
    const registry = new CancellationRegistry();
    const callWithAbort = <T>(fn: () => Promise<T>) => runWithAbortSignal(
      registry.signalFor('student-record'),
      fn,
    );
    let finishPreparation: ((value: string) => void) | undefined;
    const runRequest = vi.fn(async (prepared: string) => `${prepared} 결과`);
    const operation = prepareAndRunWithAbort(
      callWithAbort,
      () => new Promise<string>(resolve => { finishPreparation = resolve; }),
      runRequest,
    );

    registry.cancelAll();
    registry.signalFor('student-record');
    finishPreparation?.('삭제 전 준비');

    await expect(operation).rejects.toThrow('CANCELLED');
    await Promise.resolve();
    expect(runRequest).not.toHaveBeenCalled();
  });
});

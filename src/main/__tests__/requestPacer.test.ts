import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RequestPacer } from '../requestPacer';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('RequestPacer', () => {
  it('첫 호출은 기다리지 않는다', async () => {
    const pacer = new RequestPacer(4000);
    let done = false;
    pacer.reserve().then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(true);
  });

  it('연속 호출은 최소 간격만큼 띄운다', async () => {
    const pacer = new RequestPacer(4000);
    const order: number[] = [];
    pacer.reserve().then(() => order.push(1));
    pacer.reserve().then(() => order.push(2));
    pacer.reserve().then(() => order.push(3));

    await vi.advanceTimersByTimeAsync(0);
    expect(order).toEqual([1]);

    await vi.advanceTimersByTimeAsync(4000);
    expect(order).toEqual([1, 2]);

    await vi.advanceTimersByTimeAsync(4000);
    expect(order).toEqual([1, 2, 3]);
  });

  it('간격이 이미 지난 뒤의 호출은 기다리지 않는다', async () => {
    const pacer = new RequestPacer(4000);
    let first = false;
    pacer.reserve().then(() => { first = true; });
    await vi.advanceTimersByTimeAsync(0);
    expect(first).toBe(true);

    await vi.advanceTimersByTimeAsync(5000);
    let second = false;
    pacer.reserve().then(() => { second = true; });
    await vi.advanceTimersByTimeAsync(0);
    expect(second).toBe(true);
  });
});

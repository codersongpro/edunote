import { describe, expect, it, vi } from 'vitest';
import { BoundedDownloadBuffer } from '../downloadLimit';

describe('BoundedDownloadBuffer', () => {
  it('제한 이하의 여러 청크를 원문 그대로 합친다', () => {
    const body = new BoundedDownloadBuffer(6);
    body.assertContentLength('6');
    body.append(Buffer.from('abc'));
    body.append(Buffer.from('def'));
    expect(body.toBuffer().toString()).toBe('abcdef');
  });

  it('Content-Length가 제한을 넘으면 본문을 받기 전에 거부한다', () => {
    const onExceeded = vi.fn();
    const body = new BoundedDownloadBuffer(5, onExceeded);
    expect(() => body.assertContentLength('6')).toThrow(/5바이트/);
    expect(onExceeded).toHaveBeenCalledTimes(1);
    expect(body.retainedBytes).toBe(0);
  });

  it('Content-Length가 없어도 실제 수신 바이트로 제한한다', () => {
    const body = new BoundedDownloadBuffer(5);
    body.append(Buffer.from('abc'));
    expect(() => body.append(Buffer.from('def'))).toThrow(/5바이트/);
    expect(body.retainedBytes).toBe(0);
  });

  it('작게 속인 Content-Length와 관계없이 실제 합계가 넘으면 중단한다', () => {
    const onExceeded = vi.fn();
    const body = new BoundedDownloadBuffer(5, onExceeded);
    body.assertContentLength('2');
    body.append(Buffer.from('1234'));
    expect(() => body.append(Buffer.from('56'))).toThrow();
    expect(onExceeded).toHaveBeenCalledTimes(1);
  });

  it('초과 후 중복 청크가 와도 중단 콜백을 한 번만 호출하고 버퍼를 보관하지 않는다', () => {
    const onExceeded = vi.fn();
    const body = new BoundedDownloadBuffer(3, onExceeded);
    expect(() => body.append(Buffer.from('1234'))).toThrow();
    expect(() => body.append(Buffer.from('5678'))).toThrow();
    expect(onExceeded).toHaveBeenCalledTimes(1);
    expect(body.retainedBytes).toBe(0);
  });

  it('잘못된 Content-Length는 신뢰하지 않고 실제 바이트를 검사한다', () => {
    const body = new BoundedDownloadBuffer(3);
    body.assertContentLength('not-a-number');
    body.append(Buffer.from('123'));
    expect(body.toBuffer().toString()).toBe('123');
  });
});

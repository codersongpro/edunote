import { describe, expect, it } from 'vitest';
import { GuardError, assertSameOrigin, isBlockedIp, parsePublicUrl } from '../_guard';

describe('공개 서버 SSRF 차단', () => {
  it.each([
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.0.10', '169.254.169.254',
    '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', '::', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1',
  ])('내부·예약 주소 %s 를 막는다', ip => {
    expect(isBlockedIp(ip)).toBe(true);
  });

  it.each(['8.8.8.8', '142.250.196.110', '172.32.0.1', '2404:6800:4004:80c::200e'])('공인 주소 %s 는 허용한다', ip => {
    expect(isBlockedIp(ip)).toBe(false);
  });

  it.each([
    'file:///etc/passwd', 'ftp://example.com', 'http://localhost/', 'http://127.0.0.1/', 'http://[::1]/',
    'http://user:pw@example.com/', 'http://example.com:8080/', 'http://printer.local/', 'not a url',
  ])('위험한 주소 %s 를 거부한다', raw => {
    expect(() => parsePublicUrl(raw)).toThrow(GuardError);
  });

  it('일반 https 주소는 통과한다', () => {
    expect(parsePublicUrl('https://www.moe.go.kr/main.do').hostname).toBe('www.moe.go.kr');
  });
});

describe('같은 사이트 요청만 허용', () => {
  const req = (headers: Record<string, string>) => new Request('https://edunote.example/api/url-meta', { headers });

  it('다른 사이트에서 온 요청을 막는다', () => {
    expect(() => assertSameOrigin(req({ 'sec-fetch-site': 'cross-site' }))).toThrow(GuardError);
    expect(() => assertSameOrigin(req({ origin: 'https://evil.example', host: 'edunote.example' }))).toThrow(GuardError);
  });

  it('같은 사이트 요청은 통과한다', () => {
    expect(() => assertSameOrigin(req({ 'sec-fetch-site': 'same-origin', origin: 'https://edunote.example', host: 'edunote.example' }))).not.toThrow();
  });
});

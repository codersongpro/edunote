import { describe, it, expect } from 'vitest';
import { isBlockedHostname, assertSafeUrl } from '../netGuard';

describe('isBlockedHostname', () => {
  it('루프백·미지정 IPv4 주소를 차단한다', () => {
    expect(isBlockedHostname('127.0.0.1')).toBe(true);
    expect(isBlockedHostname('127.1.2.3')).toBe(true);
    expect(isBlockedHostname('0.0.0.0')).toBe(true);
  });

  it('localhost 계열 호스트명을 차단한다', () => {
    expect(isBlockedHostname('localhost')).toBe(true);
    expect(isBlockedHostname('LOCALHOST')).toBe(true);
    expect(isBlockedHostname('api.localhost')).toBe(true);
    expect(isBlockedHostname('localhost.')).toBe(true);
  });

  it('링크로컬 대역을 차단한다', () => {
    expect(isBlockedHostname('169.254.169.254')).toBe(true);
    expect(isBlockedHostname('[fe80::1]')).toBe(true);
  });

  it('IPv6 루프백과 IPv4 매핑 주소를 차단한다', () => {
    expect(isBlockedHostname('[::1]')).toBe(true);
    expect(isBlockedHostname('::1')).toBe(true);
    expect(isBlockedHostname('[::ffff:127.0.0.1]')).toBe(true);
  });

  it('16진 그룹 형태의 IPv4 매핑 주소도 차단한다', () => {
    expect(isBlockedHostname('[::ffff:7f00:1]')).toBe(true);    // 127.0.0.1
    expect(isBlockedHostname('[::ffff:a9fe:a9fe]')).toBe(true); // 169.254.169.254
    expect(isBlockedHostname('[::ffff:0:0]')).toBe(true);       // 0.0.0.0
  });

  it('16진 그룹 형태라도 공인 IP 매핑은 허용한다', () => {
    expect(isBlockedHostname('[::ffff:808:808]')).toBe(false); // 8.8.8.8
  });

  it('일반 공인 IPv6 주소는 허용한다', () => {
    expect(isBlockedHostname('[2606:4700::1]')).toBe(false);
    expect(isBlockedHostname('[2001:4860:4860::8888]')).toBe(false);
  });

  it('빈 호스트명을 차단한다', () => {
    expect(isBlockedHostname('')).toBe(true);
  });

  it('일반 도메인과 공인 IP는 허용한다', () => {
    expect(isBlockedHostname('www.youtube.com')).toBe(false);
    expect(isBlockedHostname('apis.data.go.kr')).toBe(false);
    expect(isBlockedHostname('8.8.8.8')).toBe(false);
  });

  it('학교 인트라넷용 사설 IP 대역은 허용한다', () => {
    expect(isBlockedHostname('192.168.0.10')).toBe(false);
    expect(isBlockedHostname('10.1.2.3')).toBe(false);
    expect(isBlockedHostname('172.16.5.5')).toBe(false);
  });

  it('IP 형식이 아닌 숫자 포함 호스트명은 허용한다', () => {
    expect(isBlockedHostname('127.0.0.999.example.com')).toBe(false);
  });
});

describe('assertSafeUrl', () => {
  it('허용되는 http(s) 주소는 정규화된 href를 돌려준다', () => {
    expect(assertSafeUrl('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
  });

  it('http(s)가 아닌 스킴을 거부한다', () => {
    expect(() => assertSafeUrl('file:///etc/passwd')).toThrow();
    expect(() => assertSafeUrl('ftp://example.com')).toThrow();
  });

  it('차단 대상 호스트(루프백·링크로컬 등)를 거부한다', () => {
    expect(() => assertSafeUrl('http://127.0.0.1:8080/admin')).toThrow();
    expect(() => assertSafeUrl('http://localhost/')).toThrow();
    expect(() => assertSafeUrl('http://169.254.169.254/latest/meta-data')).toThrow();
  });

  it('유효하지 않은 URL 문자열을 거부한다', () => {
    expect(() => assertSafeUrl('not a url')).toThrow();
  });

  it('사설 대역(학교 인트라넷)은 허용한다', () => {
    expect(assertSafeUrl('http://192.168.0.10/')).toBe('http://192.168.0.10/');
  });
});


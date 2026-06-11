import { describe, it, expect } from 'vitest';
import { isBlockedHostname } from '../netGuard';

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

// 렌더러가 넘긴 URL로 메인 프로세스가 요청을 보낼 때(메타 조회·이미지·스크린샷 등)
// 로컬 서비스로의 우회 접근(SSRF)을 막기 위한 호스트 검사.
// 학교 인트라넷(사설 IP 대역) 자료 조회는 막지 않도록 루프백·링크로컬·0.0.0.0만 차단한다.
// 도메인이 내부 IP로 풀리는 DNS 리바인딩까지는 다루지 않는다(로컬 데스크톱 도구 기준).

function isBlockedIpv4(hostname: string): boolean {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const octets = match.slice(1).map(Number);
  if (octets.some(n => n > 255)) return false; // IP 형식이 아니면 호스트명으로 본다.
  const [a, b] = octets;
  if (a === 127) return true;            // 루프백
  if (a === 0) return true;              // 0.0.0.0/8
  if (a === 169 && b === 254) return true; // 링크로컬
  return false;
}

function isBlockedIpv6(hostname: string): boolean {
  // URL.hostname은 IPv6를 대괄호로 감싼 형태([::1])로 줄 수 있다.
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host.includes(':')) return false;
  if (host === '::' || host === '::1') return true; // 미지정·루프백
  if (host.startsWith('fe8') || host.startsWith('fe9') || host.startsWith('fea') || host.startsWith('feb')) {
    return true; // 링크로컬 fe80::/10
  }
  // IPv4 매핑(::ffff:127.0.0.1) 형태도 확인한다.
  const v4 = host.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (v4) return isBlockedIpv4(v4[1]);
  // 16진 그룹 형태의 IPv4 매핑(::ffff:7f00:1 = 127.0.0.1)은 URL 파서가
  // dotted 형식으로 정규화해 주지 않으므로 직접 IPv4로 환산해 검사한다.
  const hexV4 = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hexV4) {
    const hi = parseInt(hexV4[1], 16);
    const lo = parseInt(hexV4[2], 16);
    const dotted = `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
    return isBlockedIpv4(dotted);
  }
  return false;
}

export function isBlockedHostname(hostname: string): boolean {
  const host = String(hostname || '').trim().toLowerCase().replace(/\.$/, '');
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  return isBlockedIpv4(host) || isBlockedIpv6(host);
}

// http(s) 스킴과 차단 호스트 여부를 함께 검사해 정규화된 URL을 돌려준다.
// 최초 요청 URL뿐 아니라 리다이렉트로 넘어온 각 홉의 URL에도 반드시 다시 호출해야 한다 —
// 그렇지 않으면 최초 주소만 검사하고 리다이렉트로 우회하는 SSRF를 막지 못한다.
export function assertSafeUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('유효하지 않은 URL입니다: ' + String(raw).slice(0, 80));
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || isBlockedHostname(parsed.hostname)) {
    throw new Error('허용되지 않는 주소입니다: ' + parsed.hostname);
  }
  return parsed.href;
}

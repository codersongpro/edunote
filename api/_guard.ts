// 웹판 서버 함수 공용 — 공개 인터넷 서버에서 외부 주소를 대신 요청할 때의 안전장치.
//
// 데스크톱(netGuard.ts)은 학교 인트라넷 자료를 위해 사설 IP를 허용하지만, 공개 서버에서는
// 사설·루프백·링크로컬(클라우드 메타데이터 169.254.169.254 포함)·예약 대역을 모두 막아야 한다.
// DNS 리바인딩(검사 뒤 다른 IP로 바뀌는 공격)을 막기 위해, 검사한 IP로만 실제 연결하도록
// Node http(s) 요청의 lookup을 직접 처리한다. 리다이렉트마다 같은 검사를 반복한다.

import * as dns from 'node:dns';
import * as http from 'node:http';
import * as https from 'node:https';
import * as net from 'node:net';

export class GuardError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

const BLOCKED_V4: Array<[string, number]> = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
];

export function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const n = ipv4ToInt(ip);
    return BLOCKED_V4.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (n & mask) === (ipv4ToInt(base) & mask);
    });
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedIp(mapped[1]);
    if (lower === '::' || lower === '::1') return true;
    if (/^f[cd]/.test(lower)) return true;          // fc00::/7 고유 로컬
    if (/^fe[89ab]/.test(lower)) return true;       // fe80::/10 링크로컬
    if (/^ff/.test(lower)) return true;             // 멀티캐스트
    if (lower.startsWith('64:ff9b:') || lower.startsWith('2001:db8')) return true;
    return false;
  }
  return true;
}

export function parsePublicUrl(raw: unknown): URL {
  if (typeof raw !== 'string' || raw.length > 2048) throw new GuardError('주소가 올바르지 않습니다.');
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new GuardError('주소가 올바르지 않습니다.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new GuardError('http·https 주소만 열 수 있습니다.');
  if (url.username || url.password) throw new GuardError('계정 정보가 포함된 주소는 열 수 없습니다.');
  if (url.port && url.port !== '80' && url.port !== '443') throw new GuardError('기본 포트(80·443) 주소만 열 수 있습니다.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) && isBlockedIp(host)) throw new GuardError('내부 네트워크 주소는 열 수 없습니다.');
  if (/^(localhost|.*\.localhost|.*\.local|.*\.internal)$/i.test(host)) throw new GuardError('내부 네트워크 주소는 열 수 없습니다.');
  return url;
}

// 연결 직전에 실제로 접속할 IP를 검사한다(DNS 리바인딩 방지).
const safeLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return (callback as any)(err);
    const list = addresses as unknown as dns.LookupAddress[];
    const bad = list.find(a => isBlockedIp(a.address));
    if (bad || list.length === 0) return (callback as any)(new GuardError('내부 네트워크 주소는 열 수 없습니다.'));
    if ((options as dns.LookupOptions).all) return (callback as any)(null, list);
    return (callback as any)(null, list[0].address, list[0].family);
  });
};

export interface SafeFetchResult {
  status: number;
  contentType: string;
  body: Buffer;
  finalUrl: string;
}

export interface SafeFetchOptions {
  maxBytes: number;
  timeoutMs: number;
  maxRedirects?: number;
  allowHost?: (hostname: string) => boolean;
  headers?: Record<string, string>;
}

export async function safeFetch(rawUrl: string, options: SafeFetchOptions): Promise<SafeFetchResult> {
  const deadline = Date.now() + options.timeoutMs;
  let current = parsePublicUrl(rawUrl);
  for (let hop = 0; hop <= (options.maxRedirects ?? 5); hop++) {
    if (options.allowHost && !options.allowHost(current.hostname)) throw new GuardError('허용되지 않은 주소입니다.');
    const result = await requestOnce(current, options, deadline);
    if (result.redirect) {
      current = parsePublicUrl(new URL(result.redirect, current).toString());
      continue;
    }
    return { ...result.response!, finalUrl: current.toString() };
  }
  throw new GuardError('리다이렉트가 너무 많습니다.');
}

function requestOnce(
  url: URL,
  options: SafeFetchOptions,
  deadline: number,
): Promise<{ redirect?: string; response?: Omit<SafeFetchResult, 'finalUrl'> }> {
  return new Promise((resolve, reject) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return reject(new GuardError('연결 시간이 초과되었습니다.'));
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(url, {
      method: 'GET',
      lookup: safeLookup,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EduNote-Web)', Accept: '*/*', ...options.headers },
      timeout: remaining,
    }, res => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        return resolve({ redirect: res.headers.location });
      }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > options.maxBytes) {
          req.destroy(new GuardError('응답이 너무 큽니다.'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => resolve({
        response: { status, contentType: String(res.headers['content-type'] ?? ''), body: Buffer.concat(chunks) },
      }));
      res.on('error', reject);
    });
    const timer = setTimeout(() => req.destroy(new GuardError('연결 시간이 초과되었습니다.')), remaining);
    req.on('close', () => clearTimeout(timer));
    req.on('timeout', () => req.destroy(new GuardError('연결 시간이 초과되었습니다.')));
    req.on('error', reject);
    req.end();
  });
}

// ── 응답·남용 방지 공용 ──────────────────────────────────────────────

export function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });
}

export function errorResponse(error: unknown, fallback = '요청을 처리하지 못했습니다.'): Response {
  const message = error instanceof Error && error.message ? error.message : fallback;
  return json({ error: message.slice(0, 500) }, error instanceof GuardError ? error.status : 502);
}

// 같은 사이트(EduNote 웹)에서 온 요청만 받는다 — 다른 사이트가 이 서버를 공짜 프록시로 쓰는 것을 막는다.
// 브라우저가 붙이는 Sec-Fetch-Site / Origin 헤더로 판단한다(서버 간 호출은 Vercel 방화벽 속도 제한으로 막는다).
export function assertSameOrigin(request: Request): void {
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin') throw new GuardError('허용되지 않은 요청입니다.', 403);
  const origin = request.headers.get('origin');
  if (origin) {
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
    try {
      if (!host || new URL(origin).host !== host) throw new GuardError('허용되지 않은 요청입니다.', 403);
    } catch (e) {
      if (e instanceof GuardError) throw e;
      throw new GuardError('허용되지 않은 요청입니다.', 403);
    }
  }
}

// 인스턴스별 간이 속도 제한(분당 요청 수). 근본 대책은 Vercel 방화벽 규칙이며, 이건 보조 장치다.
const buckets = new Map<string, { count: number; resetAt: number }>();
export function rateLimit(request: Request, limitPerMinute: number): void {
  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const now = Date.now();
  const bucket = buckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(ip, { count: 1, resetAt: now + 60_000 });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    return;
  }
  bucket.count += 1;
  if (bucket.count > limitPerMinute) throw new GuardError('요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.', 429);
}

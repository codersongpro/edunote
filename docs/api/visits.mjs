// 랜딩페이지 누적 방문 횟수 — Vercel 함수(랜딩 프로젝트 ednote, Root Directory docs).
//
//   POST /api/visits → 방문 1회 더하고 { count } 반환 (페이지를 열 때마다 호출)
//   GET  /api/visits → 현재 { count }만 반환
//
// 저장소: Upstash Redis(REST). Vercel → Storage에서 Upstash를 연결하면 아래 환경변수가 자동으로 들어온다.
//   KV_REST_API_URL / KV_REST_API_TOKEN  (또는 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN)
// 저장하는 것은 숫자 하나뿐이다. 남용 방지용 IP는 해시로만 2분간 보관하고 원본 IP는 저장하지 않는다.

import { createHash } from 'node:crypto';

const COUNT_KEY = 'landing:visits';
// 집계를 시작하기 전까지의 방문 수. 저장소에는 집계 시작 이후 방문만 쌓고, 보여줄 때 이 값을 더한다.
// (첫 방문이 5,321회로 표시됨)
const BASE_COUNT = 5320;
const RATE_LIMIT_PER_MINUTE = 20; // 같은 IP에서 1분에 20번을 넘으면 더 세지 않는다(새로고침 연타·스크립트 부풀리기 방지)

// 방문을 셀 수 있는 사이트. GitHub Pages 사본(codersongpro.github.io)에서도 같은 숫자를 쓴다.
const ALLOWED_ORIGINS = [
  /^https:\/\/edunote\.songpro\.app$/,
  /^https:\/\/codersongpro\.github\.io$/,
  /^https:\/\/ednote(-[a-z0-9-]+)?\.vercel\.app$/, // Vercel 미리보기 주소
];

const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|curl|wget|python|node-fetch|axios/i;

function redisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

// Upstash REST 파이프라인: 여러 명령을 한 번에 보내고 결과 배열을 받는다.
async function redis(commands) {
  const cfg = redisConfig();
  if (!cfg) throw new Error('not-configured');
  const res = await fetch(cfg.url + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + cfg.token, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error('redis ' + res.status);
  const out = await res.json();
  return out.map(r => {
    if (r.error) throw new Error('redis error');
    return r.result;
  });
}

function allowedOrigin(request) {
  const origin = request.headers.get('origin');
  return origin && ALLOWED_ORIGINS.some(re => re.test(origin)) ? origin : null;
}

function reply(request, data, status = 200) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Origin',
  };
  const origin = allowedOrigin(request);
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return new Response(JSON.stringify(data), { status, headers });
}

function toCount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

async function readCount() {
  const [value] = await redis([['GET', COUNT_KEY]]);
  return BASE_COUNT + toCount(value);
}

export async function GET(request) {
  try {
    return reply(request, { count: await readCount() });
  } catch (e) {
    return reply(request, { error: 'unavailable' }, 503);
  }
}

export async function POST(request) {
  try {
    // 다른 사이트에서 숫자를 부풀리지 못하게, 허용한 사이트의 브라우저 요청만 센다.
    const origin = request.headers.get('origin');
    const ua = request.headers.get('user-agent') || '';
    if (!origin || !allowedOrigin(request) || BOT_UA.test(ua)) {
      return reply(request, { count: await readCount() });
    }

    const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
    const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 16);
    const rlKey = 'landing:rl:' + ipHash + ':' + Math.floor(Date.now() / 60000);

    const [hits] = await redis([['INCR', rlKey], ['EXPIRE', rlKey, 120]]);
    if (toCount(hits) > RATE_LIMIT_PER_MINUTE) {
      return reply(request, { count: await readCount() });
    }
    const [count] = await redis([['INCR', COUNT_KEY]]);
    return reply(request, { count: BASE_COUNT + toCount(count) });
  } catch (e) {
    return reply(request, { error: 'unavailable' }, 503);
  }
}

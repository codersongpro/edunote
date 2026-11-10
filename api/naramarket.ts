// POST /api/naramarket  { kind: 'thng' | 'shopping', keyword, pageNo }  + 헤더 X-Naramarket-Key
// 나라장터(공공데이터포털) OpenAPI는 브라우저 CORS를 허용하지 않아 서버가 중계한다.
// 인증키는 교사 본인 키이며, 이 함수는 받은 키로 요청만 보내고 저장·기록하지 않는다.
import { searchNaramarket } from '../src/main/naramarketClient';
import { GuardError, assertSameOrigin, errorResponse, json, rateLimit, safeFetch } from './_guard';

const MAX_BODY_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    rateLimit(request, 30);
    const serviceKey = (request.headers.get('x-naramarket-key') ?? '').trim();
    if (!serviceKey || serviceKey.length > 500) throw new GuardError('나라장터 인증키가 저장되어 있지 않습니다. 예산안작성 화면에서 키를 먼저 저장해주세요.');
    const input = await request.json().catch(() => null) as { kind?: unknown; keyword?: unknown; pageNo?: unknown } | null;
    const kind = input?.kind === 'shopping' ? 'shopping' : 'thng';
    const keyword = typeof input?.keyword === 'string' ? input.keyword.trim().slice(0, 100) : '';
    const pageNo = Number.isInteger(input?.pageNo) && (input!.pageNo as number) > 0 && (input!.pageNo as number) < 1000 ? input!.pageNo as number : 1;
    if (!keyword) throw new GuardError('검색어를 입력해 주세요.');

    const result = await searchNaramarket(kind, keyword, pageNo, serviceKey, async url => {
      const { status, body } = await safeFetch(url, {
        maxBytes: MAX_BODY_BYTES,
        timeoutMs: 30000,
        allowHost: host => host === 'apis.data.go.kr',
      });
      return { ok: status >= 200 && status < 300, status, body: body.toString('utf-8') };
    });
    return json(result);
  } catch (error) {
    return errorResponse(error, '나라장터 검색에 실패했습니다.');
  }
}

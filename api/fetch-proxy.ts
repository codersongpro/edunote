// GET /api/fetch-proxy?kind=image&url=...   — 외부 이미지 → data URL (자료실 썸네일)
// GET /api/fetch-proxy?kind=json&url=...    — 공유 마켓의 도구 JSON 파일(구글 드라이브 등)
// GET /api/fetch-proxy?kind=market&sheetId= — 공유 마켓 목록(공개 구글 시트 CSV)
// 공개 서버가 아무 주소나 대신 읽어 주는 "열린 프록시"가 되지 않도록, 문서류는 허용된 호스트만 읽는다.
import { GuardError, assertSameOrigin, errorResponse, json, rateLimit, safeFetch } from './_guard';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_JSON_BYTES = 5 * 1024 * 1024;
const MAX_SHEET_BYTES = 5 * 1024 * 1024;

// 공유 마켓 JSON 파일을 둘 수 있는 곳(구글 드라이브·문서, 깃허브 원본 파일).
const SHARED_FILE_HOSTS = [
  /^drive\.google\.com$/i,
  /^docs\.google\.com$/i,
  /^drive\.usercontent\.google\.com$/i,
  /(^|\.)googleusercontent\.com$/i,
  /^raw\.githubusercontent\.com$/i,
  /^gist\.githubusercontent\.com$/i,
];
const isSharedFileHost = (host: string) => SHARED_FILE_HOSTS.some(re => re.test(host));

export async function GET(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const params = new URL(request.url).searchParams;
    const kind = params.get('kind');

    if (kind === 'image') {
      rateLimit(request, 120);
      const { body, contentType, status } = await safeFetch(params.get('url') ?? '', { maxBytes: MAX_IMAGE_BYTES, timeoutMs: 10000 });
      const mime = contentType.split(';')[0].trim().toLowerCase();
      // 이미지가 아닌 응답(로그인 페이지 등)은 넘기지 않는다. SVG는 스크립트를 품을 수 있어 제외한다.
      if (status >= 400 || (mime && (!mime.startsWith('image/') || mime === 'image/svg+xml'))) return json({ dataUrl: null });
      return json({ dataUrl: `data:${mime || 'image/jpeg'};base64,${body.toString('base64')}` });
    }

    if (kind === 'json') {
      rateLimit(request, 30);
      const { body, status } = await safeFetch(params.get('url') ?? '', {
        maxBytes: MAX_JSON_BYTES,
        timeoutMs: 20000,
        allowHost: isSharedFileHost,
      });
      if (status >= 400) throw new GuardError(`파일을 받지 못했습니다(HTTP ${status}).`, 502);
      return json({ text: body.toString('utf-8') });
    }

    if (kind === 'market') {
      rateLimit(request, 30);
      const sheetId = params.get('sheetId') ?? '';
      if (!/^[a-zA-Z0-9_-]{10,200}$/.test(sheetId)) throw new GuardError('시트 ID가 올바르지 않습니다.');
      // 1차: 웹에 게시된 시트, 2차: 링크 공유 시트 (데스크톱 data:fetch-market과 같은 순서)
      const urls = [
        `https://docs.google.com/spreadsheets/d/${sheetId}/pub?output=csv`,
        `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`,
      ];
      let lastError = '';
      for (const url of urls) {
        try {
          const { body, status } = await safeFetch(url, { maxBytes: MAX_SHEET_BYTES, timeoutMs: 15000, allowHost: isSharedFileHost });
          if (status >= 400) { lastError = `HTTP ${status}`; continue; }
          const text = body.toString('utf-8');
          if (text.trimStart().startsWith('<')) { lastError = '시트가 공개되어 있지 않습니다'; continue; }
          return json({ text });
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e);
        }
      }
      throw new GuardError(lastError || '시트를 불러오지 못했습니다', 502);
    }

    throw new GuardError('알 수 없는 요청입니다.');
  } catch (error) {
    return errorResponse(error);
  }
}

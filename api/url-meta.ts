// GET /api/url-meta?url=...&kind=page|youtube
// 자료실 링크 미리보기(제목·설명·대표 이미지)와 유튜브 영상 정보를 가져온다.
// 브라우저는 CORS 때문에 다른 사이트 HTML을 직접 읽을 수 없어 서버가 대신 읽는다(데스크톱 url:fetch-meta와 같은 규칙).
import { assertSameOrigin, errorResponse, json, rateLimit, safeFetch } from './_guard';

const MAX_PAGE_BYTES = 1 * 1024 * 1024;
const MAX_YOUTUBE_BYTES = 2 * 1024 * 1024;

function decodeEntities(text: string): string {
  return text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function metaContent(html: string, attr: 'property' | 'name', value: string): string {
  const a = new RegExp(`<meta[^>]+${attr}=["']${value}["'][^>]+content=["']([^"']+)["']`, 'i');
  const b = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${value}["']`, 'i');
  return (html.match(a)?.[1] ?? html.match(b)?.[1] ?? '').trim();
}

export async function GET(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    rateLimit(request, 60);
    const params = new URL(request.url).searchParams;
    const rawUrl = params.get('url') ?? '';
    const kind = params.get('kind') === 'youtube' ? 'youtube' : 'page';

    if (kind === 'youtube') {
      const videoId = rawUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/)?.[1] || '';
      if (!videoId) return json({ title: '', description: '', thumbnail: '', videoId: '' });
      const thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      const { body } = await safeFetch(`https://www.youtube.com/watch?v=${videoId}`, {
        maxBytes: MAX_YOUTUBE_BYTES,
        timeoutMs: 8000,
        allowHost: host => /(^|\.)youtube\.com$/i.test(host) || /(^|\.)youtu\.be$/i.test(host) || /(^|\.)google\.com$/i.test(host),
      });
      const html = body.toString('utf-8').substring(0, 120000);
      const title = decodeEntities(metaContent(html, 'property', 'og:title') || (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? ''))
        .replace(/\s*[-–—]\s*YouTube\s*$/i, '').trim();
      const description = decodeEntities(metaContent(html, 'property', 'og:description'));
      return json({ title, description, thumbnail, videoId });
    }

    const { body, finalUrl } = await safeFetch(rawUrl, { maxBytes: MAX_PAGE_BYTES, timeoutMs: 8000 });
    const html = body.toString('utf-8').substring(0, 50000);
    const title = decodeEntities((html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? '').trim()).substring(0, 120);
    const description = decodeEntities(metaContent(html, 'property', 'og:description') || metaContent(html, 'name', 'description')).substring(0, 300);
    let image = metaContent(html, 'property', 'og:image');
    try {
      // 상대 경로 이미지는 절대 주소로 바꾼다(브라우저가 다시 이 서버의 이미지 프록시로 받아 간다).
      if (image) image = new URL(image, finalUrl).toString();
    } catch {
      image = '';
    }
    return json({ title, description, image, domain: new URL(rawUrl).hostname });
  } catch (error) {
    return errorResponse(error, '링크 정보를 가져오지 못했습니다.');
  }
}

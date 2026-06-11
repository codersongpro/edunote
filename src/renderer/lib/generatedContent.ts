import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { sanitizeHtml } from './security';

export function stripGeneratedCodeFences(content: string): string {
  let cleaned = String(content ?? '').trim();

  cleaned = cleaned
    .replace(/^```(?:html|xml|markdown|md|text)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(/^'''(?:html|xml|markdown|md|text)?\s*/i, '')
    .replace(/\s*'''$/i, '')
    .trim();

  return cleaned;
}

// HTML에서 순수 텍스트만 추출한다.
// innerHTML 대입 방식과 달리 DOMParser가 만드는 문서는 비활성(inert) 상태라
// 이미지 로딩·onerror 핸들러 등이 실행되지 않는다.
export function extractPlainText(html: string): string {
  const doc = new DOMParser().parseFromString(String(html ?? ''), 'text/html');
  doc.body.querySelectorAll('script, style, template').forEach(el => el.remove());
  return (doc.body.textContent || '').trim();
}

// AI 생성 결과가 HTML인지 마크다운인지 판별해서 HTML로 변환
export function markdownOrHtmlToHtml(content: string): string {
  const stripped = stripGeneratedCodeFences(content);

  // 이미 HTML 태그로 시작하거나 <table>, <ul>, <ol> 등이 포함된 경우 그대로 반환
  if (/^<[a-z][\s\S]*>/i.test(stripped) || /<(table|ul|ol|h[1-6]|p|div|span|br)\b/i.test(stripped)) {
    return sanitizeHtml(stripped);
  }

  // 마크다운 문법이 포함되어 있으면 unified 파이프라인으로 HTML 변환
  const hasMarkdown =
    /\*\*.*?\*\*|\*[^*]+\*/.test(stripped) ||        // bold / italic
    /^\#{1,6}\s/m.test(stripped) ||                   // heading
    /^\|.+\|/m.test(stripped) ||                      // table
    /^[-*+]\s/m.test(stripped) ||                     // unordered list
    /^\d+\.\s/m.test(stripped);                       // ordered list

  if (hasMarkdown) {
    try {
      const result = unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkRehype)
        .use(rehypeStringify)
        .processSync(stripped);
      return sanitizeHtml(String(result));
    } catch {
      return sanitizeHtml(stripped);
    }
  }

  return sanitizeHtml(stripped);
}

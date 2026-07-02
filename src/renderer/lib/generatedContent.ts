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

  // 문서가 HTML 태그로 시작하면 완전한 HTML로 보고 그대로 정제한다.
  if (/^<[a-z][\s\S]*>/i.test(stripped)) {
    return sanitizeHtml(stripped);
  }

  // 마크다운 문법이 포함되어 있으면 마크다운으로 처리한다.
  // (본문 중간에 <br>·<span> 같은 인라인 태그가 섞여 있어도 마크다운을 우선한다 —
  //  인라인 태그 하나만으로 전체를 HTML로 오판해 마크다운이 그대로 노출되던 문제를 막는다.)
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

  // 마크다운이 아니면서 구조적 블록 태그를 포함하면 HTML로 본다.
  if (/<(table|ul|ol|h[1-6]|div|p)\b/i.test(stripped)) {
    return sanitizeHtml(stripped);
  }

  return sanitizeHtml(stripped);
}

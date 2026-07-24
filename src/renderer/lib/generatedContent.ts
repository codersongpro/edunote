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

// AI가 개조식 항목(가./나./다. 등) 사이를 <br> 태그 대신 실제 줄바꿈 문자(\n)만으로
// 구분해 보낼 때가 있다. HWPX 저장은 이 원문 줄바꿈을 그대로 문단 구분에 사용해 정상
// 출력되지만, 브라우저는 일반 흐름(HTML 기본 white-space)에서 줄바꿈·공백류 문자를
// 한 칸으로 접어버리므로 화면 미리보기에서는 모든 항목이 한 줄로 붙어 보인다.
// 태그 경계([<>])가 아닌 실제 텍스트 사이의 줄바꿈만 <br>로 바꿔 이를 보정한다 —
// 태그 앞뒤(예: 표의 <tr>\n<td> 사이)의 서식용 줄바꿈은 건드리지 않는다.
function normalizeBareLineBreaks(html: string): string {
  return html.replace(/([^\s<>])[ \t]*[\r\n]+[ \t]*(?=[^\s<>])/g, '$1<br>');
}

// AI 생성 결과가 HTML인지 마크다운인지 판별해서 HTML로 변환
export function markdownOrHtmlToHtml(content: string): string {
  const stripped = stripGeneratedCodeFences(content);

  // 문서가 HTML 태그로 시작하면 완전한 HTML로 보고 그대로 정제한다.
  // <!DOCTYPE html>은 '!' 때문에 위 [a-z] 패턴에 걸리지 않아 별도로 검사한다 —
  // 이 검사가 없으면 AI가 만든 전체 HTML 문서(문서작성기·워크시트 등)가 아래 마크다운
  // 판별로 새어 나가고, 본문 중 "1. ~" 같은 번호 목록 텍스트 때문에 마크다운으로 오판되어
  // remark가 원시 HTML을 통째로 버리거나(빈 화면) 일부만 escape해 태그가 그대로 노출된다.
  if (/^<[a-z][\s\S]*>/i.test(stripped) || /^<!DOCTYPE\s+html/i.test(stripped)) {
    return sanitizeHtml(normalizeBareLineBreaks(stripped));
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
    return sanitizeHtml(normalizeBareLineBreaks(stripped));
  }

  return sanitizeHtml(normalizeBareLineBreaks(stripped));
}

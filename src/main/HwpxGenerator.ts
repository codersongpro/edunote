import JSZip from 'jszip';
import * as fs from 'fs';
import * as path from 'path';
import { DOMParser } from '@xmldom/xmldom';
import { BLANK_HWPX_BASE64 } from './hwpxSkeleton';

interface HwpxMetadata {
  title?: string;
  date?: string;
  teacher?: string;
  school?: string;
  [key: string]: string | undefined;
}

// 골격 header.xml에 런타임으로 주입하는 스타일 ID (injectHeaderStyles와 일치해야 함).
// 골격(blank.hwpx)의 기존 ID 범위: charPr 0~6, paraPr 0~15, borderFill 1~2.
// 기본 포맷: 제목 22pt 가운데 / 기관명·본문·표 14pt / "1." 수준 15pt /
// "가." 이하 수준은 단계마다 두 칸씩 들여쓰기.
const CHAR_TITLE = '7'; // 22pt 굵게 — 문서 제목(h1)
const CHAR_HEADING = '8'; // 15pt 굵게 — 절 제목(h2~h4)
const CHAR_BOLD = '9'; // 14pt 굵게 — 본문 강조(strong/b, th)
const CHAR_BODY = '10'; // 14pt — 본문 기본
const CHAR_LEVEL1 = '11'; // 15pt — "1." 수준 문단
const PARA_CENTER = '16'; // 가운데 정렬 문단
const PARA_RIGHT = '17'; // 오른쪽 정렬 문단
const OUTLINE_PARAGRAPHS: Record<number, { id: string; left: number; intent: number }> = {
  // 화면에서 쓰는 1~4단계. left는 본문 시작점, intent는 말머리를 내어 쓰는 폭이다.
  1: { id: '18', left: 1200, intent: -1200 },
  2: { id: '19', left: 2000, intent: -1000 },
  3: { id: '20', left: 3200, intent: -1200 },
  4: { id: '21', left: 4000, intent: -1000 },
  // 이전 문서에서 감지하던 추가 단계도 두 칸 간격 정책을 유지한다.
  5: { id: '22', left: 5200, intent: -1200 },
  6: { id: '23', left: 6000, intent: -1000 },
  7: { id: '24', left: 7000, intent: -1000 },
};
const BORDER_TABLE = '3'; // 표 셀 테두리(SOLID)
const BODY_WIDTH = 42520; // 골격 본문 폭 (HWPUNIT)

// 주입 charPr의 글자 크기(HWPUNIT). lineseg 줄 높이 계산에 쓴다.
const CHAR_HEIGHTS: Record<string, number> = {
  [CHAR_TITLE]: 2200,
  [CHAR_HEADING]: 1500,
  [CHAR_LEVEL1]: 1500,
  [CHAR_BOLD]: 1400,
  [CHAR_BODY]: 1400,
};

// 골격 첫 문단에서 추출한, 생성 문단이 따라가는 스타일 정보
interface SectionStyle {
  paraPrIDRef: string;
  styleIDRef: string;
}

function escapeXml(value: string): string {
  return String(value ?? '')
    // XML 1.0에서 허용되지 않는 제어문자 제거 (탭·개행 제외)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// 탭은 텍스트 안에 그대로 두면 한글이 문서를 열지 못한다.
// 한글 원본 파일처럼 <hp:t> 안의 <hp:tab/> 요소로 변환한다.
function tXml(text: string): string {
  return `<hp:t>${escapeXml(text).replace(/\t/g, '<hp:tab/>')}</hp:t>`;
}

function runXml(charPr: string, inner: string): string {
  return `<hp:run charPrIDRef="${charPr}">${inner}</hp:run>`;
}

// 문단의 줄 수를 추정해 줄마다 lineseg를 만든다.
// lineseg가 한 개뿐이면 한글이 긴 문단의 줄들을 같은 자리에 겹쳐 그린다.
// 정확한 줄바꿈 위치는 한글이 편집 시 다시 계산하므로 추정값으로 충분하다.
function linesegArrayXml(runs: string, width: number): string {
  const charPr = runs.match(/charPrIDRef="(\d+)"/)?.[1] ?? CHAR_BODY;
  const h = CHAR_HEIGHTS[charPr] ?? 1000;
  const text = runs
    .replace(/<hp:tbl[\s\S]*?<\/hp:tbl>/g, '') // 표는 셀 안 문단들이 각자 lineseg를 가진다
    .replace(/<hp:tab\/>/g, '　')
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|apos);/g, 'x');
  // 글자 폭 추정: 전각(한글 등) ≈ 글자 크기, 반각 ≈ 절반
  const lineStarts = [0];
  let acc = 0;
  for (let i = 0; i < text.length; i += 1) {
    const w = text.charCodeAt(i) < 0x2000 ? h * 0.52 : h;
    if (acc + w > width && acc > 0) {
      lineStarts.push(i);
      acc = 0;
    }
    acc += w;
  }
  const spacing = Math.round(h * 0.6);
  const segs = lineStarts.map((pos, i) =>
    `<hp:lineseg textpos="${pos}" vertpos="${i * (h + spacing)}" vertsize="${h}" textheight="${h}" baseline="${Math.round(h * 0.85)}" spacing="${spacing}" horzpos="0" horzsize="${width}" flags="393216"/>`,
  );
  return `<hp:linesegarray>${segs.join('')}</hp:linesegarray>`;
}

function paraXml(runs: string, paraPr: string, style: SectionStyle, width = BODY_WIDTH): string {
  const body = runs || runXml(CHAR_BODY, tXml(''));
  return (
    `<hp:p id="0" paraPrIDRef="${paraPr}" styleIDRef="${style.styleIDRef}" pageBreak="0" columnBreak="0" merged="0">` +
    `${body}${linesegArrayXml(body, width)}</hp:p>`
  );
}

// 공문 번호 체계 수준 감지: 1. → 가. → 1) → 가) → (1) → (가) → ①
// 화면에서 쓰는 1~4단계 외에 이전 문서의 추가 단계도 같은 간격 정책으로 보존한다.
const KOREAN_MARKERS = '가나다라마바사아자차카타파하';
function levelOf(text: string): { level: number | null; charPr: string } {
  const t = text.trimStart();
  if (/^\d{1,2}\.(?!\d)/.test(t)) return { level: 1, charPr: CHAR_LEVEL1 };
  if (new RegExp(`^[${KOREAN_MARKERS}]\\.(?!\\d)`).test(t)) return { level: 2, charPr: CHAR_BODY };
  if (/^\d{1,2}\)/.test(t)) return { level: 3, charPr: CHAR_BODY };
  if (new RegExp(`^[${KOREAN_MARKERS}]\\)`).test(t)) return { level: 4, charPr: CHAR_BODY };
  if (/^\(\d{1,2}\)/.test(t)) return { level: 5, charPr: CHAR_BODY };
  if (new RegExp(`^\\([${KOREAN_MARKERS}]\\)`).test(t)) return { level: 6, charPr: CHAR_BODY };
  if (/^[①-⑮㉮-㉻]/.test(t)) return { level: 7, charPr: CHAR_BODY };
  return { level: null, charPr: CHAR_BODY };
}

function explicitOutlineLevel(node: any): number | null {
  const raw = Number(node?.getAttribute?.('data-outline-level'));
  if (OUTLINE_PARAGRAPHS[raw]) return raw;
  for (let i = 0; i < (node?.childNodes?.length || 0); i += 1) {
    const child = node.childNodes.item(i);
    if (!child || child.nodeType !== 1) continue;
    const nested = explicitOutlineLevel(child);
    if (nested) return nested;
  }
  return null;
}

// 강조(bold) 구간이 쓸 charPr — 기본 크기를 유지한 채 굵게만 바꾼다.
function boldCharFor(base: string): string {
  if (base === CHAR_BODY) return CHAR_BOLD;
  if (base === CHAR_LEVEL1) return CHAR_HEADING;
  return base;
}

function htmlToText(content: string): string {
  const normalized = decodeHtmlEntities(dropNonContentBlocks(content))
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|li|tr)>/gi, '\n')
    .replace(/<\/(td|th)>/gi, '\t');

  try {
    const doc = new DOMParser().parseFromString(`<root>${normalized}</root>`, 'text/xml');
    const walk = (node: any): string => {
      if (!node) return '';
      if (node.nodeType === 3) return node.nodeValue || '';
      let text = '';
      for (let i = 0; i < (node.childNodes?.length || 0); i += 1) {
        text += walk(node.childNodes.item(i));
      }
      return text;
    };
    return walk(doc.documentElement)
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+\n/g, '\n')
      .trim();
  } catch {
    return normalized
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}

// HTML 파싱이 실패했을 때 쓰는 평문 폴백 — 서식 없이 줄 단위 문단으로 주입한다.
function makeParagraphs(text: string, style: SectionStyle): string {
  return text
    .split('\n')
    .map(line => paraXml(runXml('0', tXml(line)), style.paraPrIDRef, style))
    .join('');
}

// ---------------------------------------------------------------------------
// HTML → OWPML 변환 (서식 유지)
// 구조 템플릿은 한글 11이 직접 저장한 .hwpx 파일에서 실측해 가져왔다.
// ---------------------------------------------------------------------------

// 블록 요소 — 자식으로 들어 있으면 문단을 나눠 변환한다.
// html·body가 빠져 있으면 AI가 만든 전체 HTML 문서의 본문 전체가
// 한 문단으로 뭉쳐 나오므로 문서 골격 태그도 함께 넣는다.
const BLOCK_TAGS = new Set([
  'html', 'body', 'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'table',
  'blockquote', 'section', 'article', 'header', 'footer', 'main', 'hr',
  'form', 'fieldset', 'nav', 'aside', 'figure', 'figcaption', 'dl', 'pre', 'details',
]);

// ---------------------------------------------------------------------------
// HTML → XML 정규화
// AI가 만든 HTML(과 브라우저가 직렬화한 미리보기 HTML)에는 XML 규칙에 어긋나는
// 곳이 많다. XML 파서는 그런 곳에서 치명적 오류를 내고, 그러면 서식 유지 경로 대신
// 평문 폴백으로 떨어져 표와 서식이 모두 사라진다. 여기서 XML로 읽히게 고친다.
// ---------------------------------------------------------------------------

// 닫는 태그가 없는 HTML 빈 요소 — XML에서는 스스로 닫혀 있어야 한다.
// 워크시트의 <colgroup><col>과 체크박스 <input>이 실제 파싱 실패 원인이었다.
const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

// 본문이 아니므로 내용까지 통째로 버리는 요소.
// <style>의 CSS가 본문 문단으로 새어 나오던 문제를 여기서 막는다.
const DROPPED_TAGS = new Set([
  'style', 'script', 'noscript', 'head', 'title', 'template',
  'svg', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'img',
]);

// 새로 열릴 때 앞의 형제 태그를 암시적으로 닫는 HTML 규칙 (</li>·</td> 생략 대응)
const AUTO_CLOSE: Record<string, string[]> = {
  p: ['p'],
  li: ['li'],
  dt: ['dt', 'dd'],
  dd: ['dt', 'dd'],
  td: ['td', 'th'],
  th: ['td', 'th'],
  tr: ['td', 'th', 'tr'],
  thead: ['td', 'th', 'tr'],
  tbody: ['td', 'th', 'tr', 'thead'],
  tfoot: ['td', 'th', 'tr', 'tbody'],
  option: ['option'],
};

// XML이 기본으로 아는 다섯 개(amp·lt·gt·quot·apos) 외의 이름 있는 엔티티는
// XML 파서가 풀지 못해 "&mdash;"처럼 글자 그대로 남는다. 미리 실제 문자로 바꾼다.
const NAMED_ENTITIES: Record<string, string> = {
  nbsp: '\u00A0', ensp: '\u2002', emsp: '\u2003', thinsp: '\u2009', shy: '',
  mdash: '—', ndash: '–', hellip: '…', middot: '·', bull: '•',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', sbquo: '‚', bdquo: '„',
  prime: '′', Prime: '″', times: '×', divide: '÷', minus: '−', plusmn: '±', sdot: '⋅',
  deg: '°', frac12: '½', frac14: '¼', frac34: '¾', sup2: '²', sup3: '³',
  larr: '←', rarr: '→', uarr: '↑', darr: '↓', harr: '↔',
  le: '≤', ge: '≥', ne: '≠', asymp: '≈', infin: '∞', radic: '√',
  copy: '©', reg: '®', trade: '™', sect: '§', para: '¶',
  dagger: '†', Dagger: '‡', permil: '‰',
  laquo: '«', raquo: '»', euro: '€', pound: '£', yen: '¥', cent: '¢',
  hearts: '♥', diams: '◆', clubs: '♣', spades: '♠',
};

function decodeHtmlEntities(html: string): string {
  return html.replace(/&([A-Za-z][A-Za-z0-9]*);/g, (match, name: string) => {
    const decoded = NAMED_ENTITIES[name];
    return decoded === undefined ? match : decoded;
  });
}

// 본문이 아닌 블록을 내용까지 제거한다.
// 파싱이 실패해 평문 폴백으로 가더라도 CSS가 본문에 섞이지 않게 하는 안전장치다.
function dropNonContentBlocks(html: string): string {
  return String(html ?? '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(style|script|noscript|head|title|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    // 닫는 태그가 없는 <style>·<script>는 그 뒤가 모두 코드이므로 끝까지 버린다
    .replace(/<(style|script)\b[^>]*>[\s\S]*$/i, '');
}

// XML 1.0에서 허용되지 않는 제어문자 제거 (탭·개행 제외)
function stripControlChars(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

function escapeAmpersand(value: string): string {
  return value.replace(/&(?!(?:amp|lt|gt|quot|apos);|#\d+;|#x[0-9A-Fa-f]+;)/g, '&amp;');
}

function escapeAttrValue(value: string): string {
  return escapeAmpersand(stripControlChars(value))
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeTextNode(text: string): string {
  return escapeAmpersand(stripControlChars(text))
    // 태그로 인식되지 않은 부등호(예: "5 < 7")도 텍스트로 살린다
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// 속성을 XML 형태로 다시 쓴다: 이름 소문자화, 값 따옴표 통일,
// 중복 속성 제거(XML은 같은 속성이 두 번 나오면 치명적 오류), 값 없는 속성 보정.
function normalizeAttributes(raw: string): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  const attrRe = /([A-Za-z_:][-A-Za-z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = attrRe.exec(raw))) {
    const name = match[1].toLowerCase();
    if (seen.has(name)) continue;
    seen.add(name);
    const value = match[2] ?? match[3] ?? match[4] ?? name;
    parts.push(` ${name}="${escapeAttrValue(value)}"`);
  }
  return parts.join('');
}

// 태그를 스택으로 훑어 XML로 읽을 수 있는 마크업을 만든다.
// - 빈 요소는 스스로 닫고, 본문이 아닌 요소는 내용까지 버린다
// - 닫히지 않은 태그는 자동으로 닫고, 짝 없는 종료 태그는 버린다
function repairMarkup(html: string): string {
  const out: string[] = [];
  const stack: string[] = [];
  const tagRe = /<\/?([A-Za-z][A-Za-z0-9:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  let dropTag = '';
  let dropDepth = 0;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(html))) {
    if (!dropTag) out.push(escapeTextNode(html.slice(last, match.index)));
    last = tagRe.lastIndex;
    const tag = match[1].toLowerCase();
    const rawAttrs = match[2];
    const closing = match[0].startsWith('</');
    const selfClosed = /\/\s*$/.test(rawAttrs);
    if (dropTag) {
      // 버리는 요소 안이면 같은 이름의 중첩만 세어 끝나는 지점을 찾는다
      if (tag !== dropTag) continue;
      if (closing) dropDepth -= 1;
      else if (!selfClosed && !VOID_TAGS.has(tag)) dropDepth += 1;
      if (dropDepth <= 0) dropTag = '';
      continue;
    }
    if (closing) {
      const openedAt = stack.lastIndexOf(tag);
      if (openedAt < 0) continue; // 짝 없는 종료 태그
      while (stack.length > openedAt) out.push(`</${stack.pop()}>`);
      continue;
    }
    if (DROPPED_TAGS.has(tag)) {
      if (!VOID_TAGS.has(tag) && !selfClosed) {
        dropTag = tag;
        dropDepth = 1;
      }
      continue;
    }
    const attrs = normalizeAttributes(rawAttrs);
    if (VOID_TAGS.has(tag) || selfClosed) {
      out.push(`<${tag}${attrs}/>`);
      continue;
    }
    const closes = AUTO_CLOSE[tag] ?? (BLOCK_TAGS.has(tag) ? ['p'] : []);
    while (stack.length && closes.includes(stack[stack.length - 1])) out.push(`</${stack.pop()}>`);
    out.push(`<${tag}${attrs}>`);
    stack.push(tag);
  }
  out.push(escapeTextNode(html.slice(last)));
  while (stack.length) out.push(`</${stack.pop()}>`);
  return out.join('');
}

function parseHtml(content: string): any | null {
  const normalized = repairMarkup(decodeHtmlEntities(dropNonContentBlocks(content)));
  try {
    const doc = new DOMParser({
      onError: (level: string, msg: string) => {
        if (level === 'fatalError') throw new Error(msg);
      },
    }).parseFromString(`<root>${normalized}</root>`, 'text/xml');
    return doc.documentElement;
  } catch {
    return null;
  }
}

function tagOf(node: any): string {
  return String(node.tagName || '').toLowerCase();
}

function hasBlockChild(node: any): boolean {
  for (let i = 0; i < (node.childNodes?.length || 0); i += 1) {
    const child = node.childNodes.item(i);
    if (child && child.nodeType === 1 && BLOCK_TAGS.has(tagOf(child))) return true;
  }
  return false;
}

function alignOf(el: any): string {
  const styleAttr = String(el.getAttribute?.('style') || '');
  const m = styleAttr.match(/text-align\s*:\s*(center|right|left|justify)/i);
  return (m ? m[1] : String(el.getAttribute?.('align') || '')).toLowerCase();
}

type InlineSeg = { text: string; bold: boolean } | 'break';

// flex 배치는 CSS 간격(gap)으로 항목을 띄우므로 HTML에는 공백이 없다.
// 한글에는 그 간격이 없어 "2학년반:이름:"처럼 붙어 버리므로 한 칸을 넣어 준다.
function isSpacedContainer(node: any): boolean {
  return /display\s*:\s*(?:inline-)?flex/i.test(String(node?.getAttribute?.('style') || ''));
}

function endsWithSpace(out: InlineSeg[]): boolean {
  const last = out[out.length - 1];
  return !last || last === 'break' || /\s$/.test(last.text);
}

// 블록 요소 내부의 인라인 콘텐츠를 (텍스트, 굵게 여부) 조각과 줄바꿈으로 수집한다.
function collectInline(node: any, bold: boolean, out: InlineSeg[]): void {
  const spaced = isSpacedContainer(node);
  for (let i = 0; i < (node.childNodes?.length || 0); i += 1) {
    const child = node.childNodes.item(i);
    if (!child) continue;
    if (child.nodeType === 3) {
      const raw = String(child.nodeValue || '');
      // 태그 사이 들여쓰기용 공백(개행 포함)은 버린다
      if (!raw.trim() && raw.includes('\n')) continue;
      const text = raw.replace(/[\r\n]+\s*/g, ' ');
      if (text) out.push({ text, bold });
      continue;
    }
    if (child.nodeType !== 1) continue;
    const tag = tagOf(child);
    if (tag === 'br') {
      out.push('break');
      continue;
    }
    if (tag === 'input') {
      // 워크시트의 선택 항목 — 한글에는 입력 요소가 없으므로 기호로 남긴다
      const type = String(child.getAttribute?.('type') || '').toLowerCase();
      if (type === 'checkbox') out.push({ text: '☐', bold });
      else if (type === 'radio') out.push({ text: '○', bold });
      continue;
    }
    if (tag === 'style' || tag === 'script' || tag === 'ul' || tag === 'ol' || tag === 'table') continue;
    if (spaced && !endsWithSpace(out)) out.push({ text: ' ', bold });
    collectInline(child, bold || tag === 'b' || tag === 'strong', out);
  }
}

// 인라인 콘텐츠를 <br> 기준으로 나눠 문단들로 만든다.
// 굵은 구간은 별도 run으로 분리한다 (기본 스타일이 이미 굵으면 그대로 둔다).
// 본문 기본 스타일일 때는 줄머리 기호(1., 가., 1)…)로 수준을 감지해
// 들여쓰기와 글자 크기를 정한다.
function inlineParas(
  el: any,
  baseChar: string,
  paraPr: string,
  style: SectionStyle,
  prefix = '',
  width = BODY_WIDTH,
  forcedLevel: number | null = null,
): string[] {
  const segs: InlineSeg[] = [];
  collectInline(el, false, segs);
  const lines: { text: string; bold: boolean }[][] = [[]];
  for (const seg of segs) {
    if (seg === 'break') lines.push([]);
    else lines[lines.length - 1].push(seg);
  }
  if (lines.length > 1 && lines[lines.length - 1].length === 0) lines.pop();
  return lines.map((line, lineIdx) => {
    let lineChar = baseChar;
    let linePara = paraPr;
    const lineText = line.map(seg => seg.text).join('');
    const detectedLevel = forcedLevel ?? explicitOutlineLevel(el) ?? levelOf(lineText).level;
    if (detectedLevel && OUTLINE_PARAGRAPHS[detectedLevel]) {
      linePara = OUTLINE_PARAGRAPHS[detectedLevel].id;
      if (baseChar === CHAR_BODY) lineChar = detectedLevel === 1 ? CHAR_LEVEL1 : CHAR_BODY;
    }
    const runs: string[] = [];
    const alreadyMarked = /^(?:\d{1,2}[.)]|[가-하][.)]|[•▪‣◦-])\s*/.test(lineText.trimStart());
    let buf = lineIdx === 0 && !alreadyMarked ? prefix : '';
    let bufBold = false;
    const flush = () => {
      if (!buf) return;
      runs.push(runXml(bufBold ? boldCharFor(lineChar) : lineChar, tXml(buf)));
      buf = '';
    };
    for (const seg of line) {
      if (seg.bold !== bufBold) flush();
      bufBold = seg.bold;
      buf += seg.text;
    }
    flush();
    return paraXml(runs.join(''), linePara, style, width);
  });
}

function convertList(listEl: any, ordered: boolean, depth: number, style: SectionStyle, out: string[]): void {
  let index = ordered ? Math.max(1, parseInt(listEl.getAttribute?.('start') || '1', 10) || 1) : 1;
  for (let i = 0; i < (listEl.childNodes?.length || 0); i += 1) {
    const li = listEl.childNodes.item(i);
    if (!li || li.nodeType !== 1 || tagOf(li) !== 'li') continue;
    if (ordered) {
      const itemValue = parseInt(li.getAttribute?.('value') || '', 10);
      if (Number.isFinite(itemValue)) index = itemValue;
    }
    const marker = ordered ? `${index}. ` : '• ';
    index += 1;
    out.push(...inlineParas(
      li,
      CHAR_BODY,
      style.paraPrIDRef,
      style,
      marker,
      BODY_WIDTH,
      Math.min(depth + 1, 7),
    ));
    // li 안의 중첩 목록은 들여쓰기를 늘려 이어서 처리한다
    for (let j = 0; j < (li.childNodes?.length || 0); j += 1) {
      const nested = li.childNodes.item(j);
      if (nested && nested.nodeType === 1 && (tagOf(nested) === 'ul' || tagOf(nested) === 'ol')) {
        convertList(nested, tagOf(nested) === 'ol', depth + 1, style, out);
      }
    }
  }
}

// HTML 표 → <hp:tbl>. 속성 구성은 한글 원본 파일의 표에서 실측한 값을 따른다.
function convertTable(tableEl: any, style: SectionStyle, ids: { tbl: number }): string {
  const rows: any[] = [];
  const gatherRows = (el: any): void => {
    for (let i = 0; i < (el.childNodes?.length || 0); i += 1) {
      const child = el.childNodes.item(i);
      if (!child || child.nodeType !== 1) continue;
      const tag = tagOf(child);
      if (tag === 'tr') rows.push(child);
      else if (tag === 'thead' || tag === 'tbody' || tag === 'tfoot') gatherRows(child);
    }
  };
  gatherRows(tableEl);
  if (!rows.length) return '';

  // colspan/rowspan을 반영해 셀의 그리드 좌표(cellAddr)를 계산한다
  type CellInfo = { el: any; row: number; col: number; colSpan: number; rowSpan: number; isHeader: boolean };
  const occupied: boolean[][] = rows.map(() => []);
  const cells: CellInfo[] = [];
  let colCnt = 0;
  rows.forEach((tr, r) => {
    let c = 0;
    for (let i = 0; i < (tr.childNodes?.length || 0); i += 1) {
      const cell = tr.childNodes.item(i);
      if (!cell || cell.nodeType !== 1) continue;
      const tag = tagOf(cell);
      if (tag !== 'td' && tag !== 'th') continue;
      while (occupied[r][c]) c += 1;
      const colSpan = Math.max(1, parseInt(cell.getAttribute?.('colspan') || '1', 10) || 1);
      const rowSpan = Math.max(1, parseInt(cell.getAttribute?.('rowspan') || '1', 10) || 1);
      for (let rr = r; rr < Math.min(r + rowSpan, rows.length); rr += 1) {
        for (let cc = c; cc < c + colSpan; cc += 1) occupied[rr][cc] = true;
      }
      cells.push({ el: cell, row: r, col: c, colSpan, rowSpan, isHeader: tag === 'th' });
      colCnt = Math.max(colCnt, c + colSpan);
      c += colSpan;
    }
  });
  if (!colCnt) return '';

  const colWidth = Math.floor(BODY_WIDTH / colCnt);
  const rowXmls = rows.map((_, r) => {
    const tcXmls = cells
      .filter(cell => cell.row === r)
      .map(cell => {
        // 셀 안 문단의 줄바꿈 추정 폭 = 셀 폭 − 좌우 안쪽 여백(510×2)
        const cellWidth = Math.max(2000, colWidth * cell.colSpan - 1020);
        const inner: string[] = [];
        if (hasBlockChild(cell.el)) {
          convertBlocks(cell.el, style, inner, ids);
        } else {
          inner.push(
            ...inlineParas(
              cell.el,
              cell.isHeader ? CHAR_BOLD : CHAR_BODY,
              cell.isHeader ? PARA_CENTER : style.paraPrIDRef,
              style,
              '',
              cellWidth,
            ),
          );
        }
        const paras = inner.join('') || paraXml('', style.paraPrIDRef, style, cellWidth);
        return (
          `<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="${BORDER_TABLE}">` +
          `<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">${paras}</hp:subList>` +
          `<hp:cellAddr colAddr="${cell.col}" rowAddr="${cell.row}"/>` +
          `<hp:cellSpan colSpan="${cell.colSpan}" rowSpan="${cell.rowSpan}"/>` +
          `<hp:cellSz width="${colWidth * cell.colSpan}" height="1000"/>` +
          `<hp:cellMargin left="510" right="510" top="141" bottom="141"/></hp:tc>`
        );
      });
    return `<hp:tr>${tcXmls.join('')}</hp:tr>`;
  });

  const tblId = ids.tbl;
  ids.tbl += 1;
  const tbl =
    `<hp:tbl id="${tblId}" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="1" rowCnt="${rows.length}" colCnt="${colCnt}" cellSpacing="0" borderFillIDRef="${BORDER_TABLE}" noAdjust="0">` +
    `<hp:sz width="${BODY_WIDTH}" widthRelTo="ABSOLUTE" height="${rows.length * 1000}" heightRelTo="ABSOLUTE" protect="0"/>` +
    `<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>` +
    `<hp:outMargin left="283" right="283" top="283" bottom="283"/>` +
    `<hp:inMargin left="510" right="510" top="141" bottom="141"/>` +
    `${rowXmls.join('')}</hp:tbl>`;
  // 표는 문단의 run 안에 글자처럼(treatAsChar) 배치된다
  return paraXml(runXml(CHAR_BODY, tbl), style.paraPrIDRef, style);
}

// 블록 요소들을 순회하며 OWPML 문단/표 XML을 만든다.
function convertBlocks(node: any, style: SectionStyle, out: string[], ids: { tbl: number }): void {
  for (let i = 0; i < (node.childNodes?.length || 0); i += 1) {
    const child = node.childNodes.item(i);
    if (!child) continue;
    if (child.nodeType === 3) {
      const text = String(child.nodeValue || '').trim();
      if (text) {
        const level = levelOf(text);
        const paraPr = level.level ? OUTLINE_PARAGRAPHS[level.level].id : style.paraPrIDRef;
        out.push(paraXml(runXml(level.charPr, tXml(text)), paraPr, style));
      }
      continue;
    }
    if (child.nodeType !== 1) continue;
    const tag = tagOf(child);
    if (tag === 'style' || tag === 'script') continue;
    if (tag === 'h1') {
      out.push(...inlineParas(child, CHAR_TITLE, PARA_CENTER, style));
      continue;
    }
    if (tag === 'h2' || tag === 'h3' || tag === 'h4') {
      const tagLevel = explicitOutlineLevel(child);
      out.push(...inlineParas(
        child,
        tag === 'h2' ? CHAR_HEADING : CHAR_BODY,
        style.paraPrIDRef,
        style,
        '',
        BODY_WIDTH,
        tagLevel,
      ));
      continue;
    }
    if (tag === 'table') {
      const tbl = convertTable(child, style, ids);
      if (tbl) out.push(tbl);
      continue;
    }
    if (tag === 'ul' || tag === 'ol') {
      convertList(child, tag === 'ol', 0, style, out);
      continue;
    }
    if (tag === 'br' || tag === 'hr') {
      out.push(paraXml('', style.paraPrIDRef, style));
      continue;
    }
    if (hasBlockChild(child)) {
      convertBlocks(child, style, out, ids);
      continue;
    }
    const align = alignOf(child);
    const paraPr = align === 'center' ? PARA_CENTER : align === 'right' ? PARA_RIGHT : style.paraPrIDRef;
    out.push(...inlineParas(child, CHAR_BODY, paraPr, style));
  }
}

// 골격 header.xml에 제목/강조 charPr, 정렬 paraPr, 표 테두리 borderFill을 추가한다.
// 골격 항목을 복제·변형하므로 골격에 정의된 폰트·스타일 참조가 그대로 유지된다.
// 실패하면 null을 돌려주고, 호출부는 서식 없는 평문 경로로 폴백한다.
function injectHeaderStyles(header: string, basePara: string): string | null {
  if (
    header.includes(`<hh:charPr id="${CHAR_TITLE}"`) ||
    header.includes(`<hh:paraPr id="${PARA_CENTER}"`) ||
    header.includes(`<hh:borderFill id="${BORDER_TABLE}"`)
  ) {
    return null; // 골격이 바뀌어 ID가 충돌하면 서식 주입을 포기한다
  }
  const charPr0 = header.match(/<hh:charPr id="0"[\s\S]*?<\/hh:charPr>/)?.[0];
  const paraPrBase = header.match(new RegExp(`<hh:paraPr id="${basePara}"[\\s\\S]*?</hh:paraPr>`))?.[0];
  const borderFill1 = header.match(/<hh:borderFill id="1"[\s\S]*?<\/hh:borderFill>/)?.[0];
  if (!charPr0 || !paraPrBase || !borderFill1 || !charPr0.includes('<hh:underline')) return null;

  // 한글 원본 파일 기준으로 <hh:bold/>는 <hh:offset/> 뒤, <hh:underline/> 앞에 놓인다
  const mkChar = (id: string, height: string, bold: boolean) => {
    const sized = charPr0
      .replace('id="0"', `id="${id}"`)
      .replace(/height="\d+"/, `height="${height}"`);
    return bold ? sized.replace('<hh:underline', '<hh:bold/><hh:underline') : sized;
  };
  const mkPara = (id: string, align: string) =>
    paraPrBase
      .replace(`id="${basePara}"`, `id="${id}"`)
      .replace(/horizontal="[A-Z_]+"/, `horizontal="${align}"`);
  const mkOutlinePara = (id: string, left: number, intent: number) =>
    mkPara(id, 'JUSTIFY')
      .replace(/<hc:intent value="-?\d+"/g, `<hc:intent value="${intent}"`)
      .replace(/<hc:left value="-?\d+"/g, `<hc:left value="${left}"`);
  const tableBorder = borderFill1
    .replace('id="1"', `id="${BORDER_TABLE}"`)
    .replace(/<hh:(leftBorder|rightBorder|topBorder|bottomBorder) type="NONE"/g, '<hh:$1 type="SOLID"');

  const newChars =
    mkChar(CHAR_TITLE, '2200', true) +
    mkChar(CHAR_HEADING, '1500', true) +
    mkChar(CHAR_BOLD, '1400', true) +
    mkChar(CHAR_BODY, '1400', false) +
    mkChar(CHAR_LEVEL1, '1500', false);
  const outlineParas = Object.values(OUTLINE_PARAGRAPHS)
    .map(({ id, left, intent }) => mkOutlinePara(id, left, intent))
    .join('');
  return header
    .replace('</hh:charProperties>', `${newChars}</hh:charProperties>`)
    .replace('</hh:paraProperties>', `${mkPara(PARA_CENTER, 'CENTER')}${mkPara(PARA_RIGHT, 'RIGHT')}${outlineParas}</hh:paraProperties>`)
    .replace('</hh:borderFills>', `${tableBorder}</hh:borderFills>`)
    .replace(/<hh:charProperties itemCnt="(\d+)">/, (_m, n) => `<hh:charProperties itemCnt="${Number(n) + 5}">`)
    .replace(/<hh:paraProperties itemCnt="(\d+)">/, (_m, n) => `<hh:paraProperties itemCnt="${Number(n) + 2 + Object.keys(OUTLINE_PARAGRAPHS).length}">`)
    .replace(/<hh:borderFills itemCnt="(\d+)">/, (_m, n) => `<hh:borderFills itemCnt="${Number(n) + 1}">`);
}

// 원본 zip의 항목을 순서 그대로 새 zip에 복사한다 (수정된 항목만 교체).
// 한글 원본 파일과 동일하게 mimetype·version.xml은 무압축(STORE) 첫 항목들로,
// 나머지는 DEFLATE로 저장한다 — mimetype이 압축되면 한글이 파일을 열지 못한다.
async function repackZip(source: JSZip, replaced: Map<string, string>): Promise<Buffer> {
  const out = new JSZip();
  for (const name of Object.keys(source.files)) {
    const entry = source.files[name];
    if (entry.dir) continue;
    const content = replaced.has(name) ? replaced.get(name)! : await entry.async('uint8array');
    out.file(name, content, {
      createFolders: false,
      compression: name === 'mimetype' || name === 'version.xml' ? 'STORE' : 'DEFLATE',
    });
  }
  return out.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

// 한글이 만든 빈 문서 골격에 본문·메타를 주입해 HWPX 버퍼를 만든다.
export async function buildHwpxZip(_title: string, content: string, meta: HwpxMetadata): Promise<Buffer> {
  const skeleton = await JSZip.loadAsync(Buffer.from(BLANK_HWPX_BASE64, 'base64'));
  const sectionPath = 'Contents/section0.xml';
  const headerPath = 'Contents/header.xml';
  const sectionXml = await skeleton.file(sectionPath)!.async('string');
  const headerXml = await skeleton.file(headerPath)!.async('string');

  // 골격 첫 문단의 속성을 그대로 따라간다 (header.xml에 정의된 ID 보장)
  const firstPara = sectionXml.match(/<hp:p [^>]*paraPrIDRef="(\d+)"[^>]*styleIDRef="(\d+)"/);
  const style: SectionStyle = {
    paraPrIDRef: firstPara?.[1] ?? '0',
    styleIDRef: firstPara?.[2] ?? '0',
  };

  const metaLines = Object.entries(meta)
    .filter(([key, value]) => key !== 'title' && value)
    .map(([key, value]) => `${key}: ${value}`);

  const newHeaderXml = injectHeaderStyles(headerXml, style.paraPrIDRef);
  const root = newHeaderXml ? parseHtml(content) : null;

  let bodyXml: string;
  if (root) {
    const out: string[] = [];
    // 본문은 미리보기(content)와 동일하게 변환한다.
    // 파일명용 title을 문서 제목 문단으로 따로 주입하지 않는다 —
    // 본문에 없는 "생성문서" 같은 가짜 제목이 생기는 문제를 막는다.
    for (const line of metaLines) out.push(paraXml(runXml(CHAR_BODY, tXml(line)), style.paraPrIDRef, style));
    convertBlocks(root, style, out, { tbl: 1 });
    bodyXml = out.join('');
  } else {
    const bodyText = [metaLines.join('\n'), htmlToText(content)].filter(Boolean).join('\n');
    bodyXml = makeParagraphs(bodyText, style);
  }

  const closeTag = '</hs:sec>';
  if (!sectionXml.includes(closeTag)) throw new Error('HWPX 골격 문서 형식이 올바르지 않습니다.');
  const newSectionXml = sectionXml.replace(closeTag, `${bodyXml}${closeTag}`);

  const replaced = new Map([[sectionPath, newSectionXml]]);
  if (newHeaderXml && root) replaced.set(headerPath, newHeaderXml);
  return repackZip(skeleton, replaced);
}

export async function generateHwpx(
  templateName: string,
  content: string,
  meta: HwpxMetadata,
  savePath: string,
): Promise<void> {
  const title = meta.title || templateName;
  const buf = await buildHwpxZip(title, content, meta);
  const dir = path.dirname(savePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(savePath, buf);
}

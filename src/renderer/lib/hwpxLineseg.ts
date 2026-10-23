// 서식 유지 HWPX 저장에서 글자가 바뀐 문단의 줄 배치 정보(<hp:linesegarray>)를 다시 만든다.
//
// 한글은 파일을 열 때 문단의 줄 수를 lineseg 그대로 믿고 그린다. 글자 수가 달라져 줄 수가
// 바뀐 문단을 그대로 두면 줄이 겹치거나 비어 보인다. (main/HwpxGenerator의 linesegArrayXml 주석 참고:
// 정확한 줄바꿈은 한글이 편집할 때 다시 계산하므로 줄 수와 시작 위치는 추정값이면 충분하다.)
// XML을 다시 직렬화하지 않고 바뀐 문단의 linesegarray 문자열만 갈아 끼워, 나머지는 바이트까지 그대로 둔다.

// 단락 시작(<hp:p ...>, 자기 닫힘 제외)·끝, 글자 노드, 줄 배치 정보를 문서 순서대로 훑는다.
const LAYOUT_TOKENS = () =>
  /(<hp:p(?:\s[^>]*)?(?<!\/)>)|(<\/hp:p>)|<hp:t(?:\s[^>]*)?(?<!\/)>([\s\S]*?)<\/hp:t>|(<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>)/g;

// 글자 노드 속 하위 태그(<hp:tab/>, <hp:fwSpace/> 등)는 한 글자 자리를 차지한다. lineseg의 textpos도 이렇게 센다.
const CHILD_TAG_MARK = '　';

function layoutText(content: string): string {
  return content
    .replace(/<[^>]*>/g, CHILD_TAG_MARK)
    .replace(/&#10;/g, '\n')
    .replace(/&(?:lt|gt|amp|quot|apos);/g, 'x');
}

interface ParagraphLayout {
  text: string;
  /** 이 문단에 직접 딸린 linesegarray 위치. 없으면 null */
  lineseg: { start: number; end: number; xml: string } | null;
}

// 각 글자 노드와 linesegarray가 "직접 속한" 문단을 정한다. 표 칸 안의 문단은 바깥 문단과 따로 센다.
export function readParagraphLayouts(xml: string): ParagraphLayout[] {
  const paragraphs: ParagraphLayout[] = [];
  const stack: number[] = [];
  for (const m of xml.matchAll(LAYOUT_TOKENS())) {
    if (m[1]) {
      stack.push(paragraphs.length);
      paragraphs.push({ text: '', lineseg: null });
    } else if (m[2]) {
      stack.pop();
    } else if (m[4]) {
      const owner = stack[stack.length - 1];
      if (owner !== undefined) paragraphs[owner].lineseg = { start: m.index!, end: m.index! + m[0].length, xml: m[4] };
    } else {
      const owner = stack[stack.length - 1];
      if (owner !== undefined) paragraphs[owner].text += layoutText(m[3] ?? '');
    }
  }
  return paragraphs;
}

const attr = (seg: string, name: string): number => Number(seg.match(new RegExp(`\\b${name}="(-?\\d+)"`))?.[1] ?? NaN);
const setAttr = (seg: string, name: string, value: number) => seg.replace(new RegExp(`\\b${name}="-?\\d+"`), `${name}="${value}"`);

// 글자 폭 추정: 전각(한글·한자·전각 기호)은 글자 높이, 반각은 그 0.52배 — HwpxGenerator와 같은 규칙
function charWidth(ch: string, height: number): number {
  return ch.charCodeAt(0) < 0x2000 ? height * 0.52 : height;
}

// 새 글자에 맞춰 linesegarray를 다시 만든다. 줄마다 원본 같은 순번 줄의 속성(들여쓰기 폭·글자 높이·
// 줄 간격·flags)을 그대로 쓰고, 원본보다 줄이 많아지면 원본의 마지막 줄을 복사한다.
export function rebuildLinesegArray(oldText: string, newText: string, linesegXml: string): string {
  const segs = linesegXml.match(/<hp:lineseg\b[^>]*\/>/g) ?? [];
  if (segs.length === 0) return linesegXml;
  const first = segs[0];
  const height = attr(first, 'textheight') || attr(first, 'vertsize') || 1000;

  // 원본 첫 줄은 꽉 찬 줄이므로, 문단 폭 ÷ 첫 줄 추정 폭으로 이 문서의 글꼴 폭에 맞춘다.
  let scale = 1;
  const secondStart = segs.length > 1 ? attr(segs[1], 'textpos') : NaN;
  if (secondStart > 0) {
    const estimated = [...oldText.slice(0, secondStart)].reduce((sum, ch) => sum + charWidth(ch, height), 0);
    if (estimated > 0) scale = Math.min(2, Math.max(0.5, attr(first, 'horzsize') / estimated));
  }

  const template = (line: number) => segs[Math.min(line, segs.length - 1)];
  const chars = [...newText];
  const widths = chars.map(ch => charWidth(ch, height) * scale);
  const starts = [0];
  let lineStart = 0;
  let acc = 0;
  for (let i = 0; i < chars.length; i += 1) {
    const lineWidth = attr(template(starts.length - 1), 'horzsize') || attr(first, 'horzsize');
    if (acc + widths[i] > lineWidth && acc > 0) {
      // 한글은 어절(띄어쓰기) 단위로 줄을 바꾼다. 넘친 글자가 공백이면 그 공백까지 윗줄에 두고,
      // 아니면 줄 안의 마지막 공백 다음에서 나눈다. 공백이 없으면 글자 단위로 나눈다.
      let breakAt = i;
      if (chars[i] === ' ') breakAt = i + 1;
      else {
        const lastSpace = chars.lastIndexOf(' ', i - 1);
        if (lastSpace >= lineStart && lastSpace + 1 > lineStart) breakAt = lastSpace + 1;
      }
      starts.push(breakAt);
      lineStart = breakAt;
      acc = 0;
      for (let j = breakAt; j < i; j += 1) acc += widths[j];
      if (breakAt > i) continue;
    }
    acc += widths[i];
  }

  const firstVert = attr(first, 'vertpos');
  const step = segs.length > 1
    ? attr(segs[1], 'vertpos') - firstVert
    : (attr(first, 'vertsize') || height) + (attr(first, 'spacing') || 0);
  const rebuilt = starts.map((pos, line) => setAttr(setAttr(template(line), 'textpos', pos), 'vertpos', firstVert + line * step));
  return `<hp:linesegarray>${rebuilt.join('')}</hp:linesegarray>`;
}

// 원본과 바꾼 섹션 XML을 비교해, 글자 수가 달라진 문단의 linesegarray만 다시 만든다.
// 글자 수가 같으면(날짜·숫자 바꾸기 대부분) 원본 lineseg를 그대로 둔다.
export function relayoutChangedParagraphs(originalXml: string, updatedXml: string): string {
  const before = readParagraphLayouts(originalXml);
  const after = readParagraphLayouts(updatedXml);
  if (before.length !== after.length) return updatedXml;
  let xml = updatedXml;
  for (let i = after.length - 1; i >= 0; i -= 1) {
    const now = after[i];
    if (!now.lineseg || now.text.length === before[i].text.length) continue;
    const next = rebuildLinesegArray(before[i].text, now.text, now.lineseg.xml);
    xml = xml.slice(0, now.lineseg.start) + next + xml.slice(now.lineseg.end);
  }
  return xml;
}

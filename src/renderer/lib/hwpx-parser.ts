import JSZip from "jszip";

export interface HwpxFillNode {
  idx: number;
  value: string;
}

// 글자 노드 <hp:t>…</hp:t>만 정확히 찾는다.
// - <hp:t/>(빈 글자 노드), <hp:tbl>·<hp:tr>·<hp:tc>·<hp:tab/>·<hp:textMargin/>은 이름이 hp:t로
//   시작하지만 글자 노드가 아니다. 예전 /<hp:t[^>]*>/는 이들까지 잡아 다음 </hp:t>까지의
//   태그를 통째로 글자로 바꿔 버렸고, 그 결과 저장한 HWPX가 손상됐다.
// 추출(extract*)과 채우기(fillHwpxTemplate)가 반드시 같은 패턴을 써야 노드 번호가 맞는다.
const TEXT_NODE = () => /(<hp:t(?:\s[^>]*)?(?<!\/)>)([\s\S]*?)(<\/hp:t>)/g;
// 문단 시작 태그 (<hp:pic>·<hp:parameterset> 등은 제외)
const PARAGRAPH_OPEN = () => /<hp:p[\s>]/g;

function decodeXmlText(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#10;/g, '\n')
    .replace(/&amp;/g, '&');
}

function encodeXmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/\n/g, '&#10;');
}

// 글자 노드 안에는 <hp:tab/>, <hp:lineBreak/> 같은 하위 태그가 섞일 수 있다.
// 태그는 그대로 두고 글자 조각만 다룬다.
type Segment = { kind: 'tag'; raw: string } | { kind: 'text'; text: string };

function splitSegments(content: string): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  for (const m of content.matchAll(/<[^>]*>/g)) {
    if (m.index! > last) segments.push({ kind: 'text', text: decodeXmlText(content.slice(last, m.index)) });
    segments.push({ kind: 'tag', raw: m[0] });
    last = m.index! + m[0].length;
  }
  if (last < content.length) segments.push({ kind: 'text', text: decodeXmlText(content.slice(last)) });
  return segments;
}

function plainText(content: string): string {
  return splitSegments(content).map(s => (s.kind === 'tag' ? '' : s.text)).join('');
}

// 하위 태그를 지키면서 글자만 newValue로 바꾼다. 앞뒤 공통 글자는 그대로 두고
// 달라진 가운데 부분만 원래 글자 조각 자리에 넣는다.
export function replaceTextKeepingTags(content: string, newValue: string): string {
  const segments = splitSegments(content);
  if (!segments.some(s => s.kind === 'tag')) return encodeXmlText(newValue);

  const old = segments.map(s => (s.kind === 'tag' ? '' : s.text)).join('');
  if (old === newValue) return content;
  let prefix = 0;
  while (prefix < old.length && prefix < newValue.length && old[prefix] === newValue[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < old.length - prefix && suffix < newValue.length - prefix
    && old[old.length - 1 - suffix] === newValue[newValue.length - 1 - suffix]
  ) suffix += 1;
  const cutStart = prefix;
  const cutEnd = old.length - suffix;
  const insert = newValue.slice(prefix, newValue.length - suffix);

  let offset = 0;
  let inserted = false;
  const out: string[] = [];
  for (const seg of segments) {
    if (seg.kind === 'tag') {
      out.push(seg.raw);
      continue;
    }
    const start = offset;
    const end = offset + seg.text.length;
    offset = end;
    let text = '';
    for (let i = start; i < end; i += 1) {
      if (i === cutStart && !inserted) { text += insert; inserted = true; }
      if (i < cutStart || i >= cutEnd) text += seg.text[i - start];
    }
    if (!inserted && end === cutStart && cutStart === cutEnd) { text += insert; inserted = true; }
    out.push(encodeXmlText(text));
  }
  if (!inserted) out.push(encodeXmlText(insert));
  return out.join('');
}

function sortedSectionFiles(zip: JSZip): string[] {
  return Object.keys(zip.files)
    .filter((name) => /^Contents\/section\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/section(\d+)/i)?.[1] || "0");
      const numB = parseInt(b.match(/section(\d+)/i)?.[1] || "0");
      return numA - numB;
    });
}

export interface HwpxTextDocument {
  /** 글자 노드. 번호는 fillHwpxTemplate의 노드 번호와 같다 */
  nodes: string[];
  /** 각 노드가 속한 문단 번호(문서 전체 기준). 본문을 문단 단위로 보여 줄 때 쓴다 */
  paragraphOf: number[];
}

async function readTextDocument(zip: JSZip): Promise<HwpxTextDocument> {
  const sectionFiles = sortedSectionFiles(zip);
  if (sectionFiles.length === 0) throw new Error("HWPX 본문(Contents/section.xml)을 찾을 수 없습니다.");
  const nodes: string[] = [];
  const paragraphOf: number[] = [];
  let paragraphBase = 0;
  for (const sectionPath of sectionFiles) {
    const xml = await zip.file(sectionPath)!.async("string");
    const opens = [...xml.matchAll(PARAGRAPH_OPEN())].map(m => m.index!);
    let p = 0;
    for (const match of xml.matchAll(TEXT_NODE())) {
      while (p < opens.length && opens[p] < match.index!) p += 1;
      nodes.push(plainText(match[2]));
      paragraphOf.push(paragraphBase + Math.max(0, p - 1));
    }
    paragraphBase += opens.length + 1;
  }
  return { nodes, paragraphOf };
}

export async function extractTextFromHwpx(file: File): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    if (sortedSectionFiles(zip).length === 0) {
      return "[알림: HWPX 파일 내에서 본문(Contents/section.xml)을 찾을 수 없습니다.]";
    }
    const { nodes } = await readTextDocument(zip);
    if (!nodes.some(node => node.trim())) {
      return "[알림: HWPX 파일에서 텍스트를 추출하지 못했습니다. 문서가 이미지로만 구성되어 있거나 특수한 형식일 수 있습니다.]";
    }
    // 빈 노드도 번호를 지켜야 fillHwpxTemplate과 번호가 맞는다
    return "[HWPX 구조화된 텍스트 노드 목록]\n"
      + nodes.map((content, idx) => (content.trim() ? `[${idx}] "${content}"` : `[${idx}] (빈칸)`)).join('\n') + '\n';
  } catch (error: any) {
    // HWPX 파일이 아닌 경우 (예: HWP 파일을 확장자만 바꾼 경우, 혹은 파일 손상 등)
    return `[알림: 문서에서 텍스트를 추출할 수 없습니다.
- 파일이 구형 HWP(바이너리) 형식일 경우 추출이 제한될 수 있습니다. 가능하면 HWPX 또는 PDF로 변환하여 업로드해 주세요.
- 파일이 손상되었을 수 있습니다.
AI는 문서의 파일명(${file.name})은 인지하지만, 내용은 정확히 분석하지 못할 수 있습니다.]`;
  }
}

// 글자 노드와 문단 구성을 함께 돌려준다. HWPX가 아니거나 손상된 파일이면 예외를 던진다.
export async function extractHwpxTextDocument(file: File): Promise<HwpxTextDocument> {
  return readTextDocument(await JSZip.loadAsync(await file.arrayBuffer()));
}

export async function extractHwpxTextNodes(file: File): Promise<string[]> {
  return (await extractHwpxTextDocument(file)).nodes;
}

function isWellFormed(xml: string): boolean {
  if (typeof DOMParser === 'undefined') return true;
  return new DOMParser().parseFromString(xml, 'application/xml').getElementsByTagName('parsererror').length === 0;
}

// 고친 섹션 XML이 원본처럼 올바른지 확인한다. 깨진 XML로 저장하면 한글이 파일을 열지 못하므로
// 저장 전에 막는다. (DOMParser가 없는 환경에서는 검사를 건너뛴다)
function assertStillWellFormed(original: string, xml: string, name: string): void {
  if (isWellFormed(original) && !isWellFormed(xml)) {
    throw new Error(`HWPX 문서 구조(${name})를 지키지 못해 저장을 멈췄습니다. 원본 파일은 바뀌지 않았습니다.`);
  }
}

export async function fillHwpxTemplate(file: File, fillData: HwpxFillNode[]): Promise<Blob> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const fillMap = new Map<number, string>();
  fillData.forEach(item => fillMap.set(Number(item.idx), String(item.value)));

  let globalIdx = 0;
  const replaced = new Map<string, string>();
  for (const sectionPath of sortedSectionFiles(zip)) {
    const sectionFile = zip.file(sectionPath);
    if (!sectionFile) continue;
    const original = await sectionFile.async("string");
    let changed = false;
    const xml = original.replace(TEXT_NODE(), (match, openTag, content, closeTag) => {
      const currentIdx = globalIdx++;
      if (!fillMap.has(currentIdx)) return match;
      changed = true;
      return `${openTag}${replaceTextKeepingTags(content, fillMap.get(currentIdx)!)}${closeTag}`;
    });
    if (!changed) continue;
    assertStillWellFormed(original, xml, sectionPath);
    replaced.set(sectionPath, xml);
  }

  // 원본 zip을 직접 수정하지 않고 항목을 순서 그대로 새 zip에 복사한다.
  // 기존 방식(zip.file 후 generateAsync)은 원본에 없던 폴더 항목('Contents/')을
  // 추가해 한글이 파일을 열지 못하는 원인이 됐다. 압축 방식도 한글이 만드는
  // 파일과 동일하게 모든 항목 DEFLATE로 맞춘다.
  const out = new JSZip();
  for (const name of Object.keys(zip.files)) {
    const entry = zip.files[name];
    if (entry.dir) continue;
    const content = replaced.has(name) ? replaced.get(name)! : await entry.async("uint8array");
    out.file(name, content, { createFolders: false, compression: "DEFLATE" });
  }
  return await out.generateAsync({ type: "blob", compression: "DEFLATE" });
}

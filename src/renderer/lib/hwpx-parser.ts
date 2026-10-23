import JSZip from "jszip";
import { relayoutChangedParagraphs } from "./hwpxLineseg";

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

function isWellFormed(xml: string): boolean {
  if (typeof DOMParser === 'undefined') return true;
  return new DOMParser().parseFromString(xml, 'application/xml').getElementsByTagName('parsererror').length === 0;
}

// 본문 XML이 이미 깨진 HWPX. 이전 버전 EduNote의 현행화가 태그를 지운 파일이 대표적이며,
// 지워진 그림·표 정보는 파일에 남아 있지 않아 고칠 수 없다. 한글에서도 손상된 파일로 열린다.
export class HwpxDamagedError extends Error {
  constructor(public readonly sections: string[]) {
    super('이 HWPX는 이미 손상된 파일입니다(이전 버전 EduNote의 현행화로 저장된 파일일 수 있습니다). 한글에서도 열리지 않으며 고칠 수 없습니다. 원본(작년) 파일을 올려 주세요.');
    this.name = 'HwpxDamagedError';
  }
}

async function assertSectionsIntact(zip: JSZip): Promise<void> {
  const damaged: string[] = [];
  for (const sectionPath of sortedSectionFiles(zip)) {
    if (!isWellFormed(await zip.file(sectionPath)!.async("string"))) damaged.push(sectionPath);
  }
  if (damaged.length > 0) throw new HwpxDamagedError(damaged);
}

// 글자 노드와 문단 구성을 함께 돌려준다.
// HWPX가 아니면 예외를, 본문 XML이 이미 깨졌으면 HwpxDamagedError를 던진다.
export async function extractHwpxTextDocument(file: File): Promise<HwpxTextDocument> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  await assertSectionsIntact(zip);
  return readTextDocument(zip);
}

export async function extractHwpxTextNodes(file: File): Promise<string[]> {
  return (await extractHwpxTextDocument(file)).nodes;
}

export async function fillHwpxTemplate(file: File, fillData: HwpxFillNode[]): Promise<Blob> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  // 이미 깨진 원본을 채워 저장하면 손상된 파일이 또 만들어진다(고치지 않은 섹션도 그대로 복사되므로)
  await assertSectionsIntact(zip);
  const fillMap = new Map<number, string>();
  fillData.forEach(item => fillMap.set(Number(item.idx), String(item.value)));

  let globalIdx = 0;
  const replaced = new Map<string, string>();
  for (const sectionPath of sortedSectionFiles(zip)) {
    const sectionFile = zip.file(sectionPath);
    if (!sectionFile) continue;
    const original = await sectionFile.async("string");
    let changed = false;
    const filled = original.replace(TEXT_NODE(), (match, openTag, content, closeTag) => {
      const currentIdx = globalIdx++;
      if (!fillMap.has(currentIdx)) return match;
      changed = true;
      return `${openTag}${replaceTextKeepingTags(content, fillMap.get(currentIdx)!)}${closeTag}`;
    });
    if (!changed) continue;
    // 글자 수가 달라진 문단은 줄 배치 정보도 맞춰야 한글이 줄을 겹쳐 그리지 않는다
    const xml = relayoutChangedParagraphs(original, filled);
    // 글자만 바꿨으므로 정상 원본은 결과도 정상이어야 한다. 깨지면 한글이 열지 못하므로 저장하지 않는다.
    if (!isWellFormed(xml)) {
      throw new Error(`HWPX 문서 구조(${sectionPath})를 지키지 못해 저장을 멈췄습니다. 원본 파일은 바뀌지 않았습니다.`);
    }
    replaced.set(sectionPath, xml);
  }

  // 원본 zip을 직접 수정하지 않고 항목을 새 zip에 복사한다.
  // - 원본에 없던 폴더 항목('Contents/')을 만들지 않는다(한글이 열지 못하는 원인).
  // - mimetype을 첫 항목에 무압축(STORE)으로 둔다. 한글은 파일 맨 앞의 평문
  //   "application/hwp+zip"으로 HWPX를 알아보므로, 압축하면 "손상된 파일"로 연다.
  //   version.xml도 앱의 HWPX 생성기(main/HwpxGenerator repackZip)와 같게 무압축으로 둔다.
  const names = Object.keys(zip.files).filter(name => !zip.files[name].dir);
  names.sort((a, b) => Number(b === "mimetype") - Number(a === "mimetype"));
  const out = new JSZip();
  for (const name of names) {
    const content = replaced.has(name) ? replaced.get(name)! : await zip.files[name].async("uint8array");
    out.file(name, content, {
      createFolders: false,
      compression: name === "mimetype" || name === "version.xml" ? "STORE" : "DEFLATE",
    });
  }
  return await out.generateAsync({ type: "blob", compression: "DEFLATE" });
}

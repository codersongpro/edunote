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

function escapeXml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function htmlToText(content: string): string {
  const normalized = content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|li|tr)>/gi, '\n')
    .replace(/<\/td>/gi, '\t');

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

// 골격 문서의 첫 문단과 같은 속성(paraPrIDRef/styleIDRef)을 쓰는 문단 XML을 만든다.
// 속성값이 header.xml에 정의된 ID와 일치해야 한글이 문서를 정상으로 인식한다.
function makeParagraphs(text: string, paraAttrs: { paraPrIDRef: string; styleIDRef: string }): string {
  let id = 1;
  return text
    .split('\n')
    .map(line =>
      `<hp:p id="${id++}" paraPrIDRef="${paraAttrs.paraPrIDRef}" styleIDRef="${paraAttrs.styleIDRef}" pageBreak="0" columnBreak="0" merged="0">` +
      `<hp:run charPrIDRef="0"><hp:t>${escapeXml(line)}</hp:t></hp:run></hp:p>`)
    .join('');
}

// 원본 zip의 항목을 순서 그대로 새 zip에 복사한다 (수정된 항목만 교체).
// JSZip이 임의로 추가하는 폴더 항목을 만들지 않고, 한글이 생성하는 파일과
// 동일하게 모든 항목을 DEFLATE로 압축한다.
async function repackZip(source: JSZip, replaced: Map<string, string>): Promise<Buffer> {
  const out = new JSZip();
  for (const name of Object.keys(source.files)) {
    const entry = source.files[name];
    if (entry.dir) continue;
    const content = replaced.has(name) ? replaced.get(name)! : await entry.async('uint8array');
    out.file(name, content, { createFolders: false, compression: 'DEFLATE' });
  }
  return out.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

// 한글이 만든 빈 문서 골격에 제목·메타·본문 문단을 주입해 HWPX 버퍼를 만든다.
export async function buildHwpxZip(title: string, content: string, meta: HwpxMetadata): Promise<Buffer> {
  const skeleton = await JSZip.loadAsync(Buffer.from(BLANK_HWPX_BASE64, 'base64'));
  const sectionPath = 'Contents/section0.xml';
  const sectionXml = await skeleton.file(sectionPath)!.async('string');

  // 골격 첫 문단의 속성을 그대로 따라간다 (header.xml에 정의된 ID 보장)
  const firstPara = sectionXml.match(/<hp:p [^>]*paraPrIDRef="(\d+)"[^>]*styleIDRef="(\d+)"/);
  const paraAttrs = { paraPrIDRef: firstPara?.[1] ?? '0', styleIDRef: firstPara?.[2] ?? '0' };

  const metaLines = Object.entries(meta)
    .filter(([key, value]) => key !== 'title' && value)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
  const bodyText = [title, metaLines, htmlToText(content)].filter(Boolean).join('\n');

  const closeTag = '</hs:sec>';
  if (!sectionXml.includes(closeTag)) throw new Error('HWPX 골격 문서 형식이 올바르지 않습니다.');
  const newSectionXml = sectionXml.replace(closeTag, `${makeParagraphs(bodyText, paraAttrs)}${closeTag}`);

  return repackZip(skeleton, new Map([[sectionPath, newSectionXml]]));
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

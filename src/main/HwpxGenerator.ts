import JSZip from 'jszip';
import * as fs from 'fs';
import * as path from 'path';
import { DOMParser } from '@xmldom/xmldom';

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

function makeParagraph(text: string): string {
  const lines = text.split('\n');
  return lines
    .map((line) => {
      const safe = escapeXml(line);
      return `<hp:p><hp:run><hp:t>${safe}</hp:t></hp:run></hp:p>`;
    })
    .join('\n');
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

function buildHwpxXml(title: string, content: string, meta: HwpxMetadata): string {
  const headerLines = Object.entries(meta)
    .filter(([, v]) => v)
    .map(([k, v]) => `<hp:p><hp:run><hp:t>${escapeXml(k)}: ${escapeXml(v!)}</hp:t></hp:run></hp:p>`)
    .join('\n');

  const titleLine = `<hp:p><hp:run><hp:t>${escapeXml(title)}</hp:t></hp:run></hp:p>`;
  const body = makeParagraph(htmlToText(content));

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<hsp:HWPMLPar xmlns:hsp="http://www.hancom.co.kr/hwpml/2012/paragraph"
              xmlns:hp="http://www.hancom.co.kr/hwpml/2012/paragraph"
              xmlns:hc="http://www.hancom.co.kr/hwpml/2012/core">
  <hp:body>
    <hp:sectionPr>
      <hp:pagePr>
        <hp:margins left="3000" right="3000" top="2000" bottom="1500" header="851" footer="1701" gutter="0"/>
      </hp:pagePr>
    </hp:sectionPr>
    ${titleLine}
    ${headerLines}
    ${body}
  </hp:body>
</hsp:HWPMLPar>`;
}

async function buildHwpxZip(title: string, content: string, meta: HwpxMetadata): Promise<Buffer> {
  const zip = new JSZip();

  zip.file('mimetype', 'application/hwp+zip', { compression: 'STORE' });

  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="Contents/content.hpf" media-type="application/hwp+zip"/>
  </rootfiles>
</container>`,
  );

  zip.file(
    'Contents/content.hpf',
    `<?xml version="1.0" encoding="UTF-8"?>
<opf:package xmlns:opf="http://www.idpf.org/2007/opf" version="2.0">
  <opf:manifest>
    <opf:item id="section0" href="section0.xml" media-type="application/xml"/>
  </opf:manifest>
  <opf:spine>
    <opf:itemref idref="section0"/>
  </opf:spine>
</opf:package>`,
  );

  const xml = buildHwpxXml(title, content, meta);
  zip.file('Contents/section0.xml', xml);

  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return buf;
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

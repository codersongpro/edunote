import JSZip from 'jszip';

// 최소 XLSX 읽기·쓰기 (외부 의존성 없이 jszip만 사용)
// - npm의 xlsx@0.18.5는 알려진 취약점(프로토타입 오염·ReDoS)이 있어 쓰지 않는다.
// - 읽기: 공유 문자열·인라인 문자열·숫자·불리언 셀. 수식 셀은 저장된 계산 결과만 사용.
// - 쓰기: 텍스트는 inlineStr로 저장하므로 '=' 로 시작하는 값도 수식으로 실행되지 않는다.

export type Cell = string | number | null;
export interface SheetData {
  name: string;
  rows: Cell[][];
}

export const MAX_XLSX_BYTES = 5 * 1024 * 1024;
const MAX_PART_BYTES = 60 * 1024 * 1024; // 압축 해제 후 시트 하나의 최대 크기(압축 폭탄 방지)
const MAX_ROWS = 5000;
const MAX_COLS = 60;

const NS_ANY = '*';

function parseXml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('엑셀 파일 구조를 읽을 수 없습니다.');
  return doc;
}

const byTag = (node: Document | Element, tag: string) => Array.from(node.getElementsByTagNameNS(NS_ANY, tag));
const textOf = (node: Element) => byTag(node, 't').map(t => t.textContent ?? '').join('');

async function readPart(zip: JSZip, path: string): Promise<string | null> {
  const file = zip.file(path);
  if (!file) return null;
  const size = (file as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
  if (typeof size === 'number' && size > MAX_PART_BYTES) throw new Error('엑셀 파일이 너무 큽니다.');
  return file.async('string');
}

/** "AB12" → 열 번호 27(0부터) */
function colIndex(ref: string): number {
  let n = 0;
  for (const ch of ref) {
    const code = ch.charCodeAt(0);
    if (code < 65 || code > 90) break;
    n = n * 26 + (code - 64);
  }
  return n - 1;
}

export async function readXlsx(buffer: ArrayBuffer): Promise<SheetData[]> {
  if (buffer.byteLength > MAX_XLSX_BYTES) throw new Error('파일이 5MB를 넘습니다.');
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error('엑셀(xlsx) 파일이 아니거나 손상되었습니다. 구형 .xls는 엑셀에서 .xlsx로 저장해 주세요.');
  }
  const wbText = await readPart(zip, 'xl/workbook.xml');
  if (!wbText) throw new Error('엑셀(xlsx) 파일이 아니거나 손상되었습니다.');
  const relsText = (await readPart(zip, 'xl/_rels/workbook.xml.rels')) ?? '';
  const targets = new Map<string, string>();
  if (relsText) {
    for (const r of byTag(parseXml(relsText), 'Relationship')) {
      const t = r.getAttribute('Target') ?? '';
      targets.set(r.getAttribute('Id') ?? '', t.startsWith('/') ? t.slice(1) : `xl/${t.replace(/^\.\//, '')}`);
    }
  }
  const shared: string[] = [];
  const ssText = await readPart(zip, 'xl/sharedStrings.xml');
  if (ssText) for (const si of byTag(parseXml(ssText), 'si')) shared.push(textOf(si));

  const sheets: SheetData[] = [];
  const sheetNodes = byTag(parseXml(wbText), 'sheet');
  for (let k = 0; k < sheetNodes.length; k++) {
    const node = sheetNodes[k];
    const rid = node.getAttribute('r:id') ?? node.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ?? '';
    const path = targets.get(rid) ?? `xl/worksheets/sheet${k + 1}.xml`;
    const text = await readPart(zip, path);
    if (!text) continue;
    const rows: Cell[][] = [];
    for (const row of byTag(parseXml(text), 'row')) {
      const rIdx = Number(row.getAttribute('r') ?? rows.length + 1) - 1;
      if (rIdx >= MAX_ROWS) throw new Error(`행이 ${MAX_ROWS}개를 넘습니다.`);
      const out: Cell[] = [];
      for (const c of byTag(row, 'c')) {
        const ref = c.getAttribute('r');
        const ci = ref ? colIndex(ref) : out.length;
        if (ci < 0 || ci >= MAX_COLS) continue;
        const t = c.getAttribute('t');
        const v = byTag(c, 'v')[0]?.textContent ?? null;
        let value: Cell = null;
        if (t === 's') value = v !== null ? shared[Number(v)] ?? '' : '';
        else if (t === 'inlineStr') value = byTag(c, 'is')[0] ? textOf(byTag(c, 'is')[0]) : '';
        else if (t === 'str') value = v ?? '';
        else if (t === 'b') value = v === '1' ? 'TRUE' : 'FALSE';
        else if (t === 'e') value = null;
        else if (v !== null && v !== '') value = Number.isFinite(Number(v)) ? Number(v) : v;
        while (out.length < ci) out.push(null);
        out[ci] = value;
      }
      rows[rIdx] = out;
    }
    for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
    sheets.push({ name: node.getAttribute('name') ?? `Sheet${k + 1}`, rows });
  }
  return sheets;
}

// ---------- 쓰기 ----------

// XML 1.0에서 허용되지 않는 제어문자 제거 후 이스케이프
const xmlEscape = (s: string) =>
  s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const colName = (i: number) => {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

/** 시트 이름 규칙: 31자 이하, []:*?/\ 금지, 중복 금지 */
export function safeSheetName(name: string, used: Set<string>): string {
  const base = (name.replace(/[[\]:*?/\\]/g, ' ').trim() || 'Sheet').slice(0, 31);
  let out = base;
  for (let k = 2; used.has(out.toLowerCase()); k++) out = `${base.slice(0, 28)}(${k})`;
  used.add(out.toLowerCase());
  return out;
}

export interface SheetSpec extends SheetData {
  /** 굵은 머리글로 표시할 행 번호(0부터) */
  headerRows?: number[];
  /** 제목(크게)으로 표시할 행 번호 */
  titleRows?: number[];
  colWidths?: number[];
  /** 첫 행 고정 */
  freezeHeader?: boolean;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="3"><font><sz val="11"/><name val="맑은 고딕"/></font><font><b/><sz val="11"/><name val="맑은 고딕"/></font><font><b/><sz val="14"/><name val="맑은 고딕"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD1FAE5"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD6D3D1"/></left><right style="thin"><color rgb="FFD6D3D1"/></right><top style="thin"><color rgb="FFD6D3D1"/></top><bottom style="thin"><color rgb="FFD6D3D1"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function sheetXml(spec: SheetSpec): string {
  const header = new Set(spec.headerRows ?? []);
  const title = new Set(spec.titleRows ?? []);
  const rows = spec.rows.map((row, r) => {
    const s = title.has(r) ? 2 : header.has(r) ? 1 : 0;
    const cells = row.map((v, c) => {
      if (v === null || v === undefined || v === '') return s ? `<c r="${colName(c)}${r + 1}" s="${s}"/>` : '';
      const ref = `${colName(c)}${r + 1}`;
      const sAttr = s ? ` s="${s}"` : '';
      if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${sAttr}><v>${v}</v></c>`;
      return `<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(String(v))}</t></is></c>`;
    }).join('');
    return `<row r="${r + 1}">${cells}</row>`;
  }).join('');
  const cols = spec.colWidths?.length
    ? `<cols>${spec.colWidths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
    : '';
  const pane = spec.freezeHeader
    ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${pane}${cols}<sheetData>${rows}</sheetData></worksheet>`;
}

export async function writeXlsx(specs: SheetSpec[]): Promise<ArrayBuffer> {
  const zip = new JSZip();
  const used = new Set<string>();
  const names = specs.map(s => safeSheetName(s.name, used));
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${specs.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${xmlEscape(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${specs.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${specs.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file('xl/styles.xml', STYLES);
  specs.forEach((s, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)));
  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
}

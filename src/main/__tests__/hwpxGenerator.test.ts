import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { buildHwpxZip } from '../HwpxGenerator';
import { BLANK_HWPX_BASE64 } from '../hwpxSkeleton';

const SKELETON_ENTRIES = [
  'mimetype',
  'version.xml',
  'META-INF/manifest.xml',
  'META-INF/container.xml',
  'Contents/content.hpf',
  'Contents/header.xml',
  'Contents/section0.xml',
  'settings.xml',
];

async function readEntry(buf: Buffer, name: string): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  return zip.file(name)!.async('string');
}

describe('buildHwpxZip', () => {
  it('골격과 동일한 항목 구성을 유지하고 폴더 항목을 추가하지 않는다', async () => {
    const buf = await buildHwpxZip('제목', '<p>본문</p>', { teacher: '교사' });
    const zip = await JSZip.loadAsync(buf);
    const names = Object.keys(zip.files);
    expect(names).toEqual(SKELETON_ENTRIES);
    expect(Object.values(zip.files).some(f => f.dir)).toBe(false);
  });

  it('mimetype이 첫 항목이며 무압축(Stored)으로 OCF 시그니처를 만족한다', async () => {
    const buf = await buildHwpxZip('제목', '본문', {});
    // 로컬 파일 헤더: offset 0 시그니처, offset 8 압축 방식(0=STORE),
    // offset 30 파일명, offset 38 내용 — 한글은 이 위치의 평문 mimetype을 확인한다
    expect(buf.readUInt32LE(0)).toBe(0x04034b50);
    expect(buf.readUInt16LE(8)).toBe(0);
    expect(buf.subarray(30, 38).toString('ascii')).toBe('mimetype');
    expect(buf.subarray(38, 38 + 19).toString('ascii')).toBe('application/hwp+zip');
    const zip = await JSZip.loadAsync(buf);
    expect(Object.keys(zip.files)[0]).toBe('mimetype');
    expect(await zip.file('mimetype')!.async('string')).toBe('application/hwp+zip');
  });

  it('본문 텍스트가 문단으로 주입되고 메타 정보가 포함된다', async () => {
    const buf = await buildHwpxZip('계획서 제목', '<p>첫 줄</p><p>둘째 줄 & 검증</p>', { date: '2026-06-12' });
    const section = await readEntry(buf, 'Contents/section0.xml');
    expect(section).toContain('<hp:t>계획서 제목</hp:t>');
    expect(section).toContain('<hp:t>둘째 줄 &amp; 검증</hp:t>');
    expect(section).toContain('date: 2026-06-12');
    // 일반 문단은 골격 첫 문단의 paraPrIDRef를 그대로 사용한다 (blank 골격은 3)
    expect(section).toMatch(/<hp:p id="0" paraPrIDRef="3" styleIDRef="0"[^>]*>(?:(?!<\/hp:p>).)*첫 줄/);
  });

  it('모든 문단에 linesegarray가 포함된다', async () => {
    const buf = await buildHwpxZip('제목', '<p>가</p><p>나</p><table><tr><td>셀</td></tr></table>', {});
    const section = await readEntry(buf, 'Contents/section0.xml');
    const paraCount = (section.match(/<hp:p /g) || []).length;
    const linesegCount = (section.match(/<hp:linesegarray>/g) || []).length;
    expect(paraCount).toBeGreaterThan(0);
    expect(linesegCount).toBe(paraCount);
  });

  it('탭 문자는 hp:tab 요소로 변환되고 텍스트에 남지 않는다', async () => {
    const buf = await buildHwpxZip('제목', '<p>왼쪽\t오른쪽</p>', {});
    const section = await readEntry(buf, 'Contents/section0.xml');
    expect(section).toContain('<hp:t>왼쪽<hp:tab/>오른쪽</hp:t>');
    expect(section).not.toMatch(/<hp:t>[^<]*\t/);
  });

  it('h1 제목은 가운데 정렬·제목 서식으로, strong은 굵게 run으로 분리된다', async () => {
    const buf = await buildHwpxZip(
      '제목',
      '<h1 style="text-align:center;">문서 큰제목</h1><p>일반 <strong>강조</strong> 텍스트</p>',
      {},
    );
    const section = await readEntry(buf, 'Contents/section0.xml');
    // h1 → charPr 7(22pt 굵게) + paraPr 16(가운데)
    expect(section).toMatch(/<hp:p id="0" paraPrIDRef="16"[^>]*><hp:run charPrIDRef="7"><hp:t>문서 큰제목<\/hp:t>/);
    // strong → charPr 9(굵게) run 분리
    expect(section).toContain('<hp:run charPrIDRef="0"><hp:t>일반 </hp:t></hp:run>');
    expect(section).toContain('<hp:run charPrIDRef="9"><hp:t>강조</hp:t></hp:run>');
    // 본문에 h1이 있으면 제목 문단을 중복 주입하지 않는다
    expect((section.match(/문서 큰제목|<hp:t>제목<\/hp:t>/g) || []).length).toBe(1);
  });

  it('표가 hp:tbl 구조로 변환되고 colspan이 반영된다', async () => {
    const html =
      '<table><tr><th>항목</th><th>내용</th></tr><tr><td colspan="2">병합 셀</td></tr></table>';
    const buf = await buildHwpxZip('제목', html, {});
    const section = await readEntry(buf, 'Contents/section0.xml');
    expect(section).toMatch(/<hp:tbl [^>]*rowCnt="2" colCnt="2"/);
    expect(section).toContain('<hp:cellAddr colAddr="0" rowAddr="0"/>');
    expect(section).toContain('<hp:cellAddr colAddr="1" rowAddr="0"/>');
    expect(section).toContain('<hp:cellSpan colSpan="2" rowSpan="1"/>');
    // th는 굵게(9) + 가운데(16), 표 테두리는 주입한 borderFill 3을 쓴다
    expect(section).toMatch(/<hp:run charPrIDRef="9"><hp:t>항목<\/hp:t>/);
    expect(section).toContain('borderFillIDRef="3"');
  });

  it('section이 참조하는 모든 스타일 ID가 header.xml에 정의되어 있다', async () => {
    const html =
      '<h1>제목</h1><div style="text-align:right">기관명</div><p><strong>강조</strong></p>' +
      '<ul><li>항목</li></ul><table><tr><th>가</th></tr><tr><td>나</td></tr></table>';
    const buf = await buildHwpxZip('제목', html, {});
    const section = await readEntry(buf, 'Contents/section0.xml');
    const header = await readEntry(buf, 'Contents/header.xml');
    const defined = (tag: string) =>
      new Set([...header.matchAll(new RegExp(`<hh:${tag} id="(\\d+)"`, 'g'))].map(m => m[1]));
    const used = (attr: string) =>
      new Set([...section.matchAll(new RegExp(`${attr}="(\\d+)"`, 'g'))].map(m => m[1]));
    for (const [attr, tag] of [
      ['charPrIDRef', 'charPr'],
      ['paraPrIDRef', 'paraPr'],
      ['styleIDRef', 'style'],
      ['borderFillIDRef', 'borderFill'],
    ] as const) {
      const defs = defined(tag);
      for (const id of used(attr)) {
        expect(defs.has(id), `${attr} ${id}가 header.xml에 없음`).toBe(true);
      }
    }
  });

  it('header.xml에 스타일이 주입되고 itemCnt가 갱신된다', async () => {
    const buf = await buildHwpxZip('제목', '<p>본문</p>', {});
    const header = await readEntry(buf, 'Contents/header.xml');
    expect(header).toContain('<hh:charProperties itemCnt="10">');
    expect(header).toContain('<hh:paraProperties itemCnt="18">');
    expect(header).toContain('<hh:borderFills itemCnt="3">');
    expect(header).toMatch(/<hh:charPr id="7" height="2200"[\s\S]*?<hh:bold\/>/);
    expect(header).toMatch(/<hh:paraPr id="16"[^>]*>[\s\S]*?horizontal="CENTER"/);
    expect(header).toMatch(/<hh:borderFill id="3"[\s\S]*?<hh:leftBorder type="SOLID"/);
  });

  it('모든 XML 항목이 유효한 XML로 파싱된다', async () => {
    const html =
      '<h1>제목 & 검증</h1><p>본문 <strong>강조</strong></p>' +
      '<table><tr><th>가</th><td>나\t다</td></tr></table><ul><li>항목 <태그같은 텍스트></li></ul>';
    const buf = await buildHwpxZip('제목', html, {});
    const zip = await JSZip.loadAsync(buf);
    for (const name of SKELETON_ENTRIES) {
      if (!name.endsWith('.xml') && !name.endsWith('.hpf')) continue;
      const xml = await zip.file(name)!.async('string');
      const doc = new DOMParser({ onError: (level, msg) => { throw new Error(`${name}: ${msg}`); } })
        .parseFromString(xml, 'text/xml');
      expect(doc.documentElement).toBeTruthy();
    }
  });

  it('section과 header 외의 항목은 골격과 바이트 단위로 동일하다', async () => {
    const buf = await buildHwpxZip('제목', '본문', {});
    const zip = await JSZip.loadAsync(buf);
    const skeleton = await JSZip.loadAsync(Buffer.from(BLANK_HWPX_BASE64, 'base64'));
    for (const name of SKELETON_ENTRIES) {
      if (name === 'Contents/section0.xml' || name === 'Contents/header.xml') continue;
      const a = await zip.file(name)!.async('uint8array');
      const b = await skeleton.file(name)!.async('uint8array');
      expect(Buffer.compare(Buffer.from(a), Buffer.from(b))).toBe(0);
    }
  });
});

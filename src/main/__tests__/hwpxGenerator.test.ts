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

describe('buildHwpxZip', () => {
  it('골격과 동일한 항목 구성을 유지하고 폴더 항목을 추가하지 않는다', async () => {
    const buf = await buildHwpxZip('제목', '<p>본문</p>', { teacher: '교사' });
    const zip = await JSZip.loadAsync(buf);
    const names = Object.keys(zip.files);
    expect(names).toEqual(SKELETON_ENTRIES);
    expect(Object.values(zip.files).some(f => f.dir)).toBe(false);
  });

  it('mimetype이 첫 항목이고 내용이 올바르다', async () => {
    const buf = await buildHwpxZip('제목', '본문', {});
    const zip = await JSZip.loadAsync(buf);
    expect(Object.keys(zip.files)[0]).toBe('mimetype');
    expect(await zip.file('mimetype')!.async('string')).toBe('application/hwp+zip');
  });

  it('본문 텍스트가 골격 문단과 같은 속성의 문단으로 주입된다', async () => {
    const buf = await buildHwpxZip('계획서 제목', '<p>첫 줄</p><p>둘째 줄 & 검증</p>', { date: '2026-06-12' });
    const zip = await JSZip.loadAsync(buf);
    const section = await zip.file('Contents/section0.xml')!.async('string');
    expect(section).toContain('<hp:t>계획서 제목</hp:t>');
    expect(section).toContain('<hp:t>둘째 줄 &amp; 검증</hp:t>');
    expect(section).toContain('date: 2026-06-12');
    // 골격 첫 문단의 paraPrIDRef를 그대로 사용한다 (blank 골격은 3)
    expect(section).toMatch(/<hp:p id="1" paraPrIDRef="3" styleIDRef="0"/);
  });

  it('모든 XML 항목이 유효한 XML로 파싱된다', async () => {
    const buf = await buildHwpxZip('제목', '본문 <태그같은 텍스트>', {});
    const zip = await JSZip.loadAsync(buf);
    for (const name of SKELETON_ENTRIES) {
      if (!name.endsWith('.xml') && !name.endsWith('.hpf')) continue;
      const xml = await zip.file(name)!.async('string');
      const doc = new DOMParser({ onError: (level, msg) => { throw new Error(`${name}: ${msg}`); } })
        .parseFromString(xml, 'text/xml');
      expect(doc.documentElement).toBeTruthy();
    }
  });

  it('수정하지 않은 항목은 골격과 바이트 단위로 동일하다', async () => {
    const buf = await buildHwpxZip('제목', '본문', {});
    const zip = await JSZip.loadAsync(buf);
    const skeleton = await JSZip.loadAsync(Buffer.from(BLANK_HWPX_BASE64, 'base64'));
    for (const name of SKELETON_ENTRIES) {
      if (name === 'Contents/section0.xml') continue;
      const a = await zip.file(name)!.async('uint8array');
      const b = await skeleton.file(name)!.async('uint8array');
      expect(Buffer.compare(Buffer.from(a), Buffer.from(b))).toBe(0);
    }
  });
});

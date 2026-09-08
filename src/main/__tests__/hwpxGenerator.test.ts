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
    expect(section).toContain('<hp:t>둘째 줄 &amp; 검증</hp:t>');
    expect(section).toContain('date: 2026-06-12');
    // 일반 문단은 골격 첫 문단의 paraPrIDRef를 그대로 사용한다 (blank 골격은 3)
    expect(section).toMatch(/<hp:p id="0" paraPrIDRef="3" styleIDRef="0"[^>]*>(?:(?!<\/hp:p>).)*첫 줄/);
  });

  it('파일명용 제목을 본문 제목 문단으로 주입하지 않는다 (미리보기와 동일한 본문)', async () => {
    const buf = await buildHwpxZip('생성문서', '<p>수신 (내부결재)</p><p>제목 독서교육 계획</p>', { title: '생성문서' });
    const section = await readEntry(buf, 'Contents/section0.xml');
    expect(section).not.toContain('생성문서');
    expect(section).toContain('수신 (내부결재)');
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

  it('본문 폭을 넘는 긴 문단은 줄마다 lineseg를 가진다 (줄 겹침 방지)', async () => {
    const longText = '학교 교육 활동에 깊은 관심과 격려를 보내 주시는 학부모님께 감사드립니다. '.repeat(5);
    const buf = await buildHwpxZip('제목', `<p>${longText}</p>`, {});
    const section = await readEntry(buf, 'Contents/section0.xml');
    const para = section.match(/<hp:p [^>]*>(?:(?!<\/hp:p>)[\s\S])*감사드립니다[\s\S]*?<\/hp:p>/)?.[0] ?? '';
    const segs = [...para.matchAll(/<hp:lineseg [^>]*vertpos="(\d+)"/g)].map(m => Number(m[1]));
    expect(segs.length).toBeGreaterThan(1);
    // 줄마다 세로 위치가 증가해야 겹쳐 그려지지 않는다
    for (let i = 1; i < segs.length; i += 1) expect(segs[i]).toBeGreaterThan(segs[i - 1]);
  });

  it('공문 번호 수준에 따라 글자 크기와 들여쓰기가 적용된다', async () => {
    const html = '<p>1. 추진 배경</p><p>가. 세부 내용</p><p>1) 더 깊은 수준</p>';
    const buf = await buildHwpxZip('제목', html, {});
    const section = await readEntry(buf, 'Contents/section0.xml');
    // "1." 수준 → 15pt(charPr 11), 전용 문단 속성(18)
    expect(section).toMatch(/paraPrIDRef="18"[^>]*>[\s\S]*?<hp:run charPrIDRef="11">/);
    expect(section).toContain('<hp:run charPrIDRef="11"><hp:t>1. 추진 배경</hp:t></hp:run>');
    // "가."와 "1)" 수준 → 14pt(charPr 10), 서로 다른 문단 여백
    expect(section).toMatch(/paraPrIDRef="19"[^>]*>[\s\S]*?<hp:run charPrIDRef="10"><hp:t>가\. 세부 내용<\/hp:t>/);
    expect(section).toMatch(/paraPrIDRef="20"[^>]*>[\s\S]*?<hp:run charPrIDRef="10"><hp:t>1\) 더 깊은 수준<\/hp:t>/);
  });

  it('data-outline-level 네 단계가 서로 다른 문단 속성과 내어쓰기를 사용한다', async () => {
    const html =
      '<h2 data-outline-level="1">1. 운영 방법</h2>'
      + '<div data-outline-level="2">가. 대상별 안내가 길어져 둘째 줄로 이어지는 내용</div>'
      + '<div data-outline-level="3">1) 안내 자료 확인</div>'
      + '<div data-outline-level="4">가) 제출 항목 점검</div>';
    const buf = await buildHwpxZip('제목', html, {});
    const section = await readEntry(buf, 'Contents/section0.xml');
    const header = await readEntry(buf, 'Contents/header.xml');

    expect(section).toMatch(/paraPrIDRef="18"[^>]*>[\s\S]*?<hp:t>1\. 운영 방법<\/hp:t>/);
    expect(section).toMatch(/paraPrIDRef="19"[^>]*>[\s\S]*?<hp:t>가\. 대상별 안내/);
    expect(section).toMatch(/paraPrIDRef="20"[^>]*>[\s\S]*?<hp:t>1\) 안내 자료 확인<\/hp:t>/);
    expect(section).toMatch(/paraPrIDRef="21"[^>]*>[\s\S]*?<hp:t>가\) 제출 항목 점검<\/hp:t>/);
    expect(section).not.toContain('<hp:t>  가. 대상별 안내');

    expect(header).toMatch(/<hh:paraPr id="18"[\s\S]*?<hc:intent value="-1200"[\s\S]*?<hc:left value="1200"/);
    expect(header).toMatch(/<hh:paraPr id="19"[\s\S]*?<hc:intent value="-1000"[\s\S]*?<hc:left value="2000"/);
    expect(header).toMatch(/<hh:paraPr id="20"[\s\S]*?<hc:intent value="-1200"[\s\S]*?<hc:left value="3200"/);
    expect(header).toMatch(/<hh:paraPr id="21"[\s\S]*?<hc:intent value="-1000"[\s\S]*?<hc:left value="4000"/);
  });

  it('data 속성이 없는 이전 HTML도 번호를 감지해 같은 문단 위계를 적용한다', async () => {
    const html = '<p>1. 운영 방법</p><p>가. 대상별 안내</p><p>1) 안내 자료 확인</p><p>가) 제출 항목 점검</p>';
    const section = await readEntry(await buildHwpxZip('제목', html, {}), 'Contents/section0.xml');

    expect(section).toMatch(/paraPrIDRef="18"[^>]*>[\s\S]*?<hp:t>1\. 운영 방법<\/hp:t>/);
    expect(section).toMatch(/paraPrIDRef="19"[^>]*>[\s\S]*?<hp:t>가\. 대상별 안내<\/hp:t>/);
    expect(section).toMatch(/paraPrIDRef="20"[^>]*>[\s\S]*?<hp:t>1\) 안내 자료 확인<\/hp:t>/);
    expect(section).toMatch(/paraPrIDRef="21"[^>]*>[\s\S]*?<hp:t>가\) 제출 항목 점검<\/hp:t>/);
  });

  it('순서 목록의 시작 번호·개별 값·중첩 깊이를 보존하고 말머리를 이중 출력하지 않는다', async () => {
    const html =
      '<ol start="3"><li>셋째 항목</li><li value="7">일곱째 항목<ul><li>하위 항목</li></ul></li><li>1) 이미 표시된 항목</li></ol>';
    const section = await readEntry(await buildHwpxZip('제목', html, {}), 'Contents/section0.xml');

    expect(section).toMatch(/paraPrIDRef="18"[^>]*>[\s\S]*?<hp:t>3\. 셋째 항목<\/hp:t>/);
    expect(section).toContain('<hp:t>7. 일곱째 항목</hp:t>');
    expect(section).toMatch(/paraPrIDRef="19"[^>]*>[\s\S]*?<hp:t>• 하위 항목<\/hp:t>/);
    expect(section).toContain('<hp:t>1) 이미 표시된 항목</hp:t>');
    expect(section).not.toContain('8. 1) 이미 표시된 항목');
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
    // strong → charPr 9(14pt 굵게) run 분리, 일반 본문은 charPr 10(14pt)
    expect(section).toContain('<hp:run charPrIDRef="10"><hp:t>일반 </hp:t></hp:run>');
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
    expect(header).toContain('<hh:charProperties itemCnt="12">');
    expect(header).toContain('<hh:paraProperties itemCnt="25">');
    expect(header).toContain('<hh:borderFills itemCnt="3">');
    expect(header).toMatch(/<hh:charPr id="7" height="2200"[\s\S]*?<hh:bold\/>/);
    // 본문 기본 14pt(굵게 아님), "1." 수준 15pt
    expect(header).toMatch(/<hh:charPr id="10" height="1400"(?:(?!<\/hh:charPr>)[\s\S])*?<\/hh:charPr>/);
    expect(header.match(/<hh:charPr id="10"[\s\S]*?<\/hh:charPr>/)?.[0]).not.toContain('<hh:bold/>');
    expect(header).toMatch(/<hh:charPr id="11" height="1500"/);
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

  // ── AI가 만든 HTML은 XML로는 어긋난 곳이 많다 ─────────────────────────
  // 아래 경우들에서 XML 파싱이 실패하면 평문 폴백으로 떨어져 표·서식이 사라지고
  // <style>의 CSS까지 본문 문단으로 새어 나왔다 (워크시트 HWPX 저장 문제).

  it('전체 HTML 문서를 저장해도 style·head 내용이 본문에 들어가지 않는다', async () => {
    const html =
      '<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>워크시트</title><style>\n'
      + '@page { size: A4; margin: 12mm 14mm; }\n'
      + 'body { font-family: \'Malgun Gothic\'; font-size: 12pt; }\n'
      + '</style></head><body><h1>씨앗 심기 순서</h1><p>본문</p></body></html>';
    const section = await readEntry(await buildHwpxZip('워크시트', html, {}), 'Contents/section0.xml');

    expect(section).not.toContain('@page');
    expect(section).not.toContain('font-family');
    expect(section).not.toContain('워크시트'); // head의 <title>은 본문이 아니다
    // 서식 유지 경로를 그대로 쓴다 — h1은 제목 서식(7) + 가운데 정렬(16)
    expect(section).toMatch(/paraPrIDRef="16"[^>]*><hp:run charPrIDRef="7"><hp:t>씨앗 심기 순서<\/hp:t>/);
  });

  it('닫히지 않는 빈 요소(col·input·meta)가 있어도 표와 서식을 유지한다', async () => {
    const html =
      '<style>@page { size: A4; }</style>'
      + '<h1>학습지</h1>'
      + '<table><colgroup><col style="width:30%"><col></colgroup>'
      + '<tr><th>구분</th><td>내용</td></tr></table>'
      + '<p><input type="checkbox"> 확인</p>';
    const section = await readEntry(await buildHwpxZip('학습지', html, {}), 'Contents/section0.xml');

    expect(section).not.toContain('@page');
    expect(section).toMatch(/<hp:tbl [^>]*rowCnt="1" colCnt="2"/);
    expect(section).toContain('<hp:t>구분</hp:t>');
    // 한글에는 입력 요소가 없으므로 체크박스는 기호로 남긴다
    expect(section).toContain('<hp:t>☐ 확인</hp:t>');
  });

  it('닫히지 않은 태그와 짝 없는 종료 태그, 중복 속성을 복구한다', async () => {
    const html = '<ul><li>하나<li>둘</ul><p class="a" class="b">셋</div></span>';
    const section = await readEntry(await buildHwpxZip('제목', html, {}), 'Contents/section0.xml');

    expect(section).toContain('<hp:t>• 하나</hp:t>');
    expect(section).toContain('<hp:t>• 둘</hp:t>');
    expect(section).toContain('<hp:t>셋</hp:t>');
  });

  it('이름 있는 HTML 엔티티를 실제 문자로 바꾼다', async () => {
    const html = '<p>가&mdash;나&middot;다&hellip;라&nbsp;마 &amp; 5 &lt; 7</p>';
    const section = await readEntry(await buildHwpxZip('제목', html, {}), 'Contents/section0.xml');

    expect(section).toContain('<hp:t>가—나·다…라\u00A0마 &amp; 5 &lt; 7</hp:t>');
    expect(section).not.toContain('mdash');
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

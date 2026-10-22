import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { extractHwpxTextNodes, fillHwpxTemplate } from '../hwpx-parser';
import { changedFillNodes } from '../aiReview';

async function makeHwpx(section0: string, section1: string): Promise<File> {
  const zip = new JSZip();
  zip.file('mimetype', 'application/hwp+zip');
  zip.file('Contents/section1.xml', section1);
  zip.file('Contents/section0.xml', section0);
  const data = await zip.generateAsync({ type: 'uint8array' });
  return new File([data], 'plan.hwpx');
}

describe('HWPX 텍스트 노드 왕복', () => {
  it('섹션 순서대로 노드를 읽고, 바꾼 노드만 서식을 유지한 채 다시 채운다', async () => {
    const file = await makeHwpx(
      '<hp:p><hp:run charPrIDRef="7"><hp:t>2025학년도 계획</hp:t></hp:run><hp:t>A &amp; B</hp:t></hp:p>',
      '<hp:p><hp:run charPrIDRef="9"><hp:t>담당: 교무부</hp:t></hp:run></hp:p>',
    );
    const nodes = await extractHwpxTextNodes(file);
    expect(nodes).toEqual(['2025학년도 계획', 'A & B', '담당: 교무부']);

    const updated = [...nodes];
    updated[0] = '2026학년도 계획 <개정>';
    const blob = await fillHwpxTemplate(file, changedFillNodes(nodes, updated));
    const filled = new File([await blob.arrayBuffer()], 'filled.hwpx');

    expect(await extractHwpxTextNodes(filled)).toEqual(updated);
    const xml = await (await JSZip.loadAsync(await filled.arrayBuffer())).file('Contents/section0.xml')!.async('string');
    expect(xml).toContain('<hp:run charPrIDRef="7"><hp:t>2026학년도 계획 &lt;개정&gt;</hp:t>');
    expect(xml).toContain('<hp:t>A &amp; B</hp:t>');
  });

  it('HWPX가 아닌 파일은 예외를 던진다', async () => {
    await expect(extractHwpxTextNodes(new File(['not zip'], 'a.hwp'))).rejects.toThrow();
  });
});

describe('HWPX 글자 노드만 정확히 고치기', () => {
  // 업로드된 실제 계획서에서 손상을 일으킨 구조: 그림 옆 빈 글자 노드(<hp:t/>), 표, 글자 노드 속 탭
  const section = [
    '<hs:sec xmlns:hs="s" xmlns:hp="p">',
    '<hp:p><hp:run><hp:pic><hp:shapeComment>그림</hp:shapeComment></hp:pic><hp:t/></hp:run>',
    '<hp:run charPrIDRef="3"><hp:t>2025학년도 상담 주간 운영 계획</hp:t></hp:run></hp:p>',
    '<hp:p><hp:run><hp:tbl><hp:tr><hp:tc><hp:subList><hp:p><hp:run><hp:t>2025. 4. 2.(수)</hp:t></hp:run></hp:p></hp:subList>',
    '<hp:textMargin left="1"/></hp:tc></hp:tr></hp:tbl></hp:run></hp:p>',
    '<hp:p><hp:run><hp:t>가.<hp:tab width="100"/>2025년 운영</hp:t></hp:run></hp:p>',
    '</hs:sec>',
  ].join('');

  const parse = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');

  it('빈 노드·표 태그를 글자 노드로 잡지 않고 문단 번호를 함께 돌려준다', async () => {
    const { extractHwpxTextDocument } = await import('../hwpx-parser');
    const file = await makeHwpx(section, '<hs:sec xmlns:hs="s" xmlns:hp="p"><hp:p><hp:run><hp:t>둘째 섹션</hp:t></hp:run></hp:p></hs:sec>');
    const doc = await extractHwpxTextDocument(file);
    expect(doc.nodes).toEqual(['2025학년도 상담 주간 운영 계획', '2025. 4. 2.(수)', '가.2025년 운영', '둘째 섹션']);
    expect(new Set(doc.paragraphOf).size).toBe(4);
  });

  it('바꾼 뒤에도 XML이 올바르고, 글자 노드 속 탭 태그를 지킨다', async () => {
    const file = await makeHwpx(section, '<hs:sec xmlns:hs="s" xmlns:hp="p"/>');
    const nodes = await extractHwpxTextNodes(file);
    const updated = nodes.map(n => n.replace(/2025/g, '2026').replace('(수)', '(목)'));
    const blob = await fillHwpxTemplate(file, changedFillNodes(nodes, updated));
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file('Contents/section0.xml')!.async('string');

    expect(parse(xml).getElementsByTagName('parsererror')).toHaveLength(0);
    expect(xml).toContain('<hp:pic><hp:shapeComment>그림</hp:shapeComment></hp:pic><hp:t/></hp:run>');
    expect(xml).toContain('<hp:tbl><hp:tr><hp:tc>');
    expect(xml).toContain('<hp:t>가.<hp:tab width="100"/>2026년 운영</hp:t>');
    expect(await extractHwpxTextNodes(new File([await blob.arrayBuffer()], 'o.hwpx'))).toEqual(updated);
  });
});

describe('replaceTextKeepingTags', () => {
  it('하위 태그 위치를 지키며 바뀐 부분만 넣는다', async () => {
    const { replaceTextKeepingTags } = await import('../hwpx-parser');
    expect(replaceTextKeepingTags('A<hp:tab/>B', 'A<hp:tab/>C'.replace('<hp:tab/>', ''))).toBe('A<hp:tab/>C');
    expect(replaceTextKeepingTags('4주<hp:lineBreak/>운영', '6주운영')).toBe('6주<hp:lineBreak/>운영');
    expect(replaceTextKeepingTags('a&amp;b', 'a&c')).toBe('a&amp;c');
    expect(replaceTextKeepingTags('<hp:tab/>', '새 글')).toBe('<hp:tab/>새 글');
  });
});

describe('서식 유지 HWPX 저장 파일 형식', () => {
  it('mimetype을 첫 항목·무압축으로 둬 한글이 HWPX로 알아본다', async () => {
    // 원본에서 mimetype이 첫 항목이 아니고 압축되어 있어도 바로잡는다
    const zip = new JSZip();
    zip.file('Contents/section0.xml', '<hs:sec xmlns:hs="s" xmlns:hp="p"><hp:p><hp:run><hp:t>2025</hp:t></hp:run></hp:p></hs:sec>');
    zip.file('version.xml', '<?xml version="1.0"?><hv:HCFVersion xmlns:hv="v"/>');
    zip.file('mimetype', 'application/hwp+zip');
    const file = new File([await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })], 'a.hwpx');

    const bytes = Buffer.from(await (await fillHwpxTemplate(file, [{ idx: 0, value: '2026' }])).arrayBuffer());
    expect(bytes.readUInt32LE(0)).toBe(0x04034b50);
    expect(bytes.readUInt16LE(8)).toBe(0); // 0 = STORE
    expect(bytes.subarray(30, 38).toString('ascii')).toBe('mimetype');
    expect(bytes.subarray(38, 38 + 19).toString('ascii')).toBe('application/hwp+zip');

    const outZip = await JSZip.loadAsync(bytes);
    expect(Object.keys(outZip.files)[0]).toBe('mimetype');
    // version.xml도 무압축이라 원문이 그대로 들어 있다
    expect(bytes.includes(Buffer.from('<hv:HCFVersion'))).toBe(true);
    expect(await outZip.file('Contents/section0.xml')!.async('string')).toContain('<hp:t>2026</hp:t>');
  });
});

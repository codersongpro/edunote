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

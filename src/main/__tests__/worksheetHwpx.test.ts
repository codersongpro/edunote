import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { buildHwpxZip } from '../HwpxGenerator';
import { markdownOrHtmlToHtml } from '../../renderer/lib/generatedContent';

// AI가 만드는 학생용 워크시트는 <style>이 들어 있는 전체 HTML 문서다.
// 미리보기(sanitizeHtml → innerHTML)를 거쳐 HWPX 저장으로 넘어가는 실제 경로를 그대로 재현한다.
const WORKSHEET_HTML = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><title>일이 일어난 순서에 맞게 말해요</title>
<style>
@page { size: A4; margin: 12mm 14mm; }
html, body { width: 100%; max-width: 100%; box-sizing: border-box; }
body { font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; font-size: 12pt; }
.student-info .fill { display: inline-block; min-width: 50pt; border-bottom: 1pt solid #333; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th, td { border: 0.8pt solid #444; padding: 3pt 5pt; }
* { box-sizing: border-box; max-width: 100%; }
</style></head>
<body>
<h1 style="text-align:center;">일이 일어난 순서에 맞게 말해요</h1>
<div class="student-info" style="display:flex;gap:16pt;justify-content:flex-end;"><span>2학년</span><span>반: <span class="fill">&nbsp;</span></span><span>이름: <span class="fill">&nbsp;</span></span></div>
<div class="worksheet-image"><img src="data:image/png;base64,AAAA"></div>
<section class="activity" data-question-id="q1">
<h2>활동 1 씨앗 심기 순서 맞추기</h2>
<p>보기를 읽고 순서를 &lt;표&gt;에 쓰세요. &mdash; 잘 살펴봅니다.</p>
<table style="border-collapse:collapse;width:100%;">
<colgroup><col style="width:18%"><col style="width:62%"><col style="width:20%"></colgroup>
<thead><tr><th>구분</th><th>씨앗을 심는 과정</th><th>순서</th></tr></thead>
<tbody>
<tr><td>보기 가</td><td>흙에 작은 구멍을 파고 토마토 씨앗을 넣습니다.</td><td>(&nbsp;&nbsp;&nbsp;)</td></tr>
<tr><td>보기 나</td><td>화분에 흙을 조심스럽게 담습니다.</td><td>(&nbsp;&nbsp;&nbsp;)</td></tr>
</tbody></table>
<p><input type="checkbox"> 순서를 다시 확인했습니다.
<div class="answer-lines"></div>
</section>
</body></html>`;

// 화면 미리보기를 거쳐 HWPX 저장으로 넘어가는 문자열을 만든다 (GeneratedDisplay와 동일한 흐름).
function asSavedContent(html: string): string {
  const el = document.createElement('div');
  el.innerHTML = markdownOrHtmlToHtml(html);
  return markdownOrHtmlToHtml(el.innerHTML);
}

describe('워크시트 HWPX 저장', () => {
  it('CSS가 본문에 새지 않고 제목·표·문항 서식이 유지된다', async () => {
    const buf = await buildHwpxZip('워크시트', asSavedContent(WORKSHEET_HTML), {});
    const zip = await JSZip.loadAsync(buf);
    const section = await zip.file('Contents/section0.xml')!.async('string');

    // <style>의 CSS와 <head>의 정보가 본문 문단으로 들어가지 않는다
    expect(section).not.toContain('@page');
    expect(section).not.toContain('box-sizing');
    expect(section).not.toContain('font-family');

    // 서식 유지 경로(평문 폴백이 아님) — 제목 22pt 가운데, 표는 hp:tbl 구조
    expect(section).toMatch(/paraPrIDRef="16"[^>]*><hp:run charPrIDRef="7"><hp:t>일이 일어난 순서에 맞게 말해요<\/hp:t>/);
    expect(section).toMatch(/<hp:tbl [^>]*rowCnt="3" colCnt="3"/);
    expect(section).toContain('<hp:t>흙에 작은 구멍을 파고 토마토 씨앗을 넣습니다.</hp:t>');
    // flex로 띄운 기입란이 붙어 나오지 않는다
    expect(section).toMatch(/<hp:t>2학년 반: /);
    // 체크박스는 기호로, 이름 있는 엔티티는 실제 문자로 남는다
    expect(section).toContain('☐ 순서를 다시 확인했습니다.');
    expect(section).toContain('— 잘 살펴봅니다.');
    expect(section).not.toContain('mdash');
  });

  it('저장된 모든 XML 항목이 유효한 XML이다', async () => {
    const buf = await buildHwpxZip('워크시트', asSavedContent(WORKSHEET_HTML), {});
    const zip = await JSZip.loadAsync(buf);
    for (const name of Object.keys(zip.files)) {
      if (!name.endsWith('.xml') && !name.endsWith('.hpf')) continue;
      const xml = await zip.file(name)!.async('string');
      const doc = new DOMParser({ onError: (level, msg) => { throw new Error(`${name}: ${msg}`); } })
        .parseFromString(xml, 'text/xml');
      expect(doc.documentElement).toBeTruthy();
    }
  });
});

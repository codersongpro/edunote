import { describe, expect, it } from 'vitest';
import { readParagraphLayouts, rebuildLinesegArray, relayoutChangedParagraphs } from '../hwpxLineseg';

// 사용자 계획서의 실제 값: 글자 높이 1200, 줄 간격 720, 문단 폭 48188, 첫 줄/이어지는 줄 flags
const seg = (textpos: number, vertpos: number, flags: string) =>
  `<hp:lineseg textpos="${textpos}" vertpos="${vertpos}" vertsize="1200" textheight="1200" baseline="1020" spacing="720" horzpos="0" horzsize="48188" flags="${flags}"/>`;
const twoLines = `<hp:linesegarray>${seg(0, 27784, '393216')}${seg(53, 29704, '1441792')}</hp:linesegarray>`;
const line1 = '  나. 학생, 학부모가 학교생활 전반(학교폭력예방, 생명 존중, 학교적응, 학업 등)에 대해 도움을 받을 ';
const oldText = `${line1}수 있도록 필요 시 Wee센터와 연계 운영`;
const para = (text: string, lineseg = twoLines) => `<hp:p paraPrIDRef="3"><hp:run><hp:t>${text}</hp:t></hp:run>${lineseg}</hp:p>`;
const sec = (body: string) => `<hs:sec xmlns:hs="s" xmlns:hp="p">${body}</hs:sec>`;
const segsOf = (xml: string) => [...xml.matchAll(/<hp:lineseg [^>]*\/>/g)].map(m => ({
  textpos: Number(m[0].match(/textpos="(\d+)"/)![1]),
  vertpos: Number(m[0].match(/vertpos="(\d+)"/)![1]),
  flags: m[0].match(/flags="(\d+)"/)![1],
}));

describe('rebuildLinesegArray', () => {
  it('원본 첫 줄 폭으로 보정해, 원본 글자는 원래와 같은 줄 수로 나눈다', () => {
    const rebuilt = segsOf(rebuildLinesegArray(oldText, oldText, twoLines));
    expect(rebuilt).toHaveLength(2);
    expect(rebuilt[0]).toEqual({ textpos: 0, vertpos: 27784, flags: '393216' });
  });

  it('글자가 늘면 줄을 늘리고 vertpos·flags를 원본 규칙대로 이어 간다', () => {
    const longer = oldText + ' 및 전문상담교사·학부모 상담 연계, 위기 학생 사례 관리와 후속 지원 체계 운영';
    const rebuilt = segsOf(rebuildLinesegArray(oldText, longer, twoLines));
    expect(rebuilt).toHaveLength(3);
    expect(rebuilt.map(s => s.vertpos)).toEqual([27784, 29704, 31624]);
    expect(rebuilt.map(s => s.flags)).toEqual(['393216', '1441792', '1441792']);
    expect(rebuilt[1].textpos).toBeGreaterThan(40);
    expect(rebuilt[2].textpos).toBeGreaterThan(rebuilt[1].textpos);
    expect(rebuilt[2].textpos).toBeLessThan(longer.length);
  });

  it('글자가 줄면 줄도 줄인다', () => {
    expect(segsOf(rebuildLinesegArray(oldText, '  나. 짧은 내용', twoLines))).toHaveLength(1);
  });
});

describe('relayoutChangedParagraphs', () => {
  it('글자 수가 같은 수정(날짜 바꾸기)은 linesegarray를 그대로 둔다', () => {
    const original = sec(para('2025. 4. 4.(금) 상담') + para(oldText));
    const updated = sec(para('2026. 4. 3.(금) 상담') + para(oldText));
    expect(relayoutChangedParagraphs(original, updated)).toBe(updated);
  });

  it('글자 수가 달라진 문단만 다시 만들고, 표 칸 안 문단과 바깥 문단을 구분한다', () => {
    const cellLineseg = `<hp:linesegarray>${seg(0, 0, '393216')}</hp:linesegarray>`;
    const outerLineseg = `<hp:linesegarray>${seg(0, 5000, '393216')}</hp:linesegarray>`;
    const table = (cellText: string) =>
      `<hp:p><hp:run><hp:tbl><hp:tr><hp:tc><hp:subList>${para(cellText, cellLineseg)}</hp:subList></hp:tc></hp:tr></hp:tbl></hp:run>${outerLineseg}</hp:p>`;
    const longCell = '상담 기간 6주 운영 및 학부모 대상 안내 자료 배부, 담임교사 개별 상담 일정 조율과 결과 기록 정리';
    const original = sec(table('상담 기간 4주 운영') + para(oldText));
    const updated = sec(table(longCell) + para(oldText));
    const result = relayoutChangedParagraphs(original, updated);

    const layouts = readParagraphLayouts(result);
    expect(layouts.map(p => p.text.slice(0, 6))).toEqual(['', '상담 기간 ', line1.slice(0, 6)]);
    expect(layouts[0].lineseg!.xml).toBe(outerLineseg);
    expect(segsOf(layouts[1].lineseg!.xml).length).toBeGreaterThan(1);
    expect(layouts[2].lineseg!.xml).toBe(twoLines);
  });

  it('글자 노드 속 탭은 한 글자로 센다', () => {
    const [p] = readParagraphLayouts('<hp:p><hp:run><hp:t>가.<hp:tab width="1"/>내용 &amp; 안내</hp:t></hp:run></hp:p>');
    expect(p.text).toBe('가.　내용 x 안내');
  });
});

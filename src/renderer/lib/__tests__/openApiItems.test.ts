import { describe, expect, it } from 'vitest';
import { readApiItemCount, readApiItemRows } from '../openApiItems';

const wrap = (items: unknown) => ({ response: { body: { items } } });

describe('공공데이터 응답 항목 읽기', () => {
  it('items.item 배열을 읽는다', () => {
    const rows = readApiItemRows(wrap({ item: [{ a: 1 }, { a: 2 }] }));

    expect(rows).toHaveLength(2);
  });

  it('items가 곧바로 배열인 형태도 읽는다', () => {
    expect(readApiItemRows(wrap([{ a: 1 }]))).toHaveLength(1);
  });

  it('결과가 한 건이라 객체 하나로 와도 읽는다', () => {
    expect(readApiItemRows(wrap({ item: { a: 1 } }))).toHaveLength(1);
  });

  it('결과가 없으면 빈 배열을 돌려준다', () => {
    expect(readApiItemRows(wrap([]))).toEqual([]);
    expect(readApiItemRows(wrap(undefined))).toEqual([]);
    expect(readApiItemRows(null)).toEqual([]);
    expect(readApiItemRows({})).toEqual([]);
  });

  it('첫 항목의 필드 이름을 알려준다', () => {
    const summary = readApiItemCount(wrap({
      item: [{ prdctClsfcNoNm: '복사용지', cntrctPrceAmt: 4500, cntrctCorpNm: '가나문구' }],
    }));

    expect(summary.count).toBe(1);
    expect(summary.fieldNames).toBe('prdctClsfcNoNm, cntrctPrceAmt, cntrctCorpNm');
  });

  it('필드가 많으면 앞쪽만 보여주고 나머지 개수를 알려준다', () => {
    const row: Record<string, number> = {};
    for (let i = 0; i < 20; i += 1) row[`field${i}`] = i;

    const summary = readApiItemCount(wrap({ item: [row] }));

    expect(summary.fieldNames).toContain('field0');
    expect(summary.fieldNames).toContain('외 6개');
  });

  it('항목이 없으면 개수 0과 빈 필드 목록을 돌려준다', () => {
    expect(readApiItemCount(wrap([]))).toEqual({ count: 0, fieldNames: '' });
  });
});

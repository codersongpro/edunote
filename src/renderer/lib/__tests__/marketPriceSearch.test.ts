import { describe, expect, it } from 'vitest';
import {
  buildMarketPriceSearchPrompt,
  parseMarketPriceItems,
} from '../marketPriceSearch';

describe('웹 검색 시중가 조사 프롬프트', () => {
  it('키워드와 웹 검색·JSON 형식 요구를 함께 전달한다', () => {
    const prompt = buildMarketPriceSearchPrompt('보드게임');

    expect(prompt).toContain('"보드게임"');
    expect(prompt).toContain('반드시 웹 검색을 실행하고');
    expect(prompt).toContain('반드시 JSON 배열만 응답해');
    expect(prompt).toContain('name, spec, maker, unitPrice, sourceUrl');
    expect(prompt).toContain('추정 가격을 만들어 넣지 마');
  });

  it('요청 개수를 지정할 수 있다', () => {
    expect(buildMarketPriceSearchPrompt('태블릿', 5)).toContain('5개 이내');
  });
});

describe('웹 검색 시중가 결과 해석', () => {
  it('정상 응답을 참고 단가 목록으로 만든다', () => {
    const items = parseMarketPriceItems(JSON.stringify([
      { name: 'A4 복사용지 500매', spec: '75g/㎡', maker: '한국제지', unitPrice: 4500, sourceUrl: 'https://example.com/a4' },
    ]));

    expect(items).toEqual([{
      name: 'A4 복사용지 500매',
      spec: '75g/㎡',
      maker: '한국제지',
      unitPrice: 4500,
      sourceUrl: 'https://example.com/a4',
    }]);
  });

  it('코드블록으로 감싼 응답도 해석한다', () => {
    const items = parseMarketPriceItems('```json\n[{"name":"보드게임","unitPrice":"25,000원"}]\n```');

    expect(items).toHaveLength(1);
    expect(items[0].unitPrice).toBe(25000);
    expect(items[0].spec).toBe('');
  });

  it('이름이나 단가가 없는 항목은 버린다', () => {
    const items = parseMarketPriceItems(JSON.stringify([
      { name: '', unitPrice: 1000 },
      { name: '가격 미확인 제품', unitPrice: 0 },
      { name: '수량만 있는 제품' },
      { name: '정상 제품', unitPrice: 12000 },
    ]));

    expect(items.map(item => item.name)).toEqual(['정상 제품']);
  });

  it('같은 이름과 단가가 반복되면 한 번만 남긴다', () => {
    const items = parseMarketPriceItems(JSON.stringify([
      { name: '태블릿 거치대', unitPrice: 15000 },
      { name: '태블릿 거치대', unitPrice: 15000 },
      { name: '태블릿 거치대', unitPrice: 19000 },
    ]));

    expect(items).toHaveLength(2);
  });

  it('http·https가 아닌 출처 주소는 버린다', () => {
    const items = parseMarketPriceItems(JSON.stringify([
      { name: '제품A', unitPrice: 1000, sourceUrl: 'javascript:alert(1)' },
      { name: '제품B', unitPrice: 2000, sourceUrl: '판매처 홈페이지' },
      { name: '제품C', unitPrice: 3000, sourceUrl: 'https://shop.example.com/c' },
    ]));

    expect(items.map(item => item.sourceUrl)).toEqual(['', '', 'https://shop.example.com/c']);
  });

  it('비정상적으로 큰 금액은 단가로 쓰지 않는다', () => {
    const items = parseMarketPriceItems(JSON.stringify([
      { name: '오류 단가 제품', unitPrice: 999999999999 },
    ]));

    expect(items).toHaveLength(0);
  });

  it('JSON이 아니면 안내 오류를 던진다', () => {
    expect(() => parseMarketPriceItems('가격을 찾지 못했습니다.'))
      .toThrowError('AI 응답을 해석하지 못했습니다. 다시 시도해주세요.');
  });
});

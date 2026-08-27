import { describe, expect, it } from 'vitest';
import {
  SHOPPING_MALL_REQUIRED_KEYS,
  SHOPPING_MALL_SEARCH_KEYS,
  THNG_LIST_SEARCH_KEYS,
  buildShoppingMallParams,
  buildThngListParams,
} from '../naramarketRequest';

describe('종합쇼핑몰 품목정보 요청', () => {
  it('명세의 필수 요청변수를 모두 담는다', () => {
    // inqryDiv를 빠뜨려 [04] HTTP 에러가 났던 회귀를 막는다.
    const params = buildShoppingMallParams('prdctClsfcNoNm', '복사용지', 1);

    for (const key of SHOPPING_MALL_REQUIRED_KEYS) {
      expect(params.get(key), `${key}가 빠졌습니다`).toBeTruthy();
    }
    expect(params.get('inqryDiv')).toBe('1');
  });

  it('검색어를 지정한 항목에 넣고 응답 형식을 json으로 요청한다', () => {
    const params = buildShoppingMallParams('dtilPrdctClsfcNoNm', 'A4 용지', 2);

    expect(params.get('dtilPrdctClsfcNoNm')).toBe('A4 용지');
    expect(params.get('type')).toBe('json');
    expect(params.get('pageNo')).toBe('2');
  });

  it('검색 항목은 품명 → 세부품명 → 물품규격명 순서로 시도한다', () => {
    // 일반 검색어(복사용지)는 물품규격명이 아니라 품명에 해당하므로 품명이 먼저다.
    expect(SHOPPING_MALL_SEARCH_KEYS).toEqual([
      'prdctClsfcNoNm',
      'dtilPrdctClsfcNoNm',
      'prdctIdntNoNm',
    ]);
  });

  it('잘못된 페이지 번호는 1로 보정한다', () => {
    expect(buildShoppingMallParams('prdctClsfcNoNm', '가위', 0).get('pageNo')).toBe('1');
    expect(buildShoppingMallParams('prdctClsfcNoNm', '가위', -3).get('pageNo')).toBe('1');
    expect(buildShoppingMallParams('prdctClsfcNoNm', '가위', Number.NaN).get('pageNo')).toBe('1');
  });

  it('한글 검색어는 UTF-8 퍼센트 인코딩으로 직렬화된다', () => {
    const query = buildShoppingMallParams('prdctClsfcNoNm', '복사용지', 1).toString();

    expect(query).toContain('prdctClsfcNoNm=%EB%B3%B5%EC%82%AC%EC%9A%A9%EC%A7%80');
  });
});

describe('물품목록정보 요청', () => {
  it('이 서비스는 inqryDiv를 쓰지 않는다', () => {
    // 서비스마다 필수값이 달라, 공용 조립 함수를 쓰면 없는 항목이 섞여 들어간다.
    const params = buildThngListParams('krnPrdctNm', '복사용지', 1);

    expect(params.get('inqryDiv')).toBeNull();
    expect(params.get('krnPrdctNm')).toBe('복사용지');
    expect(params.get('pageNo')).toBe('1');
    expect(params.get('numOfRows')).toBeTruthy();
  });

  it('검색 항목 목록을 정의한다', () => {
    expect(THNG_LIST_SEARCH_KEYS).toEqual([
      'krnPrdctNm',
      'prdctClsfcNoNm',
      'dtilPrdctClsfcNoNm',
    ]);
  });
});

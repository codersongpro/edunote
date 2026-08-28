import { describe, expect, it } from 'vitest';
import {
  collectFirstNonEmpty,
  SHOPPING_MALL_INQRY_VARIANTS,
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

  it('조회구분 두 가지를 준비하고, 기간 기준에는 조회기준일자를 함께 보낸다', () => {
    // inqryDiv=1(기간 기준)인데 기간을 안 보내면 결과가 비어 돌아온다.
    const [byPeriod, byCondition] = SHOPPING_MALL_INQRY_VARIANTS;
    const today = new Date('2026-08-27T00:00:00');

    const periodParams = buildShoppingMallParams('prdctClsfcNoNm', '복사용지', 1, byPeriod, today);
    expect(periodParams.get('inqryDiv')).toBe('1');
    expect(periodParams.get('inqryEndDate')).toBe('20260827');
    expect(periodParams.get('inqryBgnDate')).toBe('20250827');

    const conditionParams = buildShoppingMallParams('prdctClsfcNoNm', '복사용지', 1, byCondition, today);
    expect(conditionParams.get('inqryDiv')).toBe('2');
    expect(conditionParams.get('inqryBgnDate')).toBeNull();
    expect(conditionParams.get('inqryEndDate')).toBeNull();
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

describe('순차 조회', () => {
  const readItems = (value: unknown[]) => value;

  it('결과가 나오면 남은 조합은 호출하지 않는다', async () => {
    // 6개를 한꺼번에 병렬로 던져 전부 타임아웃 나던 문제를 막는다.
    const calls: string[] = [];
    const runner = (name: string, items: unknown[]) => async () => {
      calls.push(name);
      return items;
    };

    const result = await collectFirstNonEmpty(
      [runner('첫째', []), runner('둘째', [{ a: 1 }]), runner('셋째', [{ b: 2 }])],
      readItems,
    );

    expect(calls).toEqual(['첫째', '둘째']);
    expect(result.items).toHaveLength(1);
    expect(result.attempts).toBe(2);
  });

  it('일부가 실패해도 다음 조합의 결과를 쓴다', async () => {
    const result = await collectFirstNonEmpty(
      [
        async () => { throw new Error('타임아웃'); },
        async () => [{ a: 1 }],
      ],
      readItems,
    );

    expect(result.items).toHaveLength(1);
    expect(result.failures).toHaveLength(1);
  });

  it('모두 실패하면 실패 목록을 그대로 돌려준다', async () => {
    const result = await collectFirstNonEmpty(
      [
        async () => { throw new Error('첫째 실패'); },
        async () => { throw new Error('둘째 실패'); },
      ],
      readItems,
    );

    expect(result.items).toEqual([]);
    expect(result.failures).toHaveLength(2);
    expect(result.attempts).toBe(2);
  });

  it('모두 성공했지만 0건이면 오류 없이 빈 결과가 된다', async () => {
    const result = await collectFirstNonEmpty([async () => [], async () => []], readItems);

    expect(result.items).toEqual([]);
    expect(result.failures).toEqual([]);
  });

  it('전체 제한 시간을 넘기면 더 시도하지 않는다', async () => {
    let clock = 0;
    const calls: string[] = [];
    const slow = (name: string) => async () => {
      calls.push(name);
      clock += 40_000; // 한 번 호출할 때마다 40초가 흐른 것으로 둔다
      return [] as unknown[];
    };

    await collectFirstNonEmpty(
      [slow('첫째'), slow('둘째'), slow('셋째')],
      readItems,
      { deadlineMs: 60_000, now: () => clock },
    );

    // 첫 호출은 항상 하고, 제한 시간을 넘긴 뒤에는 멈춘다.
    expect(calls).toEqual(['첫째', '둘째']);
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

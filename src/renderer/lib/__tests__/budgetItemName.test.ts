import { describe, expect, it } from 'vitest';
import { buildNaraDisplayName, extractNaraIdNo, formatItemNameWithIdNo, pickNaraIdNo } from '../budgetItemName';

describe('나라장터 물품식별번호 판별', () => {
  it('숫자로만 된 값을 식별번호로 본다', () => {
    expect(extractNaraIdNo('23456789')).toBe('23456789');
    expect(extractNaraIdNo('  23456789  ')).toBe('23456789');
  });

  it('앱 내부 식별자는 식별번호로 보지 않는다', () => {
    // 이 값들이 품목명에 섞여 들어가면 안 된다.
    expect(extractNaraIdNo('example-draft')).toBe('');
    expect(extractNaraIdNo('ai-generated')).toBe('');
    expect(extractNaraIdNo('market-복사용지-4500')).toBe('');
    expect(extractNaraIdNo('')).toBe('');
    expect(extractNaraIdNo(undefined)).toBe('');
  });

  it('8자리가 아닌 숫자는 식별번호로 보지 않는다', () => {
    expect(extractNaraIdNo('123')).toBe('');
    expect(extractNaraIdNo('123456789012345')).toBe('');
    // 10자리 물품분류번호(책상 5610170301)를 식별번호로 잘못 붙이면 안 된다.
    expect(extractNaraIdNo('5610170301')).toBe('');
  });
});

describe('응답 한 줄에서 물품식별번호 찾기', () => {
  it('알려진 항목 이름을 먼저 본다', () => {
    expect(pickNaraIdNo({ prdctIdntNo: '25262451', prdctClsfcNo: '5610170301' })).toBe('25262451');
  });

  it('이름에 식별(idnt)이 들어간 항목에서도 찾는다', () => {
    expect(pickNaraIdNo({ dtilPrdctIdntNo: '25262451' })).toBe('25262451');
  });

  it('식별번호가 없는 응답에서는 빈 값을 준다', () => {
    expect(pickNaraIdNo({ prdctClsfcNo: '5610170301', krnPrdctNm: '책상' })).toBe('');
  });

  it('우연히 8자리인 다른 값을 식별번호로 뽑지 않는다', () => {
    // 계약종료일(2026.12.31)은 숫자 8자리지만 식별번호가 아니다.
    expect(pickNaraIdNo({ cntrctEndDate: '20261231' })).toBe('');
  });

  it('식별번호 항목이라도 값이 8자리가 아니면 쓰지 않는다', () => {
    expect(pickNaraIdNo({ prdctIdntNo: '', prdctIdntNoNm: '102×51×46mm, 명함꽂이' })).toBe('');
  });
});

describe('예산안 품목명 조합', () => {
  it('식별번호가 있으면 물품명(식별번호) 형태로 만든다', () => {
    expect(formatItemNameWithIdNo('A4 복사용지 80g', '23456789')).toBe('A4 복사용지 80g(23456789)');
  });

  it('식별번호가 없으면 품목명을 그대로 둔다', () => {
    expect(formatItemNameWithIdNo('A4 복사용지 80g', '')).toBe('A4 복사용지 80g');
    expect(formatItemNameWithIdNo('참고가 품목', 'market-복사용지-4500')).toBe('참고가 품목');
  });

  it('이미 같은 식별번호가 붙어 있으면 다시 붙이지 않는다', () => {
    expect(formatItemNameWithIdNo('A4 복사용지(23456789)', '23456789')).toBe('A4 복사용지(23456789)');
  });

  it('품목명이 비어 있으면 식별번호만 남기지 않는다', () => {
    expect(formatItemNameWithIdNo('', '23456789')).toBe('');
    expect(formatItemNameWithIdNo(undefined, '23456789')).toBe('');
  });

  it('앞뒤 공백은 정리한다', () => {
    expect(formatItemNameWithIdNo('  가위  ', '23456789')).toBe('가위(23456789)');
  });
});

describe('검색 결과에 보여줄 자세한 이름', () => {
  it('세부품명과 규격을 이어 붙인다', () => {
    expect(buildNaraDisplayName({
      prdctClsfcNoNm: '복사용지',
      dtilPrdctClsfcNoNm: '백상지복사용지',
      prdctSpecNm: 'A4 80g/㎡',
    })).toBe('백상지복사용지 A4 80g/㎡');
  });

  it('세부품명이 없으면 품명을 쓴다', () => {
    expect(buildNaraDisplayName({ prdctClsfcNoNm: '복사용지', prdctSpecNm: 'A4 80g/㎡' }))
      .toBe('복사용지 A4 80g/㎡');
  });

  it('규격이 없으면 이름만 쓴다', () => {
    expect(buildNaraDisplayName({ dtilPrdctClsfcNoNm: '백상지복사용지' })).toBe('백상지복사용지');
  });

  it('이름에 이미 규격이 들어 있으면 덧붙이지 않는다', () => {
    expect(buildNaraDisplayName({ dtilPrdctClsfcNoNm: '복사용지 A4', prdctSpecNm: 'A4' }))
      .toBe('복사용지 A4');
  });

  it('이름이 될 값이 없으면 빈 문자열을 준다', () => {
    expect(buildNaraDisplayName({ prdctSpecNm: 'A4 80g/㎡' })).toBe('');
    expect(buildNaraDisplayName({})).toBe('');
  });
});

import { describe, expect, it } from 'vitest';
import { extractNaraIdNo, formatItemNameWithIdNo } from '../budgetItemName';

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

  it('너무 짧거나 긴 숫자는 식별번호로 보지 않는다', () => {
    expect(extractNaraIdNo('123')).toBe('');
    expect(extractNaraIdNo('123456789012345')).toBe('');
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

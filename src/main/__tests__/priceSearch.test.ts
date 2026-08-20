import { describe, it, expect } from 'vitest';
import { buildNaverShoppingSearchUrl } from '../priceSearch';

describe('buildNaverShoppingSearchUrl', () => {
  it('품목명을 네이버쇼핑 검색 URL로 만든다', () => {
    expect(buildNaverShoppingSearchUrl('복사용지')).toBe(
      'https://search.shopping.naver.com/search/all?query=%EB%B3%B5%EC%82%AC%EC%9A%A9%EC%A7%80',
    );
  });

  it('공백·특수문자가 포함된 품목명도 안전하게 인코딩한다', () => {
    const url = buildNaverShoppingSearchUrl('A4 복사용지 (500매/box)');
    expect(url.startsWith('https://search.shopping.naver.com/search/all?query=')).toBe(true);
    expect(decodeURIComponent(url.split('query=')[1])).toBe('A4 복사용지 (500매/box)');
  });

  it('앞뒤 공백은 제거한다', () => {
    expect(buildNaverShoppingSearchUrl('  가위  ')).toBe(buildNaverShoppingSearchUrl('가위'));
  });

  it('빈 문자열이면 null을 반환한다', () => {
    expect(buildNaverShoppingSearchUrl('')).toBeNull();
    expect(buildNaverShoppingSearchUrl('   ')).toBeNull();
  });
});

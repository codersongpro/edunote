import { describe, expect, it } from 'vitest';
import { toNaraImageUrl } from '../naraImage';

describe('나라장터 상품 사진 주소 정리', () => {
  it('http·https 주소는 그대로 쓴다', () => {
    expect(toNaraImageUrl('https://shopping.g2b.go.kr/img/a.jpg')).toBe('https://shopping.g2b.go.kr/img/a.jpg');
    expect(toNaraImageUrl('http://shopping.g2b.go.kr/img/a.jpg')).toBe('http://shopping.g2b.go.kr/img/a.jpg');
  });

  it('앞뒤 공백은 정리한다', () => {
    expect(toNaraImageUrl('  https://shopping.g2b.go.kr/img/a.jpg  ')).toBe('https://shopping.g2b.go.kr/img/a.jpg');
  });

  it('스킴이 없는 주소는 https로 채운다', () => {
    expect(toNaraImageUrl('//shopping.g2b.go.kr/img/a.jpg')).toBe('https://shopping.g2b.go.kr/img/a.jpg');
  });

  it('빈 값과 자리표시 값은 썸네일로 쓰지 않는다', () => {
    expect(toNaraImageUrl('')).toBe('');
    expect(toNaraImageUrl('   ')).toBe('');
    expect(toNaraImageUrl('-')).toBe('');
    expect(toNaraImageUrl(undefined)).toBe('');
    expect(toNaraImageUrl(null)).toBe('');
  });

  it('http·https가 아닌 주소는 버린다', () => {
    expect(toNaraImageUrl('data:image/png;base64,AAAA')).toBe('');
    expect(toNaraImageUrl('javascript:alert(1)')).toBe('');
    expect(toNaraImageUrl('/img/a.jpg')).toBe('');
  });
});

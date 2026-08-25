import { describe, it, expect } from 'vitest';
import { buildEduReferenceSearchUrl } from '../eduReferenceSearch';

describe('buildEduReferenceSearchUrl', () => {
  it('교육 주제를 go.kr로 범위를 좁힌 검색 URL로 만든다', () => {
    const url = buildEduReferenceSearchUrl('정보통신윤리교육');
    expect(url?.startsWith('https://www.google.com/search?q=')).toBe(true);
    expect(decodeURIComponent(url!.split('q=')[1])).toBe('정보통신윤리교육 교직원 연수 자료 site:go.kr');
  });

  it('공백·특수문자가 포함된 주제도 안전하게 인코딩한다', () => {
    const url = buildEduReferenceSearchUrl('청렴교육 (부패방지 & 이해충돌)');
    expect(decodeURIComponent(url!.split('q=')[1])).toBe('청렴교육 (부패방지 & 이해충돌) 교직원 연수 자료 site:go.kr');
  });

  it('앞뒤 공백은 제거한다', () => {
    expect(buildEduReferenceSearchUrl('  청렴교육  ')).toBe(buildEduReferenceSearchUrl('청렴교육'));
  });

  it('빈 문자열이면 null을 반환한다', () => {
    expect(buildEduReferenceSearchUrl('')).toBeNull();
    expect(buildEduReferenceSearchUrl('   ')).toBeNull();
  });
});

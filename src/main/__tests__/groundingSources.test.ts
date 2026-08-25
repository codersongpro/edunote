import { describe, it, expect } from 'vitest';
import { extractGroundingInfo, mergeGroundingInfo } from '../groundingSources';

const responseWith = (metadata: unknown) => ({ candidates: [{ groundingMetadata: metadata }] });

describe('extractGroundingInfo', () => {
  it('groundingChunks에서 출처 제목과 URL을 뽑는다', () => {
    const info = extractGroundingInfo(responseWith({
      groundingChunks: [
        { web: { title: '교육부 보도자료', uri: 'https://www.moe.go.kr/a' } },
        { web: { title: '충북교육청 안내', uri: 'https://www.cbe.go.kr/b' } },
      ],
    }));
    expect(info?.sources).toEqual([
      { title: '교육부 보도자료', uri: 'https://www.moe.go.kr/a' },
      { title: '충북교육청 안내', uri: 'https://www.cbe.go.kr/b' },
    ]);
  });

  it('같은 URL이 여러 번 인용되면 한 번만 남긴다', () => {
    const info = extractGroundingInfo(responseWith({
      groundingChunks: [
        { web: { title: '교육부', uri: 'https://www.moe.go.kr/a' } },
        { web: { title: '교육부', uri: 'https://www.moe.go.kr/a' } },
      ],
    }));
    expect(info?.sources).toHaveLength(1);
  });

  it('제목이 없으면 URL을 제목으로 쓴다', () => {
    const info = extractGroundingInfo(responseWith({
      groundingChunks: [{ web: { uri: 'https://www.moe.go.kr/a' } }],
    }));
    expect(info?.sources[0].title).toBe('https://www.moe.go.kr/a');
  });

  it('URL이 없는 항목은 건너뛴다', () => {
    const info = extractGroundingInfo(responseWith({
      groundingChunks: [{ web: { title: '제목만 있음' } }, { web: { uri: 'https://www.moe.go.kr/a' } }],
    }));
    expect(info?.sources).toHaveLength(1);
  });

  it('검색어와 검색 제안 위젯 HTML을 함께 반환한다', () => {
    const info = extractGroundingInfo(responseWith({
      groundingChunks: [{ web: { uri: 'https://www.moe.go.kr/a' } }],
      webSearchQueries: ['청렴교육 최신 사례', ''],
      searchEntryPoint: { renderedContent: '<div>chips</div>' },
    }));
    expect(info?.searchQueries).toEqual(['청렴교육 최신 사례']);
    expect(info?.searchSuggestionHtml).toBe('<div>chips</div>');
  });

  it('그라운딩 정보가 없으면 null을 반환한다', () => {
    expect(extractGroundingInfo(undefined)).toBeNull();
    expect(extractGroundingInfo({})).toBeNull();
    expect(extractGroundingInfo(responseWith(undefined))).toBeNull();
    expect(extractGroundingInfo(responseWith({}))).toBeNull();
    expect(extractGroundingInfo(responseWith({ groundingChunks: [] }))).toBeNull();
  });
});

describe('mergeGroundingInfo', () => {
  const one = { sources: [{ title: 'a', uri: 'https://a' }], searchQueries: [], searchSuggestionHtml: '' };
  const two = {
    sources: [{ title: 'a', uri: 'https://a' }, { title: 'b', uri: 'https://b' }],
    searchQueries: [],
    searchSuggestionHtml: '',
  };

  it('출처가 더 많은 쪽을 남긴다', () => {
    expect(mergeGroundingInfo(one, two)).toBe(two);
    expect(mergeGroundingInfo(two, one)).toBe(two);
  });

  it('한쪽이 없으면 있는 쪽을 남긴다', () => {
    expect(mergeGroundingInfo(null, one)).toBe(one);
    expect(mergeGroundingInfo(one, null)).toBe(one);
    expect(mergeGroundingInfo(null, null)).toBeNull();
  });
});

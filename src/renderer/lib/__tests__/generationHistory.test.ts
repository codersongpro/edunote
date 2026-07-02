import { describe, it, expect, afterEach } from 'vitest';
import { saveHistory, getHistory } from '../generationHistory';

afterEach(() => {
  localStorage.clear();
});

function countHistKeys(): number {
  let n = 0;
  for (let i = 0; i < localStorage.length; i++) {
    if (localStorage.key(i)?.startsWith('eduHist_')) n++;
  }
  return n;
}

describe('saveHistory', () => {
  it('항목당 최근 3개까지만 보관한다', () => {
    saveHistory('opinion', '홍길동', 'A');
    saveHistory('opinion', '홍길동', 'B');
    saveHistory('opinion', '홍길동', 'C');
    saveHistory('opinion', '홍길동', 'D');
    const h = getHistory('opinion', '홍길동');
    expect(h.map(e => e.content)).toEqual(['D', 'C', 'B']);
  });

  it('직전과 동일한 내용은 중복 저장하지 않는다', () => {
    saveHistory('opinion', '김철수', 'same');
    saveHistory('opinion', '김철수', 'same');
    expect(getHistory('opinion', '김철수')).toHaveLength(1);
  });

  it('빈 내용은 저장하지 않는다', () => {
    saveHistory('opinion', '이영희', '   ');
    expect(getHistory('opinion', '이영희')).toHaveLength(0);
  });

  it('키 총량이 상한(300)을 넘으면 오래된 키부터 정리한다', () => {
    const base = Date.now();
    // 350명 저장하되, date를 조작해 오래된 순서를 명확히 만든다.
    for (let i = 0; i < 350; i++) {
      const key = `eduHist_opinion_학생${i}`;
      localStorage.setItem(key, JSON.stringify([{ content: `c${i}`, date: new Date(base + i).toISOString() }]));
    }
    expect(countHistKeys()).toBe(350);
    // 새 저장이 프루닝을 유발한다.
    saveHistory('opinion', '신규학생', 'new');
    expect(countHistKeys()).toBeLessThanOrEqual(300);
    // 가장 오래된 학생0은 제거되고, 방금 저장한 신규학생은 남아야 한다.
    expect(getHistory('opinion', '학생0')).toHaveLength(0);
    expect(getHistory('opinion', '신규학생')).toHaveLength(1);
  });
});

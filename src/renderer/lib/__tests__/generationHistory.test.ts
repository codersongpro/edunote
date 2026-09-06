import { describe, it, expect, afterEach } from 'vitest';
import { saveHistory, getHistory, getHistoryGroups, clearAllHistory, DOCUMENT_HISTORY_KEY_PREFIX, clearDocumentHistory } from '../generationHistory';

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

  it('교과와 창체 이력을 과목·활동별로 분리하고 각 맥락마다 3개씩 보관한다', () => {
    for (const value of ['국어1', '국어2', '국어3', '국어4']) saveHistory('subject', '홍길동', value, '국어');
    for (const value of ['수학1', '수학2', '수학3', '수학4']) saveHistory('subject', '홍길동', value, '수학');
    saveHistory('creative', '홍길동', '자율 내용', '자율활동');

    expect(getHistory('subject', '홍길동', '국어').map(entry => entry.content)).toEqual(['국어4', '국어3', '국어2']);
    expect(getHistory('subject', '홍길동', '수학').map(entry => entry.content)).toEqual(['수학4', '수학3', '수학2']);
    expect(getHistory('creative', '홍길동', '자율활동').map(entry => entry.content)).toEqual(['자율 내용']);
  });

  it('구분자가 포함된 이름과 맥락도 키 충돌 없이 분리한다', () => {
    saveHistory('subject', '가_나', '첫 내용', '다');
    saveHistory('subject', '가', '둘째 내용', '나_다');
    expect(getHistory('subject', '가_나', '다')[0].content).toBe('첫 내용');
    expect(getHistory('subject', '가', '나_다')[0].content).toBe('둘째 내용');
  });

  it('이전 버전 이력은 맥락을 추측하거나 새 이력에 복제하지 않고 별도 그룹으로 보존한다', () => {
    saveHistory('subject', '홍길동', '이전 버전 내용');
    saveHistory('subject', '홍길동', '국어 새 내용', '국어');

    const groups = getHistoryGroups('subject', '홍길동');
    expect(groups).toEqual(expect.arrayContaining([
      expect.objectContaining({ context: '국어', legacy: false }),
      expect.objectContaining({ context: null, legacy: true, label: '이전 버전 기록(과목/활동 미상)' }),
    ]));
    expect(groups.flatMap(group => group.entries).map(entry => entry.content).sort())
      .toEqual(['국어 새 내용', '이전 버전 내용'].sort());
  });
});

describe('clearAllHistory', () => {
  it('eduHist_ 접두사 키만 지우고 다른 키는 남긴다', () => {
    saveHistory('opinion', '홍길동', '내용');
    localStorage.setItem('unrelated-key', 'keep-me');
    expect(countHistKeys()).toBeGreaterThan(0);
    clearAllHistory();
    expect(countHistKeys()).toBe(0);
    expect(localStorage.getItem('unrelated-key')).toBe('keep-me');
  });
});

describe('clearDocumentHistory', () => {
  it('문서 생성 이력 접두사 키만 지우고 다른 키는 남긴다', () => {
    localStorage.setItem(`${DOCUMENT_HISTORY_KEY_PREFIX}가정통신문`, JSON.stringify([{ id: '1' }]));
    localStorage.setItem(`${DOCUMENT_HISTORY_KEY_PREFIX}상담일지`, JSON.stringify([{ id: '2' }]));
    localStorage.setItem('unrelated-key', 'keep-me');
    clearDocumentHistory();
    expect(localStorage.getItem(`${DOCUMENT_HISTORY_KEY_PREFIX}가정통신문`)).toBeNull();
    expect(localStorage.getItem(`${DOCUMENT_HISTORY_KEY_PREFIX}상담일지`)).toBeNull();
    expect(localStorage.getItem('unrelated-key')).toBe('keep-me');
  });
});


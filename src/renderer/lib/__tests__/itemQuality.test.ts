import { describe, expect, it } from 'vitest';
import { checkQuizItems, checkWorksheetItems, extractQuizItems, extractWorksheetItems, normalizeAnswer, type QuizItem } from '../itemQuality';

const mc = (question: string, options: string[], answer: string): QuizItem => ({ type: 'multiple-choice', question, options, answer });

describe('퀴즈 형식 점검', () => {
  it('정답 번호가 한쪽에 몰리거나 세 번 연속되면 알린다', () => {
    const items = [
      mc('광합성에 필요한 기체는?', ['이산화 탄소', '산소', '질소', '수소'], '이산화 탄소'),
      mc('광합성이 일어나는 곳은?', ['엽록체', '뿌리', '줄기 껍질', '꽃잎'], '엽록체'),
      mc('광합성으로 만들어지는 양분은?', ['녹말', '단백질', '지방', '무기염류'], '녹말'),
      mc('광합성에 필요한 에너지는?', ['빛', '소리', '열', '바람'], '빛'),
    ];
    const categories = checkQuizItems(items).map(f => f.category);
    expect(categories.filter(c => c === '정답 위치').length).toBe(2);
  });

  it('정답 보기만 길면 정답 단서로 알리고, "모두 옳다" 보기를 찾는다', () => {
    const findings = checkQuizItems([
      mc('식물이 양분을 만드는 과정은?', ['호흡', '증산', '빛을 이용해 이산화 탄소와 물로 양분을 만드는 광합성', '모두 옳다'], '빛을 이용해 이산화 탄소와 물로 양분을 만드는 광합성'),
    ]);
    expect(findings.map(f => f.category)).toEqual(expect.arrayContaining(['정답 단서', '보기 구성']));
  });

  it('OX 정답이 모두 같으면 알리고, 부정 질문과 저학년 긴 문장을 짚는다', () => {
    const ox = (question: string): QuizItem => ({ type: 'ox', question, answer: 'O' });
    const findings = checkQuizItems([
      ox('해는 동쪽에서 뜹니다.'), ox('물은 높은 곳에서 낮은 곳으로 흐릅니다.'), ox('겨울은 여름보다 춥습니다.'),
      ox('다음 중 우리 동네에서 볼 수 있는 가게가 아닌 것은 무엇인지 알맞게 골라 보고 친구와 이야기해 봅시다.'),
    ], '초등학교 2학년');
    expect(findings.map(f => f.category)).toEqual(expect.arrayContaining(['정답 위치', '부정 질문', '읽기 부담']));
  });

  it('고르게 섞인 정상 문항에는 아무것도 알리지 않는다', () => {
    expect(checkQuizItems([
      mc('가', ['사과', '배', '감', '귤'], '사과'),
      mc('나', ['소', '말', '닭', '개'], '말'),
      mc('다', ['비', '눈', '해', '달'], '해'),
      mc('라', ['산', '강', '들', '숲'], '숲'),
    ])).toEqual([]);
  });
});

describe('워크시트 형식 점검', () => {
  const sheet = (body: string) => `<!DOCTYPE html><html><body>${body}</body></html>`;

  it('강조 없는 부정 질문을 찾고, 강조된 것은 통과시킨다', () => {
    const html = sheet(`
      <section class="question" data-question-id="q1"><p>1. 다음 중 포유류가 아닌 것은? (5점)</p><p>① 개 ② 고래 ③ 닭 ④ 박쥐</p></section>
      <section class="question" data-question-id="q2"><p>2. 다음 중 곤충이 <strong>아닌</strong> 것은? (5점)</p><p>① 개미 ② 거미 ③ 나비 ④ 벌</p></section>
      <p>총점: 10점</p>`);
    const findings = checkWorksheetItems(html, { includeScore: true, grade: '중학교 1학년' });
    expect(findings.filter(f => f.category === '부정 질문').map(f => f.item)).toEqual(['1번']);
    expect(findings.some(f => f.category === '배점')).toBe(false);
  });

  it('배점 누락과 합계 불일치를 알린다', () => {
    const missing = checkWorksheetItems(sheet(`
      <section class="question" data-question-id="q1"><p>1. 물의 상태 세 가지를 쓰시오. (5점)</p></section>
      <section class="question" data-question-id="q2"><p>2. 얼음이 녹는 까닭을 쓰시오.</p></section>`), { includeScore: true, grade: '' });
    expect(missing.find(f => f.category === '배점')?.item).toBe('2번');
    const wrongSum = checkWorksheetItems(sheet(`
      <section class="question" data-question-id="q1"><p>1. 가 (5점)</p></section>
      <section class="question" data-question-id="q2"><p>2. 나 (5점)</p></section><p>총점 20점</p>`), { includeScore: true, grade: '' });
    expect(wrongSum.find(f => f.category === '배점')?.message).toContain('10점');
  });

  it('문항 ID 순서대로 문항 글을 꺼낸다', () => {
    const items = extractWorksheetItems(sheet('<section data-question-id="q1"><p>첫 문항</p></section><section data-question-id="q2"><p>둘째</p></section>'));
    expect(items.map(i => [i.id, i.text])).toEqual([['q1', '첫 문항'], ['q2', '둘째']]);
  });
});

describe('퀴즈 데이터 다시 읽기와 답 비교', () => {
  it('퀴즈 HTML의 문항 데이터를 읽는다', () => {
    const html = '<script>\nvar Q=[{"type":"ox","question":"참이다","answer":"O"}];\nvar idx=0;\n</script>';
    expect(extractQuizItems(html)).toEqual([{ type: 'ox', question: '참이다', answer: 'O' }]);
    expect(extractQuizItems('<p>퀴즈 아님</p>')).toBeNull();
  });

  it('띄어쓰기·문장부호·대소문자 차이는 같은 답으로 본다', () => {
    expect(normalizeAnswer('이산화 탄소.')).toBe(normalizeAnswer('이산화탄소'));
    expect(normalizeAnswer('DNA')).toBe(normalizeAnswer('dna'));
  });
});

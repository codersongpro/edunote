import { describe, it, expect } from 'vitest';
import { findGuidelineViolations } from '../guidelineCompliance';

describe('findGuidelineViolations', () => {
  it('교외 대회와 수상 표현을 감지한다', () => {
    const found = findGuidelineViolations('전국 수학 경시대회에서 금상을 수상함.');
    const terms = found.map(v => v.term);
    expect(terms.some(t => t.includes('경시대회') || t.includes('전국'))).toBe(true);
    expect(terms).toContain('금상');
  });

  it('공인어학시험을 감지한다 (대소문자 무관)', () => {
    expect(findGuidelineViolations('TOEIC 900점을 달성함.').map(v => v.category)).toContain('공인어학시험');
    expect(findGuidelineViolations('토익 점수가 향상됨.').map(v => v.category)).toContain('공인어학시험');
  });

  it('특정 대학명을 감지한다', () => {
    expect(findGuidelineViolations('서울대 진학을 희망하여 노력함.').map(v => v.category)).toContain('특정 대학명');
  });

  it('논문·특허·어학연수를 감지한다', () => {
    const categories = findGuidelineViolations('논문을 작성하고 특허를 출원했으며 어학연수를 다녀옴.').map(v => v.category);
    expect(categories).toContain('논문·출판·지식재산권');
    expect(categories).toContain('어학연수');
  });

  it('정상적인 학생기록 문장에서는 아무것도 감지하지 않는다', () => {
    expect(findGuidelineViolations('수업 시간에 적극적으로 참여하며 모둠 활동에서 협력하는 모습이 돋보임. 학급 행사 대상자 선정 과정에서 공정하게 의견을 조율함.')).toEqual([]);
  });

  it('같은 표현은 한 번만 보고한다', () => {
    const found = findGuidelineViolations('토익 토익 토익');
    expect(found).toHaveLength(1);
  });

  it('빈 입력은 빈 배열을 반환한다', () => {
    expect(findGuidelineViolations('')).toEqual([]);
    expect(findGuidelineViolations(undefined as unknown as string)).toEqual([]);
  });
});

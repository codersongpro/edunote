import { describe, it, expect } from 'vitest';
import {
  FEATURES_WITHOUT_KEY,
  FEATURES_NEEDING_KEY,
  API_KEY_SCOPE_SUMMARY,
  type FeatureGroup,
} from '../apiKeyFeatures';

const allFeatures = (groups: FeatureGroup[]): string[] => groups.flatMap(g => g.features);

describe('API 키 필요 여부 안내 목록', () => {
  it('양쪽 모두 비어 있지 않다', () => {
    expect(FEATURES_WITHOUT_KEY.length).toBeGreaterThan(0);
    expect(FEATURES_NEEDING_KEY.length).toBeGreaterThan(0);
  });

  it('같은 기능이 양쪽에 동시에 들어가지 않는다', () => {
    const free = new Set(allFeatures(FEATURES_WITHOUT_KEY));
    const overlap = allFeatures(FEATURES_NEEDING_KEY).filter(name => free.has(name));
    expect(overlap).toEqual([]);
  });

  it('한 목록 안에서 기능 이름이 중복되지 않는다', () => {
    for (const groups of [FEATURES_WITHOUT_KEY, FEATURES_NEEDING_KEY]) {
      const names = allFeatures(groups);
      expect(names.length).toBe(new Set(names).size);
    }
  });

  it('모든 그룹에 영역 이름과 기능이 하나 이상 있다', () => {
    for (const group of [...FEATURES_WITHOUT_KEY, ...FEATURES_NEEDING_KEY]) {
      expect(group.section.trim()).not.toBe('');
      expect(group.features.length).toBeGreaterThan(0);
      expect(group.features.every(name => name.trim() !== '')).toBe(true);
    }
  });

  it('AI 생성 기능은 키가 필요한 쪽에 있다', () => {
    const needing = allFeatures(FEATURES_NEEDING_KEY).join(' ');
    for (const keyword of ['행발생성', '세특', '문서작성기', '수업자료', '간단 번역', '상담일지']) {
      expect(needing).toContain(keyword);
    }
  });

  it('직접 입력·관리하는 기능은 키가 필요 없는 쪽에 있다', () => {
    const free = allFeatures(FEATURES_WITHOUT_KEY).join(' ');
    for (const keyword of ['학생 메모', '양식 인쇄', 'QR 메이커', '공문 보관함', '백업']) {
      expect(free).toContain(keyword);
    }
  });

  it('한 줄 요약이 양쪽 경우를 모두 언급한다', () => {
    expect(API_KEY_SCOPE_SUMMARY).toContain('키가 필요');
    expect(API_KEY_SCOPE_SUMMARY).toContain('키 없이');
  });

  it('예산안작성은 나라장터 인증키가 별개임을 알린다', () => {
    const budget = FEATURES_NEEDING_KEY.find(g => g.section === '예산안작성');
    expect(budget?.note).toContain('나라장터 인증키');
  });
});

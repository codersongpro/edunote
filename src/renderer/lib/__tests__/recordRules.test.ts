import { describe, expect, it } from 'vitest';
import { runRecordRules } from '../recordRules';

describe('runRecordRules', () => {
  it('바이트 상한을 넘으면 오류로 알린다', () => {
    const result = runRecordRules(['가'.repeat(10)], { byteLimit: 20 });
    expect(result[0]).toMatchObject({ idx: -1, category: '분량', severity: 'error' });
  });

  it('기재요령 금지어와 다른 학생 이름을 찾는다', () => {
    const result = runRecordRules(['토익 점수를 높이고 김민수와 협력함.'], {
      studentName: '이서연',
      rosterNames: ['1. 이서연', '김민수', '박'],
    });
    expect(result.map(r => [r.category, r.before])).toEqual(expect.arrayContaining([
      ['기재요령', '토익'],
      ['다른 학생', '김민수'],
    ]));
    expect(result.some(r => r.before === '이서연')).toBe(false);
  });

  it('명사형 끝맺음이 더 많을 때만 "~다."를 안내한다', () => {
    const mixed = runRecordRules(['성실하게 참여함. 발표를 잘함. 친구를 돕는다.'], {});
    expect(mixed.filter(r => r.category === '문체').map(r => r.before)).toEqual(['돕는다.']);
    expect(runRecordRules(['참여한다. 발표한다.'], {}).filter(r => r.category === '문체')).toEqual([]);
  });
});

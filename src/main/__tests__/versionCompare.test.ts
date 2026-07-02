import { describe, it, expect } from 'vitest';
import { semverGt } from '../versionCompare';

describe('semverGt', () => {
  it('상위 버전을 올바르게 판별한다', () => {
    expect(semverGt('1.16.0', '1.15.5')).toBe(true);
    expect(semverGt('2.0.0', '1.99.99')).toBe(true);
    expect(semverGt('1.15.6', '1.15.5')).toBe(true);
  });

  it('같거나 낮은 버전은 false', () => {
    expect(semverGt('1.15.5', '1.15.5')).toBe(false);
    expect(semverGt('1.15.4', '1.15.5')).toBe(false);
    expect(semverGt('1.0.0', '1.0.0')).toBe(false);
  });

  it('접미사(-beta 등)가 붙은 태그도 숫자 부분으로 비교한다', () => {
    // 기존 Number() 방식은 NaN이 되어 업데이트를 놓쳤다.
    expect(semverGt('1.16.0-beta', '1.15.5')).toBe(true);
    expect(semverGt('1.15.6-hotfix.1', '1.15.5')).toBe(true);
    expect(semverGt('1.15.5', '1.16.0-beta')).toBe(false);
  });

  it('세그먼트 개수가 달라도 안전하게 0으로 채운다', () => {
    expect(semverGt('1.16', '1.15.9')).toBe(true);
    expect(semverGt('1', '1.0.1')).toBe(false);
    expect(semverGt('2', '1.9.9')).toBe(true);
  });
});

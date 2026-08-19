import { describe, it, expect } from 'vitest';
import { withStudentPrivacy, withStudentListPrivacy, formatStudentMemos, pickUnusedToken } from '../generationSafety';

describe('withStudentPrivacy', () => {
  it('활성화 시 학생 이름을 토큰으로 치환하고 복원한다', () => {
    const { prompt, restore, applied } = withStudentPrivacy('홍길동 학생의 의견을 써줘', '홍길동', true);
    expect(prompt).toBe('학생1 학생의 의견을 써줘');
    expect(prompt).not.toContain('홍길동');
    expect(applied).toBe(true);
    // 결과 텍스트의 토큰을 다시 원래 이름으로 되돌린다
    expect(restore('학생1 학생은 성실합니다')).toBe('홍길동 학생은 성실합니다');
  });

  it('비활성화 시 프롬프트를 그대로 두고 applied는 false다', () => {
    const { prompt, restore, applied } = withStudentPrivacy('홍길동 학생', '홍길동', false);
    expect(prompt).toBe('홍길동 학생');
    expect(restore('홍길동 학생')).toBe('홍길동 학생');
    expect(applied).toBe(false);
  });

  it('이름이 비어 있으면 그대로 두고 applied는 false다', () => {
    const { prompt, applied } = withStudentPrivacy('내용', '', true);
    expect(prompt).toBe('내용');
    expect(applied).toBe(false);
  });

  it('이름 인자의 앞 번호(예: "3. 홍길동")를 정규화해 본문 속 이름을 치환한다', () => {
    // 이름 인자는 정규화되어 "홍길동"으로 매칭되며, 본문의 "홍길동"만 토큰으로 바뀐다.
    const { prompt } = withStudentPrivacy('3. 홍길동 학생', '3. 홍길동', true);
    expect(prompt).not.toContain('홍길동');
    expect(prompt).toContain('학생1');
  });

  it('이름이 여러 번 나와도 모두 치환한다', () => {
    const { prompt } = withStudentPrivacy('홍길동, 홍길동', '홍길동', true);
    expect(prompt).toBe('학생1, 학생1');
  });

  it('본문에 "학생1"이 이미 있으면 다른 토큰을 골라 기존 문자열을 훼손하지 않는다', () => {
    const { prompt, restore } = withStudentPrivacy('학생1과 홍길동이 함께 발표함', '홍길동', true);
    expect(prompt).toBe('학생1과 학생2이 함께 발표함');
    // 복원 시 원래 있던 "학생1"은 그대로 두고 토큰만 이름으로 되돌린다
    expect(restore(prompt)).toBe('학생1과 홍길동이 함께 발표함');
  });
});

describe('withStudentListPrivacy', () => {
  it('명단의 여러 이름을 각각 다른 토큰으로 치환하고 복원한다', () => {
    const { prompt, restore, applied } = withStudentListPrivacy(
      '김민수는 발표를 잘했고 이지은은 지각함',
      ['김민수', '이지은'],
      true,
    );
    expect(prompt).not.toContain('김민수');
    expect(prompt).not.toContain('이지은');
    expect(applied).toBe(true);
    // 왕복 복원: 마스킹한 프롬프트를 복원하면 원문과 동일해야 한다
    expect(restore(prompt)).toBe('김민수는 발표를 잘했고 이지은은 지각함');
  });

  it('겹치는 이름은 긴 이름부터 치환한다', () => {
    const original = '김민수와 김민이 함께 활동함';
    const { prompt, restore } = withStudentListPrivacy(original, ['김민', '김민수'], true);
    expect(prompt).not.toContain('김민수');
    expect(prompt).not.toContain('김민');
    expect(restore(prompt)).toBe(original);
  });

  it('본문에 "학생1"이 이미 있으면 해당 토큰을 피한다', () => {
    const original = '학생1 모둠에서 김민수가 발표함';
    const { prompt, restore } = withStudentListPrivacy(original, ['김민수'], true);
    expect(prompt).toBe('학생1 모둠에서 학생2가 발표함');
    expect(restore(prompt)).toBe(original);
  });

  it('비활성화이거나 명단이 비어 있으면 그대로 두고 applied는 false다', () => {
    const disabled = withStudentListPrivacy('김민수 발표', ['김민수'], false);
    expect(disabled.prompt).toBe('김민수 발표');
    expect(disabled.applied).toBe(false);
    const emptyRoster = withStudentListPrivacy('김민수 발표', [], true);
    expect(emptyRoster.prompt).toBe('김민수 발표');
    expect(emptyRoster.applied).toBe(false);
  });

  it('본문에 없는 이름과 한 글자 이름은 건너뛰고, 실제로 바뀐 이름이 없으면 applied는 false다', () => {
    const { prompt, applied } = withStudentListPrivacy('김민수가 발표함', ['이지은', '수'], true);
    expect(prompt).toBe('김민수가 발표함');
    expect(applied).toBe(false);
  });

  it('번호가 붙은 명단 이름("3. 김민수")도 정규화해 매칭한다', () => {
    const { prompt } = withStudentListPrivacy('김민수가 발표함', ['3. 김민수'], true);
    expect(prompt).not.toContain('김민수');
  });
});

describe('pickUnusedToken', () => {
  it('본문에 없는 첫 토큰을 고른다', () => {
    expect(pickUnusedToken('아무 내용')).toBe('학생1');
    expect(pickUnusedToken('학생1이 있음')).toBe('학생2');
  });

  it('"학생1"이 있으면 "학생10"류 부분 겹침도 함께 회피된다', () => {
    // '학생1'.includes 검사가 '학생10'이 포함된 본문에서도 참이 되어 건너뛴다
    expect(pickUnusedToken('학생10명이 참여함')).toBe('학생2');
  });

  it('이미 사용한 토큰은 건너뛴다', () => {
    expect(pickUnusedToken('내용', new Set(['학생1', '학생2']))).toBe('학생3');
  });
});

describe('formatStudentMemos', () => {
  it('메모가 없으면 빈 문자열을 반환한다', () => {
    expect(formatStudentMemos()).toBe('');
    expect(formatStudentMemos([])).toBe('');
  });

  it('메모 목록을 번호 매겨 정리한다', () => {
    const result = formatStudentMemos(['지각이 잦음', '발표를 잘함']);
    expect(result).toContain('[학생 메모 참고자료]');
    expect(result).toContain('1. 지각이 잦음');
    expect(result).toContain('2. 발표를 잘함');
  });
});

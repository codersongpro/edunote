import { describe, it, expect } from 'vitest';
import { withStudentPrivacy, formatStudentMemos } from '../generationSafety';

describe('withStudentPrivacy', () => {
  it('활성화 시 학생 이름을 토큰으로 치환하고 복원한다', () => {
    const { prompt, restore } = withStudentPrivacy('홍길동 학생의 의견을 써줘', '홍길동', true);
    expect(prompt).toBe('학생1 학생의 의견을 써줘');
    expect(prompt).not.toContain('홍길동');
    // 결과 텍스트의 토큰을 다시 원래 이름으로 되돌린다
    expect(restore('학생1 학생은 성실합니다')).toBe('홍길동 학생은 성실합니다');
  });

  it('비활성화 시 프롬프트를 그대로 둔다', () => {
    const { prompt, restore } = withStudentPrivacy('홍길동 학생', '홍길동', false);
    expect(prompt).toBe('홍길동 학생');
    expect(restore('홍길동 학생')).toBe('홍길동 학생');
  });

  it('이름이 비어 있으면 그대로 둔다', () => {
    const { prompt } = withStudentPrivacy('내용', '', true);
    expect(prompt).toBe('내용');
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

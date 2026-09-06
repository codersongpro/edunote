import { describe, expect, it } from 'vitest';
import {
  buildStudentAssessmentTasks,
  validateNeisGradeData,
} from '../neisGradeValidation';

describe('validateNeisGradeData', () => {
  const valid = [{
    semester: '1학기',
    subject: '국어',
    tasks: ['발표', '보고서'],
    students: [{ name: '홍길동', evaluations: ['상', '중'] }],
  }];

  it('과제 순서와 정상 평가값을 그대로 보존한다', () => {
    expect(validateNeisGradeData(valid)).toEqual(valid);
  });

  it.each([
    [['상']],
    [['상', null]],
    [[]],
    [['상', '우수']],
  ])('평가 개수 누락, 빈값, 잘못된 등급을 거부한다: %j', (evaluations) => {
    expect(() => validateNeisGradeData([{
      ...valid[0],
      students: [{ name: '홍길동', evaluations }],
    }])).toThrow(/국어.*홍길동/);
  });

  it('학생 구조가 없으면 적용 전에 거부한다', () => {
    expect(() => validateNeisGradeData([{ ...valid[0], students: undefined }])).toThrow(/학생/);
  });

  it('가운데 빈 평가를 뒤 등급으로 당기지 않는다', () => {
    expect(() => validateNeisGradeData([{
      ...valid[0],
      tasks: ['발표', '보고서', '토론'],
      students: [{ name: '홍길동', evaluations: ['상', null, '하'] }],
    }])).toThrow(/2번째/);
  });
});

describe('buildStudentAssessmentTasks', () => {
  const tasks = [
    { id: 'task-1', task: '발표', level: '상' as const, requiresStudentEvaluation: true },
    { id: 'task-2', task: '보고서', level: '상' as const, requiresStudentEvaluation: true },
  ];

  it('학생별 평가가 완전하면 해당 등급으로 생성 입력을 만든다', () => {
    expect(buildStudentAssessmentTasks(tasks, {
      id: 'student-1',
      name: '홍길동',
      additionalContext: '',
      evaluations: [{ id: 'task-1', level: '상' }, { id: 'task-2', level: '중' }],
    }).map(task => task.level)).toEqual(['상', '중']);
  });

  it('NEIS 과제 평가가 누락되면 상으로 대체하지 않고 생성을 차단한다', () => {
    expect(() => buildStudentAssessmentTasks(tasks, {
      id: 'student-1',
      name: '홍길동',
      additionalContext: '',
      evaluations: [{ id: 'task-1', level: '상' }],
    })).toThrow(/홍길동.*보고서/);
  });

  it('직접 입력 과제는 교사가 설정한 과제 기본 등급을 사용한다', () => {
    expect(buildStudentAssessmentTasks([
      { id: 'manual', task: '토론', level: '중' },
    ], {
      id: 'student-1',
      name: '홍길동',
      additionalContext: '',
      evaluations: [],
    })[0].level).toBe('중');
  });
});

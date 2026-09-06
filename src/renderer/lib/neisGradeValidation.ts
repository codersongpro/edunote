import { AssessmentTask, NeisAnalyzedData, StudentSubjectData } from '../types';

const GRADES = new Set(['상', '중', '하']);

const objectValue = (value: unknown): Record<string, unknown> | null => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

export const validateNeisGradeData = (value: unknown): NeisAnalyzedData[] => {
  const rows = Array.isArray(value) ? value : [value];
  if (rows.length === 0) throw new Error('분석 결과에 과목이 없습니다.');

  return rows.map((rawRow, rowIndex) => {
    const row = objectValue(rawRow);
    if (!row) throw new Error(`${rowIndex + 1}번째 과목의 데이터 구조가 올바르지 않습니다.`);

    const semester = typeof row.semester === 'string' ? row.semester.trim() : '';
    const subject = typeof row.subject === 'string' ? row.subject.trim() : '';
    if (!semester) throw new Error(`${rowIndex + 1}번째 과목의 학기 정보가 없습니다.`);
    if (!subject) throw new Error(`${rowIndex + 1}번째 과목명이 없습니다.`);
    if (!Array.isArray(row.tasks) || row.tasks.length === 0 || row.tasks.some(task => typeof task !== 'string' || !task.trim())) {
      throw new Error(`${subject} 과목의 평가 과제 정보가 비어 있거나 올바르지 않습니다.`);
    }
    if (!Array.isArray(row.students) || row.students.length === 0) {
      throw new Error(`${subject} 과목의 학생 정보가 없습니다.`);
    }

    const tasks = row.tasks.map(task => (task as string).trim());
    const students = row.students.map((rawStudent, studentIndex) => {
      const student = objectValue(rawStudent);
      const name = student && typeof student.name === 'string' ? student.name.trim() : '';
      if (!student || !name) {
        throw new Error(`${subject} 과목의 ${studentIndex + 1}번째 학생 정보가 올바르지 않습니다.`);
      }
      if (!Array.isArray(student.evaluations)) {
        throw new Error(`${subject} 과목 ${name} 학생의 평가 정보가 없습니다.`);
      }
      if (student.evaluations.length !== tasks.length) {
        throw new Error(`${subject} 과목 ${name} 학생의 평가 개수(${student.evaluations.length})가 과제 수(${tasks.length})와 다릅니다.`);
      }

      const evaluations = student.evaluations.map((grade, gradeIndex) => {
        if (typeof grade !== 'string' || !GRADES.has(grade)) {
          throw new Error(`${subject} 과목 ${name} 학생의 ${gradeIndex + 1}번째 평가(${tasks[gradeIndex]})를 확인할 수 없습니다.`);
        }
        return grade as '상' | '중' | '하';
      });
      return { name, evaluations };
    });

    return { semester, subject, tasks, students };
  });
};

export const buildStudentAssessmentTasks = (
  tasks: AssessmentTask[],
  student: StudentSubjectData,
): AssessmentTask[] => tasks.map(task => {
  const evaluation = student.evaluations?.find(item => item.id === task.id);
  if (!evaluation && task.requiresStudentEvaluation) {
    throw new Error(`${student.name || '이름 없는 학생'} 학생의 '${task.task || '이름 없는 과제'}' 평가가 누락되었습니다.`);
  }
  return { ...task, level: evaluation?.level ?? task.level };
});

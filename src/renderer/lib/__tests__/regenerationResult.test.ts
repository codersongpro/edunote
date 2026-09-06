import { describe, expect, it } from 'vitest';
import {
  applyRegenerationResult,
  applyScopedRegenerationResult,
  RegenerationRequestRegistry,
} from '../regenerationResult';

interface TestStudent {
  id: string;
  name: string;
  generatedContent?: string;
  generatedModel?: string;
  privacyApplied?: boolean;
  note: string;
}

const result = {
  generatedContent: '새 결과',
  generatedModel: 'test-model',
  privacyApplied: true,
};

describe('개별 재생성 결과 반영', () => {
  it('배열 순서가 바뀌어도 학생 ID 대상만 갱신하고 다른 학생의 최신 값을 보존한다', () => {
    const registry = new RegenerationRequestRegistry();
    const request = registry.begin({ studentId: 'a', expectedContent: 'A 이전' });
    const students: TestStudent[] = [
      { id: 'b', name: '학생 B', generatedContent: 'B 최신', note: '직접 수정' },
      { id: 'a', name: '학생 A', generatedContent: 'A 이전', note: '유지' },
    ];

    const applied = applyRegenerationResult(registry, students, request, result);

    expect(applied.applied).toBe(true);
    expect(applied.students).toEqual([
      { id: 'b', name: '학생 B', generatedContent: 'B 최신', note: '직접 수정' },
      { id: 'a', name: '학생 A', generatedContent: '새 결과', generatedModel: 'test-model', privacyApplied: true, note: '유지' },
    ]);
  });

  it('학생 A와 B 응답을 역순으로 반영해도 두 최신 결과가 모두 남는다', () => {
    const registry = new RegenerationRequestRegistry();
    const requestA = registry.begin({ studentId: 'a', expectedContent: 'A 이전' });
    const requestB = registry.begin({ studentId: 'b', expectedContent: 'B 이전' });
    const students: TestStudent[] = [
      { id: 'a', name: '학생 A', generatedContent: 'A 이전', note: '' },
      { id: 'b', name: '학생 B', generatedContent: 'B 이전', note: '' },
    ];

    const bApplied = applyRegenerationResult(registry, students, requestB, {
      ...result,
      generatedContent: 'B 새 결과',
    });
    const aApplied = applyRegenerationResult(registry, bApplied.students, requestA, {
      ...result,
      generatedContent: 'A 새 결과',
    });

    expect(aApplied.students.map(student => student.generatedContent)).toEqual(['A 새 결과', 'B 새 결과']);
  });

  it('같은 학생의 더 새 요청이 시작되면 이전 응답을 버린다', () => {
    const registry = new RegenerationRequestRegistry();
    const oldRequest = registry.begin({ studentId: 'a', expectedContent: '이전' });
    registry.begin({ studentId: 'a', expectedContent: '이전' });

    const applied = applyRegenerationResult(
      registry,
      [{ id: 'a', name: '학생 A', generatedContent: '이전', note: '' }],
      oldRequest,
      result,
    );

    expect(applied.applied).toBe(false);
    expect(applied.students[0].generatedContent).toBe('이전');
  });

  it('응답 대기 중 직접 편집으로 요청을 무효화하면 편집 내용을 보존한다', () => {
    const registry = new RegenerationRequestRegistry();
    const request = registry.begin({ studentId: 'a', expectedContent: '이전' });
    registry.invalidate({ studentId: 'a' });

    const applied = applyRegenerationResult(
      registry,
      [{ id: 'a', name: '학생 A', generatedContent: '직접 편집', note: '' }],
      request,
      result,
    );

    expect(applied.applied).toBe(false);
    expect(applied.students[0].generatedContent).toBe('직접 편집');
  });

  it('결과 내용이 요청 시작 후 달라졌다면 별도 무효화가 없어도 덮지 않는다', () => {
    const registry = new RegenerationRequestRegistry();
    const request = registry.begin({ studentId: 'a', expectedContent: '이전' });

    const applied = applyRegenerationResult(
      registry,
      [{ id: 'a', name: '학생 A', generatedContent: '직접 편집', note: '' }],
      request,
      result,
    );

    expect(applied.applied).toBe(false);
    expect(applied.students[0].generatedContent).toBe('직접 편집');
  });

  it('대상 학생이 삭제됐으면 결과를 적용하지 않는다', () => {
    const registry = new RegenerationRequestRegistry();
    const request = registry.begin({ studentId: 'a', expectedContent: '이전' });

    const applied = applyRegenerationResult(
      registry,
      [{ id: 'b', name: '학생 B', generatedContent: 'B 결과', note: '' }],
      request,
      result,
    );

    expect(applied.applied).toBe(false);
    expect(applied.students).toEqual([{ id: 'b', name: '학생 B', generatedContent: 'B 결과', note: '' }]);
  });

  it('과목 삭제는 해당 과목 요청만, 명단 재구성은 모든 요청을 무효화한다', () => {
    const registry = new RegenerationRequestRegistry();
    const korean = registry.begin({ scope: '국어', studentId: 'a', expectedContent: '이전' });
    const math = registry.begin({ scope: '수학', studentId: 'a', expectedContent: '이전' });

    registry.invalidateScope('국어');
    expect(registry.isCurrent(korean)).toBe(false);
    expect(registry.isCurrent(math)).toBe(true);

    registry.invalidateAll();
    expect(registry.isCurrent(math)).toBe(false);
  });

  it('다른 과목으로 전환된 뒤에는 요청 과목 저장소만 갱신한다', () => {
    const registry = new RegenerationRequestRegistry();
    const request = registry.begin({ scope: '국어', studentId: 'a', expectedContent: '국어 이전' });
    const activeStudents: TestStudent[] = [
      { id: 'a', name: '학생 A', generatedContent: '수학 결과', note: '수학' },
    ];
    const dataStore = {
      국어: {
        tasks: ['말하기'],
        students: [{ id: 'a', name: '학생 A', generatedContent: '국어 이전', note: '국어' }],
      },
      수학: {
        tasks: ['계산'],
        students: activeStudents,
      },
    };

    const applied = applyScopedRegenerationResult(
      registry,
      { currentScope: '수학', activeStudents, dataStore },
      request,
      result,
    );

    expect(applied.applied).toBe(true);
    expect(applied.activeStudents[0].generatedContent).toBe('수학 결과');
    expect(applied.dataStore.국어.students[0].generatedContent).toBe('새 결과');
    expect(applied.dataStore.국어.tasks).toEqual(['말하기']);
  });
});

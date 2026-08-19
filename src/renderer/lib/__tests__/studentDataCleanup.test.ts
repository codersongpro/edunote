import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearAllStudentData, STUDENT_DATA_TARGET_LABELS } from '../studentDataCleanup';
import { WORK_DRAFT_NAME } from '../workDraft';
import { DOCUMENT_HISTORY_KEY_PREFIX } from '../generationHistory';

const writeJsonData = vi.fn();
const setConfig = vi.fn();

beforeEach(() => {
  localStorage.clear();
  writeJsonData.mockReset().mockResolvedValue('');
  setConfig.mockReset().mockResolvedValue(undefined);
  (window as unknown as { electronAPI: unknown }).electronAPI = { writeJsonData, setConfig };
});

describe('clearAllStudentData', () => {
  it('학생 관련 localStorage 키를 모두 지운다', async () => {
    localStorage.setItem('eduHist_opinion_홍길동', '[]');
    localStorage.setItem(`${DOCUMENT_HISTORY_KEY_PREFIX}가정통신문`, '[]');
    localStorage.setItem('eduNote_studentMemos_v1', '[]');

    await clearAllStudentData();

    expect(localStorage.getItem('eduHist_opinion_홍길동')).toBeNull();
    expect(localStorage.getItem(`${DOCUMENT_HISTORY_KEY_PREFIX}가정통신문`)).toBeNull();
    expect(localStorage.getItem('eduNote_studentMemos_v1')).toBeNull();
  });

  it('학생 개인정보가 아닌 키는 건드리지 않는다', async () => {
    localStorage.setItem('eduNote_resources_v2', '[]');
    localStorage.setItem('edunote_menu_favorites_v1', '[]');

    await clearAllStudentData();

    expect(localStorage.getItem('eduNote_resources_v2')).toBe('[]');
    expect(localStorage.getItem('edunote_menu_favorites_v1')).toBe('[]');
  });

  it('학생 메모 파일과 자동 저장된 작업 초안을 비운다', async () => {
    await clearAllStudentData();

    const cleared = writeJsonData.mock.calls.map(call => call[0]);
    expect(cleared).toContain('student-memos');
    // 자동 저장(이어서 하기) 초안이 빠지면 삭제에 구멍이 생긴다 — 반드시 포함되어야 한다.
    expect(cleared).toContain(WORK_DRAFT_NAME);
  });

  it('설정에 저장된 학생 명단 3종을 비운다', async () => {
    await clearAllStudentData();

    expect(setConfig).toHaveBeenCalledWith({
      studentNames: '',
      studentMaleNames: '',
      studentFemaleNames: '',
    });
  });

  it('사용자에게 보여줄 삭제 대상 목록을 제공한다', () => {
    expect(STUDENT_DATA_TARGET_LABELS.length).toBeGreaterThan(0);
    expect(STUDENT_DATA_TARGET_LABELS.join(' ')).toContain('작업 내용');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadStudentCard, RECORD_MODE_LABELS } from '../studentCard';
import { saveHistory } from '../generationHistory';

describe('loadStudentCard', () => {
  beforeEach(() => {
    localStorage.clear();
    (globalThis as any).window = {
      ...(globalThis as any).window,
      electronAPI: { readJsonData: vi.fn().mockResolvedValue(null) },
    };
  });

  it('4개 생기부 생성기 이력을 모두 모아 최신순으로 정렬한다', async () => {
    saveHistory('opinion', '1', '행발 내용');
    saveHistory('subject', '1', '세특 내용');
    const entries = await loadStudentCard('1');
    expect(entries.map(e => e.kind).sort()).toEqual(['opinion', 'subject']);
    expect(entries.every(e => typeof e.date === 'string')).toBe(true);
  });

  it('다른 학생의 이력은 섞이지 않는다', async () => {
    saveHistory('opinion', '1', '1번 학생 행발');
    saveHistory('opinion', '2', '2번 학생 행발');
    const entries = await loadStudentCard('1');
    expect(entries).toHaveLength(1);
    expect(entries[0].content).toBe('1번 학생 행발');
  });

  it('학생 메모도 함께 모은다', async () => {
    (window as any).electronAPI.readJsonData.mockResolvedValue([
      { studentName: '1', title: '관찰', content: '메모 내용', createdAt: 1000 },
      { studentName: '2', title: '무관', content: '다른 학생 메모', createdAt: 2000 },
    ]);
    const entries = await loadStudentCard('1');
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe('memo');
    expect(entries[0].content).toContain('메모 내용');
  });

  it('이력이 없으면 빈 배열을 반환한다', async () => {
    expect(await loadStudentCard('없는학생')).toEqual([]);
  });

  it('각 항목에 한글 라벨이 붙는다', async () => {
    saveHistory('sports', '1', '스포츠클럽 내용');
    const entries = await loadStudentCard('1');
    expect(entries[0].label).toBe(RECORD_MODE_LABELS.sports);
  });
});

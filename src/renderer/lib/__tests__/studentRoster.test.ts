import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseRosterInput,
  formatRosterForEdit,
  findRosterMatch,
  loadStudentRoster,
  saveStudentRoster,
  clearStudentRoster,
  STUDENT_ROSTER_DATA_KEY,
} from '../studentRoster';

describe('parseRosterInput', () => {
  it('"번호,이름" 형식의 줄을 파싱한다', () => {
    expect(parseRosterInput('1,김서윤\n2,이도현')).toEqual([
      { number: '1', name: '김서윤' },
      { number: '2', name: '이도현' },
    ]);
  });

  it('빈 줄과 공백은 건너뛴다', () => {
    expect(parseRosterInput('1,김서윤\n\n   \n2,이도현')).toEqual([
      { number: '1', name: '김서윤' },
      { number: '2', name: '이도현' },
    ]);
  });

  it('번호나 이름이 없는 줄은 무시한다', () => {
    expect(parseRosterInput('1,김서윤\n그냥텍스트\n,\n2')).toEqual([
      { number: '1', name: '김서윤' },
    ]);
  });

  it('앞뒤 공백은 정리한다', () => {
    expect(parseRosterInput(' 1 , 김서윤 ')).toEqual([{ number: '1', name: '김서윤' }]);
  });

  it('빈 입력은 빈 배열을 반환한다', () => {
    expect(parseRosterInput('')).toEqual([]);
    expect(parseRosterInput('   ')).toEqual([]);
  });
});

describe('formatRosterForEdit', () => {
  it('명단을 "번호,이름" 줄 목록으로 되돌린다', () => {
    expect(formatRosterForEdit([{ number: '1', name: '김서윤' }, { number: '2', name: '이도현' }]))
      .toBe('1,김서윤\n2,이도현');
  });

  it('빈 배열은 빈 문자열을 반환한다', () => {
    expect(formatRosterForEdit([])).toBe('');
  });
});

describe('findRosterMatch', () => {
  const roster = [{ number: '1', name: '김서윤' }, { number: '12', name: '이도현' }];

  it('정확히 일치하는 번호를 찾는다', () => {
    expect(findRosterMatch(roster, '1')).toEqual({ number: '1', name: '김서윤' });
  });

  it('"번" 접미사가 붙어도 찾는다', () => {
    expect(findRosterMatch(roster, '12번')).toEqual({ number: '12', name: '이도현' });
  });

  it('일치하지 않으면 null을 반환한다', () => {
    expect(findRosterMatch(roster, '3')).toBeNull();
    expect(findRosterMatch(roster, '김서윤')).toBeNull();
  });

  it('빈 식별자는 null을 반환한다', () => {
    expect(findRosterMatch(roster, '')).toBeNull();
  });
});

describe('loadStudentRoster / saveStudentRoster / clearStudentRoster', () => {
  beforeEach(() => {
    (globalThis as any).window = { electronAPI: { readJsonData: vi.fn(), writeJsonData: vi.fn() } };
  });

  it('저장된 배열을 그대로 불러온다', async () => {
    (window as any).electronAPI.readJsonData.mockResolvedValue([{ number: '1', name: '김서윤' }]);
    const result = await loadStudentRoster();
    expect(result).toEqual([{ number: '1', name: '김서윤' }]);
    expect((window as any).electronAPI.readJsonData).toHaveBeenCalledWith(STUDENT_ROSTER_DATA_KEY);
  });

  it('저장된 값이 배열이 아니거나 형식이 잘못되면 빈 배열을 반환한다', async () => {
    (window as any).electronAPI.readJsonData.mockResolvedValue({ not: 'array' });
    expect(await loadStudentRoster()).toEqual([]);
  });

  it('형식이 잘못된 항목은 걸러낸다', async () => {
    (window as any).electronAPI.readJsonData.mockResolvedValue([
      { number: '1', name: '김서윤' },
      { number: 1, name: '이상함' },
      { name: '번호없음' },
      null,
    ]);
    expect(await loadStudentRoster()).toEqual([{ number: '1', name: '김서윤' }]);
  });

  it('조회 실패 시 빈 배열을 반환한다', async () => {
    (window as any).electronAPI.readJsonData.mockRejectedValue(new Error('fail'));
    expect(await loadStudentRoster()).toEqual([]);
  });

  it('saveStudentRoster는 writeJsonData를 호출한다', async () => {
    const entries = [{ number: '1', name: '김서윤' }];
    await saveStudentRoster(entries);
    expect((window as any).electronAPI.writeJsonData).toHaveBeenCalledWith(STUDENT_ROSTER_DATA_KEY, entries);
  });

  it('clearStudentRoster는 빈 배열로 덮어쓴다', async () => {
    await clearStudentRoster();
    expect((window as any).electronAPI.writeJsonData).toHaveBeenCalledWith(STUDENT_ROSTER_DATA_KEY, []);
  });
});

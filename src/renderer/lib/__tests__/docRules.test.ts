import { describe, expect, it } from 'vitest';
import {
  checkAmounts,
  checkDateNotation,
  checkDateWeekdays,
  checkEndMark,
  checkOutlineNumbering,
  checkPersonalInfo,
  detectDocumentYear,
  maskPersonalInfo,
  shiftDatesForSchoolYear,
  weekdayOf,
  shiftDate,
} from '../docRules';
import { applySuggestions } from '../aiReview';

describe('checkDateWeekdays', () => {
  it('날짜와 요일이 맞지 않으면 맞는 요일로 고치는 제안을 만든다', () => {
    const [s] = checkDateWeekdays(['일시: 2026. 3. 4.(화) 14:00'], null);
    expect(s.before).toBe('2026. 3. 4.(화)');
    expect(s.after).toBe('2026. 3. 4.(수)');
    expect(s.severity).toBe('error');
  });

  it('맞는 요일과 "요일"까지 쓴 표기는 그대로 둔다', () => {
    expect(checkDateWeekdays(['2026년 3월 4일(수요일)'], 2026)).toEqual([]);
  });

  it('없는 날짜를 오류로 알린다', () => {
    const [s] = checkDateWeekdays(['2026. 2. 30.(월)'], null);
    expect(s.reason).toContain('없는 날짜');
    expect(s.after).toBeUndefined();
  });

  it('연도 없는 날짜는 학년도 기준으로 계산하고, 전체 날짜를 두 번 검사하지 않는다', () => {
    const result = checkDateWeekdays(['2026년 3월 4일(수) ~ 3월 6일(목)'], 2026);
    expect(result).toHaveLength(1);
    expect(result[0].before).toBe('3월 6일(목)');
    expect(result[0].after).toBe('3월 6일(금)');
  });
});

describe('detectDocumentYear', () => {
  it('문서에서 가장 많이 쓰인 연도를 찾는다', () => {
    expect(detectDocumentYear(['2025학년도 계획', '2025. 3. 4.', '2024. 12. 1.'])).toBe(2025);
    expect(detectDocumentYear(['날짜 없음'])).toBeNull();
  });
});

describe('checkDateNotation', () => {
  it('공문서 날짜 표기로 바꾸는 제안을 만든다', () => {
    const result = checkDateNotation(['2026.3.4 회의', '2026. 03. 04. 협의', '2026. 3. 4. 정상']);
    expect(result.map(r => [r.before, r.after])).toEqual([
      ['2026.3.4', '2026. 3. 4.'],
      ['2026. 03. 04.', '2026. 3. 4.'],
    ]);
  });
});

describe('checkAmounts', () => {
  it('단가×수량과 금액이 다르면 계산한 값으로 고친다', () => {
    const [s] = checkAmounts(['간식비 5,000원 × 25명 = 120,000원']);
    expect(s.before).toBe('5,000원 × 25명 = 120,000');
    expect(s.after).toBe('5,000원 × 25명 = 125,000');
    expect(checkAmounts(['5,000원 × 20명 = 100,000원'])).toEqual([]);
  });
});

describe('checkOutlineNumbering', () => {
  it('건너뛴 번호를 찾고 새 단락의 1번 시작은 허용한다', () => {
    const nodes = ['1. 목적', '가. 개요', '다. 세부', '2. 방침', '4. 예산', '1. 붙임 목록'];
    const result = checkOutlineNumbering(nodes);
    expect(result.map(r => [r.idx, r.before, r.after])).toEqual([
      [2, '다.', '나.'],
      [4, '4.', '3.'],
    ]);
  });

  it('날짜로 시작하는 줄은 항목 기호로 보지 않는다', () => {
    expect(checkOutlineNumbering(['1. 일정', '3. 4.(수) 협의회'])).toEqual([]);
  });
});

describe('checkEndMark', () => {
  it('공문에 끝 표시가 없으면 알리고, 한 칸 띄운 끝 표시는 두 칸으로 고친다', () => {
    expect(checkEndMark(['본문입니다.'], '공문')[0].idx).toBe(-1);
    const [s] = checkEndMark(['붙임 1부. 끝.'], '공문');
    expect([s.before, s.after]).toEqual(['1부. 끝.', '1부.  끝.']);
    expect(checkEndMark(['붙임 1부.끝.'], '공문')[0].after).toBe('1부.  끝.');
    expect(checkEndMark(['붙임 1부.  끝.'], '공문')).toEqual([]);
    expect(checkEndMark(['계획서 본문'], '계획서')).toEqual([]);
  });
});

describe('checkPersonalInfo', () => {
  it('주민등록번호와 휴대전화 번호를 찾아 가린다', () => {
    const result = checkPersonalInfo(['보호자 010-1234-5678, 학생 090101-3123456']);
    expect(result.map(r => r.after)).toEqual(['090101-3******', '010-****-5678']);
    expect(maskPersonalInfo('010 1234 5678')).toBe('010-****-5678');
    expect(checkPersonalInfo(['교무실 031-123-4567'])).toEqual([]);
  });
});

describe('shiftDatesForSchoolYear', () => {
  it('학년도·날짜를 옮기고 요일을 다시 계산한다', () => {
    const nodes = ['2025학년도 독서교육 운영 계획', '기간: 2025. 3. 4.(화) ~ 2026. 2. 27.(금)', '매주 3. 11.(화) 운영'];
    const suggestions = shiftDatesForSchoolYear(nodes, 2025, 2026);
    const { nodes: updated } = applySuggestions(nodes, suggestions);
    expect(updated).toEqual([
      '2026학년도 독서교육 운영 계획',
      // 2027. 2. 27.은 토요일이라 작년(2026. 2. 27. 금)과 같은 금요일 2. 26.로 옮긴다
      `기간: 2026. 3. 4.(${weekdayOf(2026, 3, 4)}) ~ 2027. 2. 26.(금)`,
      `매주 3. 11.(${weekdayOf(2026, 3, 11)}) 운영`,
    ]);
  });

  it('요일 없는 기간의 두 연도를 섞이지 않게 함께 옮긴다', () => {
    const nodes = ['2025. 3. 1. ~ 2026. 2. 28.'];
    const { nodes: updated } = applySuggestions(nodes, shiftDatesForSchoolYear(nodes, 2025, 2026));
    expect(updated[0]).toBe('2026. 3. 1. ~ 2027. 2. 28.');
  });

  it('관련 근거 줄과 범위 밖 연도는 옮기지 않고 확인 안내를 남긴다', () => {
    const nodes = ['1. 관련: 교육부-1234(2025. 2. 10.)', '2019년 개교'];
    const suggestions = shiftDatesForSchoolYear(nodes, 2025, 2026);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].idx).toBe(-1);
    expect(suggestions[0].needsCheck).toBe(true);
  });

  it('평일 행사가 주말로 옮겨지면 작년과 같은 요일의 가장 가까운 날로 바꾼다', () => {
    const nodes = ['2025년 4월 2일(수) ~ 2025년 4월 4일(금)', '마감 2025. 4. 4.', '협의 4. 4.(금)'];
    const suggestions = shiftDatesForSchoolYear(nodes, 2025, 2026);
    const { nodes: updated } = applySuggestions(nodes, suggestions);
    // 4. 2.는 목요일(평일)이라 그대로, 4. 4.는 토요일이라 금요일 4. 3.으로
    expect(updated).toEqual(['2026년 4월 2일(목) ~ 2026년 4월 3일(금)', '마감 2026. 4. 3.', '협의 4. 3.(금)']);
    const adjusted = suggestions.filter(x => x.category === '주말 조정');
    expect(adjusted).toHaveLength(3);
    expect(adjusted.every(x => !x.needsCheck)).toBe(true);
    expect(adjusted[0].reason).toContain('토요일이라 작년과 같은 금요일');
  });

  it('작년에도 주말에 열린 행사는 주말이어도 그대로 옮긴다', () => {
    // 2025. 5. 10.은 토요일, 2026. 5. 10.은 일요일
    expect(shiftDate(2025, 5, 10, 2026)).toMatchObject({ year: 2026, month: 5, day: 10, weekday: '일' });
    const [s1] = shiftDatesForSchoolYear(['독서 캠프 2025. 5. 10.(토)'], 2025, 2026);
    expect([s1.after, s1.category]).toEqual(['2026. 5. 10.(일)', '날짜']);
    expect(s1.reason).toContain('주말 그대로');
  });

  it('달이 바뀌는 조정과 두 자리 표기를 지킨다', () => {
    // 2026-02-01은 일요일, 작년 2025-02-01은 토요일 → 주말 행사라 그대로
    expect(shiftDate(2025, 2, 1, 2026)).toMatchObject({ month: 2, day: 1 });
    // 평일 예: 2025-08-01(금) → 2026-08-01(토) → 달을 넘겨 7. 31.(금)
    expect(shiftDate(2025, 8, 1, 2026)).toMatchObject({ year: 2026, month: 7, day: 31, weekday: '금' });
    const [s2] = shiftDatesForSchoolYear(['2025-08-01'], 2025, 2026);
    expect(s2.after).toBe('2026-07-31');
  });

  it('다음 해에 없는 날짜(2월 29일)는 확인 필요로 남긴다', () => {
    const [s] = shiftDatesForSchoolYear(['2028. 2. 29.(화)'], 2027, 2028 + 1);
    expect(s.needsCheck).toBe(true);
    expect(s.after).toBeUndefined();
  });
});

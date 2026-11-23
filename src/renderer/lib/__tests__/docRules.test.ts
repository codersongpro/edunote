import { describe, expect, it } from 'vitest';
import {
  checkAmounts,
  checkDateNotation,
  checkDateWeekdays,
  checkEndMark,
  checkOutlineNumbering,
  checkPersonalInfo,
  checkTimeNotation,
  checkRangeNotation,
  checkAttachmentNotation,
  checkAmountNotation,
  checkPlainWords,
  checkPlaceholders,
  toKoreanAmount,
  parseKoreanAmount,
  runDocRules,
  detectDocumentYear,
  maskPersonalInfo,
  createPersonalInfoGuard,
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

describe('공문서 표기 규칙 검사', () => {
  it('오전·오후 시각을 24시각제로 고친다', () => {
    const result = checkTimeNotation(['일시: 2026. 3. 4.(수) 오후 3시 30분부터', '오전 9시 집합']);
    expect(result.map(s => [s.before, s.after])).toEqual([['오후 3시 30분', '15:30'], ['오전 9시', '09:00']]);
  });

  it('쌍점을 띄운 시각과 한 자리 시각을 바로잡고, 24시 마감은 확인을 권한다', () => {
    expect(checkTimeNotation(['13 : 20'])[0].after).toBe('13:20');
    expect(checkTimeNotation(['9:00 시작'])[0].after).toBe('09:00');
    const [late] = checkTimeNotation(['제출 마감: 2026. 2. 21. 24시까지']);
    expect(late.needsCheck).toBe(true);
    expect(checkTimeNotation(['09:00∼12:00'])).toEqual([]);
  });

  it('물결표 앞뒤 띄어쓰기와 "∼…까지" 겹침을 찾는다', () => {
    const [spaced] = checkRangeNotation(['2026. 3. 4.(수) ~ 3. 6.(금)']);
    expect(spaced.before).toBe(') ~ ');
    expect(spaced.after).toBe(')∼');
    const [kkaji] = checkRangeNotation(['2026. 2. 20.∼2. 24.까지']);
    expect(kkaji.after).toBe('∼2. 24.');
    expect(checkRangeNotation(['15:30∼16:30', 'p.1 ~ p.50'])).toEqual([]);
  });

  it('"붙임:"의 쌍점을 두 칸 띄우기로 고친다', () => {
    const [s] = checkAttachmentNotation(['붙임: 운영 계획 1부.  끝.']);
    expect(s.before).toBe('붙임: ');
    expect(s.after).toBe('붙임  ');
    expect(checkAttachmentNotation(['붙임  운영 계획 1부.  끝.'])).toEqual([]);
  });
});

describe('금액 한글 병기', () => {
  it('숫자를 공문서 관례의 한글 금액으로 바꾸고 다시 읽는다', () => {
    expect(toKoreanAmount(113560)).toBe('일십일만삼천오백육십');
    expect(toKoreanAmount(500000)).toBe('오십만');
    expect(toKoreanAmount(1200000000)).toBe('일십이억');
    expect(parseKoreanAmount('일십일만삼천오백육십')).toBe(113560);
    expect(parseKoreanAmount('십일만삼천오백육십')).toBe(113560);
    expect(parseKoreanAmount('오십만')).toBe(500000);
    expect(parseKoreanAmount('만오천')).toBe(15000);
    expect(parseKoreanAmount('오십만 원 이상')).toBeNull();
  });

  it('한글 병기가 없으면 덧붙이고, 띄어 쓴 표기는 붙인다', () => {
    expect(checkAmountNotation(['다. 소요예산: 금500,000원'])[0].after).toBe('금500,000원(금오십만원)');
    expect(checkAmountNotation(['금500,000원 (금오십만원)'])[0].after).toBe('금500,000원(금오십만원)');
    expect(checkAmountNotation(['금113,560원(금일십일만삼천오백육십원)'])).toEqual([]);
  });

  it('한글 금액이 숫자와 다르면 자동 반영하지 않고 확인을 권한다', () => {
    const [s] = checkAmountNotation(['금500,000원(금오십오만원)']);
    expect(s.severity).toBe('warning');
    expect(s.needsCheck).toBe(true);
  });

  it('"천 원" 단위 표기를 원 단위로 고친다', () => {
    expect(checkAmountNotation(['예산 345천원'])[0].after).toBe('345,000원');
  });
});

describe('쉬운 표현과 남은 자리표시', () => {
  it('순화어와 중복 표현을 찾되 금액의 "금일십"은 건드리지 않는다', () => {
    const result = checkPlainWords(['금일 협의회는 향후 계획을 하기와 같이 정하고 만전을 기해 반드시 필요한 3월달 일정을 정함', '금113,560원(금일십일만삼천오백육십원)']);
    expect(result.map(s => s.after)).toEqual(expect.arrayContaining(['오늘', '앞으로', '아래와 같이', '최선을 다해', '필요', '3월']));
    expect(result.every(s => s.idx === 0)).toBe(true);
  });

  it('[담당자]·[제출 마감 일시]와 ○○ 자리를 찾고, 제목 말머리는 건드리지 않는다', () => {
    const result = checkPlaceholders([
      '제목  [안내] 독서교실 운영',
      '1. 관련: ○○과-○○○(○○○○. ○. ○.)「○○○」',
      '- 제출: [제출 마감 일시]까지 [담당자]에게',
    ]);
    expect(result.map(s => s.before)).toEqual(['○○과-○○○(○○○○. ○. ○.)', '○○○', '[제출 마감 일시]', '[담당자]']);
    expect(result.every(s => s.severity === 'warning')).toBe(true);
  });

  it('전체 검사에 새 규칙이 함께 돈다', () => {
    const categories = runDocRules(['붙임: 계획 1부.  끝.', '오후 2시 금일 시작'], { docKind: '공문' }).map(s => s.category);
    expect(categories).toEqual(expect.arrayContaining(['붙임 표시', '시간 표기', '쉬운 표현']));
  });
});

describe('createPersonalInfoGuard', () => {
  it('여러 글에 걸쳐 같은 번호는 같은 대체어로, 다른 번호는 다른 대체어로 바꾼다', () => {
    const guard = createPersonalInfoGuard();
    const a = guard.protect('연락처 010-1111-2222');
    const b = guard.protect('양식 010-3333-4444 / 010-1111-2222');
    expect(a).toBe('연락처 ⟦연락처1⟧');
    expect(b).toBe('양식 ⟦연락처2⟧ / ⟦연락처1⟧');
    expect(guard.restore('⟦연락처2⟧, ⟦연락처1⟧, ⟦연락처9⟧')).toBe('010-3333-4444, 010-1111-2222, ⟦연락처9⟧');
    expect(guard.maskedCount()).toBe(3);
  });
});

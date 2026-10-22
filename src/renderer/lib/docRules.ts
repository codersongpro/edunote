// 공문·계획서를 AI 없이 코드로 검사하는 규칙 모음.
// 날짜와 요일, 금액 계산처럼 정답이 정해진 부분은 AI보다 계산이 정확하므로 여기서 먼저 확인하고,
// 결과를 AI 검토 프롬프트에 함께 보내 같은 지적이 반복되지 않게 한다.

import { detectOutlineMarker } from './outlineFormat';
import { DocSuggestion, nextSuggestionId } from './aiReview';

const WEEKDAYS = '일월화수목금토';
const HANGUL_ORDER = '가나다라마바사아자차카타파하';

export type DocKind = '공문' | '계획서' | '기타';

function ruleSuggestion(partial: Omit<DocSuggestion, 'id' | 'source' | 'needsCheck'> & { needsCheck?: boolean }): DocSuggestion {
  return { needsCheck: false, ...partial, id: nextSuggestionId('rule'), source: 'rule' };
}

export function isValidDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function weekdayOf(year: number, month: number, day: number): string {
  return WEEKDAYS[new Date(year, month - 1, day).getDay()];
}

// 한국 학년도는 3월에 시작한다. 연도 없이 "3. 4.(화)"처럼 쓴 날짜는
// 3~12월이면 학년도와 같은 해, 1~2월이면 다음 해로 본다.
export function calendarYearForSchoolYear(schoolYear: number, month: number): number {
  return month <= 2 ? schoolYear + 1 : schoolYear;
}

// "2026. 3. 4.(수)", "2026년 3월 4일(수)", "2026-03-04(수)" 형식
const FULL_DATE = /(20\d{2})(\s*(?:\.|년|-)\s*)(\d{1,2})(\s*(?:\.|월|-)\s*)(\d{1,2})(\s*(?:\.|일)?\s*)\(([일월화수목금토])(?:요일)?\)/g;
// 연도 없이 쓴 날짜: "3. 4.(화)", "3월 4일(화)". 앞에 숫자·마침표가 붙으면 FULL_DATE의 일부이므로 제외
const SHORT_DATE = /(?<![\d.]\s?)(\d{1,2})(\s*(?:\.|월)\s*)(\d{1,2})(\s*(?:\.|일)?\s*)\(([일월화수목금토])(?:요일)?\)/g;

// 문서에서 가장 많이 쓰인 연도. 연도 없는 날짜의 요일을 맞출 때 기준으로 쓴다.
export function detectDocumentYear(nodes: string[]): number | null {
  const counts = new Map<number, number>();
  for (const node of nodes) {
    for (const m of node.matchAll(/(20\d{2})\s*(?:학년도|\.|년)/g)) {
      const y = Number(m[1]);
      counts.set(y, (counts.get(y) ?? 0) + 1);
    }
  }
  let best: number | null = null;
  let bestCount = 0;
  for (const [year, count] of counts) {
    if (count > bestCount) { best = year; bestCount = count; }
  }
  return best;
}

// "2026년 3월 4일(수)"의 "3월 4일(수)"가 연도 없는 날짜로 한 번 더 잡히지 않도록
// 전체 날짜 자리를 같은 길이의 공백으로 가린다(위치는 그대로 유지).
function blankFullDates(node: string): string {
  return node.replace(FULL_DATE, m => ' '.repeat(m.length));
}

// 날짜와 요일이 맞는지, 있을 수 없는 날짜(2월 30일)가 없는지 확인한다.
export function checkDateWeekdays(nodes: string[], schoolYear: number | null): DocSuggestion[] {
  const result: DocSuggestion[] = [];
  nodes.forEach((node, idx) => {
    for (const m of node.matchAll(FULL_DATE)) {
      const [whole, y, , mo, , d, , wd] = m;
      const year = Number(y); const month = Number(mo); const day = Number(d);
      if (!isValidDate(year, month, day)) {
        result.push(ruleSuggestion({ idx, start: m.index, before: whole, category: '날짜', severity: 'error', reason: `${year}년 ${month}월 ${day}일은 없는 날짜입니다.` }));
        continue;
      }
      const actual = weekdayOf(year, month, day);
      if (actual !== wd) {
        result.push(ruleSuggestion({
          idx, start: m.index, before: whole, after: whole.replace(/\(([일월화수목금토])(요일)?\)$/, `(${actual}$2)`),
          category: '요일', severity: 'error', reason: `${year}. ${month}. ${day}.은 ${actual}요일입니다.`,
        }));
      }
    }
    if (schoolYear === null) return;
    for (const m of blankFullDates(node).matchAll(SHORT_DATE)) {
      const [whole, mo, , d, , wd] = m;
      const month = Number(mo); const day = Number(d);
      const year = calendarYearForSchoolYear(schoolYear, month);
      if (!isValidDate(year, month, day)) continue;
      const actual = weekdayOf(year, month, day);
      if (actual !== wd) {
        result.push(ruleSuggestion({
          idx, start: m.index, before: whole, after: whole.replace(/\(([일월화수목금토])(요일)?\)$/, `(${actual}$2)`),
          category: '요일', severity: 'warning', needsCheck: month <= 2,
          reason: `${year}년 기준으로 ${month}월 ${day}일은 ${actual}요일입니다.${month <= 2 ? ' (1~2월은 다음 해로 계산했습니다.)' : ''}`,
        }));
      }
    }
  });
  return result;
}

// 공문서 날짜 표기: 숫자로 쓰고 연·월·일 대신 온점을 찍는다 (예: 2026. 3. 4.)
const DOT_DATE = /(?<![\d.])(20\d{2})\.\s*(\d{1,2})\.\s*(\d{1,2})(\.?)(?![\d.])/g;
export function checkDateNotation(nodes: string[]): DocSuggestion[] {
  const result: DocSuggestion[] = [];
  nodes.forEach((node, idx) => {
    for (const m of node.matchAll(DOT_DATE)) {
      const [whole, y, mo, d] = m;
      const canonical = `${y}. ${Number(mo)}. ${Number(d)}.`;
      if (whole === canonical) continue;
      result.push(ruleSuggestion({
        idx, start: m.index, before: whole, after: canonical, category: '날짜 표기', severity: 'info',
        reason: '공문서는 "2026. 3. 4."처럼 연·월·일 뒤에 온점을 찍고 한 칸씩 띄어 씁니다.',
      }));
    }
  });
  return result;
}

function toNumber(value: string): number {
  return Number(value.replace(/,/g, ''));
}

function formatWon(value: number): string {
  return value.toLocaleString('ko-KR');
}

// "5,000원 × 20명 = 100,000원" 같은 곱셈이 맞는지 확인한다.
const MULTIPLY = /([\d,]+)\s*원?\s*[×xX*]\s*([\d,]+)\s*[가-힣]{0,2}\s*(?:[×xX*]\s*([\d,]+)\s*[가-힣]{0,2}\s*)?=\s*([\d,]+)/g;
export function checkAmounts(nodes: string[]): DocSuggestion[] {
  const result: DocSuggestion[] = [];
  nodes.forEach((node, idx) => {
    for (const m of node.matchAll(MULTIPLY)) {
      const [whole, a, b, c, total] = m;
      const expected = toNumber(a) * toNumber(b) * (c ? toNumber(c) : 1);
      if (!Number.isFinite(expected) || expected === toNumber(total)) continue;
      const at = whole.lastIndexOf(total);
      result.push(ruleSuggestion({
        idx, start: m.index, before: whole, after: whole.slice(0, at) + formatWon(expected) + whole.slice(at + total.length),
        category: '금액 계산', severity: 'error',
        reason: `계산하면 ${formatWon(expected)}입니다. (적힌 값: ${total})`,
      }));
    }
  });
  return result;
}

function markerOrder(marker: string): number {
  const core = marker.replace(/[.)]/g, '');
  if (/^\d+$/.test(core)) return Number(core);
  const at = HANGUL_ORDER.indexOf(core);
  return at === -1 ? 0 : at + 1;
}

function markerFor(level: number, order: number): string {
  const numeric = level === 1 || level === 3;
  const body = numeric ? String(order) : HANGUL_ORDER[order - 1] ?? '';
  return level <= 2 ? `${body}.` : `${body})`;
}

// 항목 기호(1. → 가. → 1) → 가))의 번호가 건너뛰거나 거꾸로 가지 않는지 확인한다.
// 표 안의 번호나 날짜("3. 4.")는 항목 기호가 아니므로 건너뛴다.
export function checkOutlineNumbering(nodes: string[]): DocSuggestion[] {
  const result: DocSuggestion[] = [];
  const last: Record<number, number> = {};
  nodes.forEach((node, idx) => {
    const text = node.trimStart();
    if (/^\d{1,2}\.\s*\d{1,2}\./.test(text)) return;
    const found = detectOutlineMarker(text);
    if (!found) return;
    const order = markerOrder(found.marker);
    if (order === 0) return;
    // 상위 단계가 나오면 하위 단계 번호는 새로 시작한다
    for (const level of [1, 2, 3, 4]) if (level > found.level) delete last[level];
    const prev = last[found.level];
    const expected = prev === undefined ? 1 : prev + 1;
    // 1번으로 다시 시작하는 것은 새 단락(붙임 등)으로 본다
    if (order !== expected && order !== 1 && prev !== undefined) {
      const correct = markerFor(found.level, expected);
      result.push(ruleSuggestion({
        idx, start: node.length - text.length, before: found.marker, after: correct, category: '항목 번호', severity: 'warning',
        reason: `앞 항목 다음 번호는 "${correct}"입니다.`,
      }));
    }
    last[found.level] = order;
  });
  return result;
}

// 공문 본문은 "끝." 표시로 마친다. 붙임이 있으면 붙임 표시 끝에 쓴다.
export function checkEndMark(nodes: string[], docKind: DocKind): DocSuggestion[] {
  if (docKind !== '공문') return [];
  const result: DocSuggestion[] = [];
  let found = false;
  nodes.forEach((node, idx) => {
    // 바로 앞 단어까지 함께 보여 줘야 비교표에서 어디인지 알아볼 수 있다
    const m = node.match(/(\S+)(\s?)끝\.\s*$/);
    if (/끝\.\s*$/.test(node)) found = true;
    if (m && m.index !== undefined) {
      const before = `${m[1]}${m[2]}끝.`;
      result.push(ruleSuggestion({
        idx, start: m.index, before, after: `${m[1]}  끝.`, category: '끝 표시', severity: 'info',
        reason: '본문이 끝나면 두 칸 띄우고 "끝."을 씁니다.',
      }));
    }
  });
  if (!found) {
    result.push(ruleSuggestion({
      idx: -1, before: '', category: '끝 표시', severity: 'warning',
      reason: '공문 본문(또는 붙임) 끝에 "끝." 표시가 없습니다.',
    }));
  }
  return result;
}

// AI로 보내기 전에 경고할 개인정보. 주민등록번호는 바로 가리고, 휴대전화 번호는 확인을 권한다.
const RRN = /(?<!\d)(\d{6})\s*-\s*([1-8])\d{6}(?!\d)/g;
const MOBILE = /(?<!\d)(01[016789])[-.\s]?(\d{3,4})[-.\s]?(\d{4})(?!\d)/g;

export function checkPersonalInfo(nodes: string[]): DocSuggestion[] {
  const result: DocSuggestion[] = [];
  nodes.forEach((node, idx) => {
    for (const m of node.matchAll(RRN)) {
      result.push(ruleSuggestion({
        idx, start: m.index, before: m[0], after: `${m[1]}-${m[2]}******`, category: '개인정보', severity: 'error',
        reason: '주민등록번호는 문서에 그대로 쓰지 않습니다.',
      }));
    }
    for (const m of node.matchAll(MOBILE)) {
      result.push(ruleSuggestion({
        idx, start: m.index, before: m[0], after: `${m[1]}-****-${m[3]}`, category: '개인정보', severity: 'warning',
        reason: '개인 휴대전화 번호입니다. 대외 문서라면 기관 대표번호로 바꾸거나 가려 주세요.',
      }));
    }
  });
  return result;
}

// AI 요청 전에 개인정보를 가린 노드를 만든다. 원본 노드는 그대로 두고 프롬프트에만 쓴다.
export function maskPersonalInfo(text: string): string {
  return text
    .replace(RRN, (_, front, gender) => `${front}-${gender}******`)
    .replace(MOBILE, (_, head, _mid, tail) => `${head}-****-${tail}`);
}

export function hasPersonalInfo(nodes: string[]): boolean {
  return nodes.some(node => maskPersonalInfo(node) !== node);
}

export function runDocRules(nodes: string[], options: { docKind: DocKind; schoolYear?: number | null }): DocSuggestion[] {
  const year = options.schoolYear ?? detectDocumentYear(nodes);
  return [
    ...checkDateWeekdays(nodes, year),
    ...checkDateNotation(nodes),
    ...checkAmounts(nodes),
    ...checkOutlineNumbering(nodes),
    ...checkEndMark(nodes, options.docKind),
    ...checkPersonalInfo(nodes),
  ];
}

// ─── 전년도 현행화 ──────────────────────────────────────────────────────────

// 관련 근거(공문 번호·법령 시행일)는 과거 날짜 그대로여야 하므로 옮기지 않는다.
const REFERENCE_LINE = /관련|근거|시행|개정|제정|공포|고시|훈령|-\d+\s*\(|호\s*\(|호,/;

const isWeekend = (weekday: string) => weekday === '토' || weekday === '일';

function pad(original: string, value: number): string {
  return original.length === 2 && value < 10 ? `0${value}` : String(value);
}

interface ShiftedDate {
  year: number;
  month: number;
  day: number;
  weekday: string;
  reason: string;
}

// 작년 날짜를 목표 연도로 옮긴다.
// - 옮긴 날짜가 주말이면, 작년과 같은 요일의 가장 가까운 날(±3일)로 옮겨 평일 행사가 주말에 잡히지 않게 한다.
// - 작년 날짜가 원래 토·일요일이었다면 주말 행사로 보고 날짜를 그대로 옮긴다.
// 공휴일은 판단하지 않는다.
export function shiftDate(year: number, month: number, day: number, newYear: number): ShiftedDate | null {
  if (!isValidDate(newYear, month, day)) return null;
  const originalWeekday = weekdayOf(year, month, day);
  const movedWeekday = weekdayOf(newYear, month, day);
  const base = { year: newYear, month, day, weekday: movedWeekday };
  if (!isWeekend(movedWeekday)) return { ...base, reason: '해를 옮기고 요일을 다시 계산' };
  if (isWeekend(originalWeekday)) {
    return { ...base, reason: `작년에도 ${originalWeekday}요일 행사라 주말 그대로 옮김` };
  }
  let delta = (WEEKDAYS.indexOf(originalWeekday) - WEEKDAYS.indexOf(movedWeekday) + 7) % 7;
  if (delta > 3) delta -= 7;
  const adjusted = new Date(newYear, month - 1, day + delta);
  return {
    year: adjusted.getFullYear(),
    month: adjusted.getMonth() + 1,
    day: adjusted.getDate(),
    weekday: originalWeekday,
    reason: `${month}. ${day}.이 ${movedWeekday}요일이라 작년과 같은 ${originalWeekday}요일(${adjusted.getMonth() + 1}. ${adjusted.getDate()}.)로 옮김`,
  };
}

// 요일 없이 쓴 전체 날짜: "2025. 4. 4.", "2025년 4월 4일", "2025-04-04"
const PLAIN_DATE = /(?<!\d)(20\d{2})(\s*(?:\.|년|-)\s*)(\d{1,2})(\s*(?:\.|월|-)\s*)(\d{1,2})(?!\d)/g;

// 기준 학년도의 날짜·학년도 표기를 목표 학년도로 옮기고 요일을 다시 계산한다.
// 학년도는 3월~다음 해 2월이므로 기준 학년도와 그다음 해 날짜만 옮긴다.
export function shiftDatesForSchoolYear(nodes: string[], baseYear: number, targetYear: number): DocSuggestion[] {
  const diff = targetYear - baseYear;
  if (!diff) return [];
  const result: DocSuggestion[] = [];
  const inRange = (y: number) => y === baseYear || y === baseYear + 1;
  const yearMove = `${diff > 0 ? '+' : ''}${diff}년 이동`;
  let skippedReference = false;

  const push = (idx: number, start: number, before: string, after: string, shifted: ShiftedDate, category: string, needsCheck = false) => {
    if (after === before) return;
    const adjusted = shifted.reason.includes('로 옮김') && !shifted.reason.includes('그대로');
    result.push(ruleSuggestion({
      idx, start, before, after, category: adjusted ? '주말 조정' : category, needsCheck,
      severity: adjusted ? 'warning' : 'info',
      reason: `${yearMove}, ${shifted.reason}`,
    }));
  };
  const invalid = (idx: number, start: number, before: string, newYear: number, month: number, day: number) => {
    result.push(ruleSuggestion({ idx, start, before, category: '날짜', severity: 'warning', needsCheck: true, reason: `${newYear}년에는 ${month}월 ${day}일이 없습니다. 날짜를 직접 정해 주세요.` }));
  };

  nodes.forEach((node, idx) => {
    if (REFERENCE_LINE.test(node) && /20\d{2}/.test(node)) {
      skippedReference = true;
      return;
    }
    // 1) 요일이 붙은 전체 날짜
    for (const m of node.matchAll(FULL_DATE)) {
      const [whole, y, sep1, mo, sep2, d, sep3] = m;
      const year = Number(y);
      if (!inRange(year)) continue;
      const shifted = shiftDate(year, Number(mo), Number(d), year + diff);
      if (!shifted) { invalid(idx, m.index!, whole, year + diff, Number(mo), Number(d)); continue; }
      const wdSuffix = whole.match(/\(([일월화수목금토])(요일)?\)$/);
      const after = `${shifted.year}${sep1}${pad(mo, shifted.month)}${sep2}${pad(d, shifted.day)}${sep3}(${shifted.weekday}${wdSuffix?.[2] ?? ''})`;
      push(idx, m.index!, whole, after, shifted, '날짜');
    }
    // 2) 요일 없이 쓴 전체 날짜 (요일이 붙은 날짜는 위에서 처리했으므로 가린다)
    const withoutWeekdayDates = blankFullDates(node);
    for (const m of withoutWeekdayDates.matchAll(PLAIN_DATE)) {
      const [whole, y, sep1, mo, sep2, d] = m;
      const year = Number(y);
      if (!inRange(year) || !isValidDate(year, Number(mo), Number(d))) continue;
      const shifted = shiftDate(year, Number(mo), Number(d), year + diff);
      if (!shifted) { invalid(idx, m.index!, whole, year + diff, Number(mo), Number(d)); continue; }
      push(idx, m.index!, whole, `${shifted.year}${sep1}${pad(mo, shifted.month)}${sep2}${pad(d, shifted.day)}`, shifted, '날짜');
    }
    // 3) 학년도·연월 등 날짜가 아닌 연도 표기
    const yearsOnly = withoutWeekdayDates.replace(PLAIN_DATE, m => ' '.repeat(m.length));
    for (const m of yearsOnly.matchAll(/(20\d{2})(?=\s*(?:학년도|년|\.\s*\d|-\d))/g)) {
      const year = Number(m[1]);
      if (!inRange(year)) continue;
      result.push(ruleSuggestion({ idx, start: m.index, before: m[1], after: String(year + diff), category: '연도', severity: 'info', reason: yearMove }));
    }
    // 4) 연도 없이 요일이 붙은 날짜 ("4. 4.(금)")는 학년도 기준으로 옮긴다
    for (const m of withoutWeekdayDates.matchAll(SHORT_DATE)) {
      const [whole, mo, sep, d, sep2] = m;
      const month = Number(mo); const day = Number(d);
      const fromYear = calendarYearForSchoolYear(baseYear, month);
      const toYear = calendarYearForSchoolYear(targetYear, month);
      if (!isValidDate(fromYear, month, day)) continue;
      const shifted = shiftDate(fromYear, month, day, toYear);
      if (!shifted) continue;
      const wdSuffix = whole.match(/\(([일월화수목금토])(요일)?\)$/);
      const after = `${pad(mo, shifted.month)}${sep}${pad(d, shifted.day)}${sep2}(${shifted.weekday}${wdSuffix?.[2] ?? ''})`;
      // 1~2월은 다음 해로 계산했으므로 확인을 권한다
      push(idx, m.index!, whole, after, shifted, '요일', month <= 2);
    }
  });

  if (skippedReference) {
    result.push(ruleSuggestion({
      idx: -1, before: '', category: '관련 근거', severity: 'info', needsCheck: true,
      reason: '"관련·근거·시행" 줄의 날짜는 과거 공문·법령 날짜일 수 있어 그대로 두었습니다. 올해 근거 공문으로 바꿔야 하는지 확인해 주세요.',
    }));
  }
  return result;
}

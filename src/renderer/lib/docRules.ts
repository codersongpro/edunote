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

// ─── 공문서 표기 규칙(행정업무규정·공문서 작성 편람) ─────────────────────────

const pad2 = (n: number) => String(n).padStart(2, '0');

// 시간은 24시각제로 쓰고 쌍점 양쪽을 붙인다: "오후 3시" → "15:00", "13 : 20" → "13:20", "9:00" → "09:00"
const AMPM_TIME = /(오전|오후)\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?(?:\s*(?:부터|에))?/g;
const SPACED_COLON_TIME = /(?<![\d.])(\d{1,2})\s+:\s*(\d{2})(?!\d)|(?<![\d.])(\d{1,2}):\s+(\d{2})(?!\d)/g;
const SINGLE_DIGIT_HOUR = /(?<![\d.:])(\d):(\d{2})(?![\d:])/g;
export function checkTimeNotation(nodes: string[]): DocSuggestion[] {
  const result: DocSuggestion[] = [];
  nodes.forEach((node, idx) => {
    for (const m of node.matchAll(AMPM_TIME)) {
      const [, half, h, min] = m;
      let hour = Number(h);
      if (hour > 12) continue;
      if (half === '오후' && hour < 12) hour += 12;
      if (half === '오전' && hour === 12) hour = 0;
      const time = `${pad2(hour)}:${pad2(Number(min ?? 0))}`;
      const whole = m[0].replace(/\s*(?:부터|에)$/, '');
      result.push(ruleSuggestion({
        idx, start: m.index, before: whole, after: time, category: '시간 표기', severity: 'info',
        reason: '공문서는 오전·오후 대신 24시각제로 "15:00"처럼 씁니다.',
      }));
    }
    for (const m of node.matchAll(SPACED_COLON_TIME)) {
      const h = m[1] ?? m[3]; const min = m[2] ?? m[4];
      result.push(ruleSuggestion({
        idx, start: m.index, before: m[0], after: `${pad2(Number(h))}:${min}`, category: '시간 표기', severity: 'info',
        reason: '시각의 쌍점은 앞뒤를 붙여 "13:20"처럼 씁니다.',
      }));
    }
    for (const m of node.matchAll(SINGLE_DIGIT_HOUR)) {
      result.push(ruleSuggestion({
        idx, start: m.index, before: m[0], after: `0${m[1]}:${m[2]}`, category: '시간 표기', severity: 'info',
        reason: '10시 전은 "09:00"처럼 앞에 0을 넣습니다.',
      }));
    }
    for (const m of node.matchAll(/(?<!\d)24\s*시\s*까지/g)) {
      result.push(ruleSuggestion({
        idx, start: m.index, before: m[0], category: '시간 표기', severity: 'info', needsCheck: true,
        reason: '"24시까지"는 다음 날 00:00과 헷갈립니다. "18:00까지"처럼 실제 마감 시각으로 써 주세요.',
      }));
    }
  });
  return result;
}

// 기간의 물결표는 앞말과 뒷말에 붙이고, '까지'와 겹쳐 쓰지 않는다.
const SPACED_RANGE = /([\d.)])[ \t]+([~∼])[ \t]*(?=\d)|([\d.)])([~∼])[ \t]+(?=\d)/g;
const RANGE_WITH_KKAJI = /[~∼]\s*[\d.\s:()월화수목금토일]*\d[.)]?\s*까지/g;
export function checkRangeNotation(nodes: string[]): DocSuggestion[] {
  const result: DocSuggestion[] = [];
  nodes.forEach((node, idx) => {
    for (const m of node.matchAll(SPACED_RANGE)) {
      const left = m[1] ?? m[3];
      result.push(ruleSuggestion({
        idx, start: m.index, before: m[0], after: `${left}∼`, category: '기간 표기', severity: 'info',
        reason: '기간을 나타내는 물결표는 "3. 4.(수)∼3. 6.(금)"처럼 앞뒤를 붙여 씁니다.',
      }));
    }
    for (const m of node.matchAll(RANGE_WITH_KKAJI)) {
      result.push(ruleSuggestion({
        idx, start: m.index, before: m[0], after: m[0].replace(/\s*까지$/, ''), category: '기간 표기', severity: 'info',
        reason: '물결표에 이미 "까지"의 뜻이 있어 겹쳐 쓰지 않습니다.',
      }));
    }
  });
  return result;
}

// '붙임' 다음에는 쌍점을 쓰지 않고 두 칸 띄운다.
export function checkAttachmentNotation(nodes: string[]): DocSuggestion[] {
  const result: DocSuggestion[] = [];
  nodes.forEach((node, idx) => {
    const m = node.match(/^(\s*)붙임\s*:\s*/);
    if (!m) return;
    result.push(ruleSuggestion({
      idx, start: m[1].length, before: m[0].slice(m[1].length), after: '붙임  ', category: '붙임 표시', severity: 'info',
      reason: '"붙임" 뒤에는 쌍점 없이 두 칸 띄웁니다.',
    }));
  });
  return result;
}

// 공문서 작성 편람의 순화어·중복 표현. 뜻이 하나로 정해지는 표현만 넣어 오검출을 줄인다.
const PLAIN_WORDS: Array<[RegExp, string, string]> = [
  [/(?<![가-힣])금일(?=[\s,은는이까부에]|$)/g, '오늘', '"금일"은 "오늘"로 씁니다.'],
  [/(?<![가-힣])익일(?=[\s은는이까부에]|$)/g, '다음 날', '"익일"은 "다음 날"로 씁니다.'],
  [/(?<![가-힣])향후(?=[\s,]|$)/g, '앞으로', '"향후"는 "앞으로"로 쓰면 더 쉽습니다.'],
  [/에\s?의거하여|에\s?의거해|에\s?의거,?/g, '에 따라', '"의거하여"는 "따라"로 씁니다.'],
  [/만전을\s?기하여|만전을\s?기해/g, '최선을 다해', '"만전을 기해"는 "최선을 다해"로 씁니다.'],
  [/(?<![가-힣])하기와\s?같이/g, '아래와 같이', '"하기"는 "아래"로 씁니다.'],
  [/(?<![가-힣])상기와\s?같이/g, '위와 같이', '"상기"는 "위"로 씁니다.'],
  [/미리\s?예측/g, '예측', '"미리 예측"은 뜻이 겹칩니다.'],
  [/반드시\s?필요/g, '필요', '"반드시 필요"는 뜻이 겹칩니다.'],
  [/새로\s?신설/g, '신설', '"새로 신설"은 뜻이 겹칩니다.'],
  [/과반수\s?이상/g, '과반수', '"과반수"에 이미 "넘는다"는 뜻이 있습니다.'],
  [/(\d{1,2})월달/g, '$1월', '"월달"은 뜻이 겹칩니다.'],
  [/향상시키/g, '향상하', '"향상시키다"는 "향상하다"로 씁니다.'],
  [/발송시키/g, '보내', '"발송시키다"는 "보내다"로 씁니다.'],
];
export function checkPlainWords(nodes: string[]): DocSuggestion[] {
  const result: DocSuggestion[] = [];
  nodes.forEach((node, idx) => {
    for (const [pattern, replacement, reason] of PLAIN_WORDS) {
      for (const m of node.matchAll(pattern)) {
        result.push(ruleSuggestion({
          idx, start: m.index, before: m[0], after: m[0].replace(new RegExp(pattern.source), replacement),
          category: '쉬운 표현', severity: 'info', reason,
        }));
      }
    }
  });
  return result;
}

// ─── 금액 한글 병기 ─────────────────────────────────────────────────────────
const KO_DIGITS = '영일이삼사오육칠팔구';
const KO_SMALL = ['', '십', '백', '천'];
const KO_BIG = ['', '만', '억', '조'];

// 113560 → "일십일만삼천오백육십" (공문서 관례대로 십·백·천 앞의 '일'도 쓴다)
export function toKoreanAmount(value: number): string {
  if (!Number.isSafeInteger(value) || value <= 0) return value === 0 ? '영' : '';
  let out = '';
  let rest = value;
  for (let g = 0; rest > 0; g++) {
    const group = rest % 10000;
    rest = Math.floor(rest / 10000);
    if (!group) continue;
    let text = '';
    String(group).padStart(4, '0').split('').forEach((d, i) => {
      if (d !== '0') text += KO_DIGITS[Number(d)] + KO_SMALL[3 - i];
    });
    out = text + KO_BIG[g] + out;
  }
  return out;
}

// "일십일만삼천오백육십", "십일만삼천오백육십", "오십만" → 숫자. 읽을 수 없으면 null.
export function parseKoreanAmount(text: string): number | null {
  const clean = text.replace(/[\s,]/g, '');
  if (!clean || /[^영일이삼사오육칠팔구십백천만억조]/.test(clean)) return null;
  let total = 0; let section = 0; let digit = 0;
  for (const ch of clean) {
    const d = KO_DIGITS.indexOf(ch);
    const small = KO_SMALL.indexOf(ch);
    const big = KO_BIG.indexOf(ch);
    if (d >= 0) digit = d;
    else if (small > 0) { section += (digit || 1) * 10 ** small; digit = 0; }
    else if (big > 0) { total += (section + digit || 1) * 10000 ** big; section = 0; digit = 0; }
  }
  return total + section + digit;
}

// 금액은 "금113,560원(금일십일만삼천오백육십원)"으로 쓴다. 한글 병기가 숫자와 다르면 오류로 알린다.
const WON_AMOUNT = /금\s?([\d,]{4,})\s?원(?:\s?\(\s?(?:일?금)?\s?([가-힣\s]+?)\s?원?정?\s?\))?/g;
export function checkAmountNotation(nodes: string[]): DocSuggestion[] {
  const result: DocSuggestion[] = [];
  nodes.forEach((node, idx) => {
    for (const m of node.matchAll(WON_AMOUNT)) {
      const [whole, digits, korean] = m;
      const value = toNumber(digits);
      const canonical = `금${formatWon(value)}원(금${toKoreanAmount(value)}원)`;
      if (korean === undefined) {
        result.push(ruleSuggestion({
          idx, start: m.index, before: whole, after: canonical, category: '금액 표기', severity: 'info',
          reason: '공문서 금액은 숫자 뒤 괄호 안에 한글 금액을 함께 씁니다.',
        }));
        continue;
      }
      const parsed = parseKoreanAmount(korean);
      if (parsed !== null && parsed !== value) {
        result.push(ruleSuggestion({
          // 글자 금액이 맞고 숫자가 틀렸을 수도 있으므로 자동 반영하지 않는다(규칙 오류만 미리 반영됨).
          idx, start: m.index, before: whole, after: canonical, category: '금액 표기', severity: 'warning', needsCheck: true,
          reason: `한글 금액(${korean.trim()})이 숫자 ${formatWon(value)}원과 다릅니다. 글자와 숫자가 다르면 글자 금액이 우선하므로 꼭 맞춰 주세요.`,
        }));
      } else if (parsed !== null && whole !== canonical && /\s/.test(whole)) {
        result.push(ruleSuggestion({
          idx, start: m.index, before: whole, after: canonical, category: '금액 표기', severity: 'info',
          reason: '"금113,560원(금일십일만삼천오백육십원)"처럼 띄우지 않고 씁니다.',
        }));
      }
    }
    for (const m of node.matchAll(/(?<![\d,])(\d{1,3}(?:,\d{3})*)\s?천\s?원/g)) {
      const value = toNumber(m[1]) * 1000;
      result.push(ruleSuggestion({
        idx, start: m.index, before: m[0], after: `${formatWon(value)}원`, category: '금액 표기', severity: 'info',
        reason: '"천 원" 단위 표기는 읽는 사람이 다시 계산해야 하므로 원 단위로 씁니다.',
      }));
    }
  });
  return result;
}

// 문서작성기가 남긴 자리표시([담당자] 등)와 ○○ 표시가 그대로 남아 있으면 알린다.
const PLACEHOLDER = /\[(?:담당자|연락처|수신\s?기관명|[^\]\n]{0,10}(?:마감|기한)[^\]\n]{0,6}|[^\]\n]{0,10}일시)\]|○{2,}(?:[가-힣]{0,3}[-.\s()]*○+)*\.?\)?/g;
export function checkPlaceholders(nodes: string[]): DocSuggestion[] {
  const result: DocSuggestion[] = [];
  nodes.forEach((node, idx) => {
    for (const m of node.matchAll(PLACEHOLDER)) {
      result.push(ruleSuggestion({
        idx, start: m.index, before: m[0].trim(), category: '채울 자리', severity: 'warning', needsCheck: true,
        reason: '직접 채워야 하는 자리가 남아 있습니다. 발송 전에 실제 값으로 바꿔 주세요.',
      }));
    }
  });
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
    ...checkTimeNotation(nodes),
    ...checkRangeNotation(nodes),
    ...checkAttachmentNotation(nodes),
    ...checkAmountNotation(nodes),
    ...checkPlainWords(nodes),
    ...checkPlaceholders(nodes),
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

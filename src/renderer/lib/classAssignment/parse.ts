import { parseClassLabel } from './criteria';
import { readXlsx, MAX_XLSX_BYTES, type Cell, type SheetData } from './xlsx';
import type { ClassStudent, Diagnostic, Gender } from './types';

// 반편성 명단 파일(CSV·XLSX) → 학생 목록 + 진단
// 원본 앱 대비 보완: 따옴표 CSV, 성별 오타 검출, 안정 ID(전반-번호), 머리글 별칭, 결과 파일 재업로드 시 중복 시트 무시

export const MAX_STUDENTS = 2000;

/** 양식에 넣은 예시 행 표시 — 이름이 이 문구로 시작하면 편성에서 자동으로 뺀다(지우지 않고 올려도 안전) */
export const EXAMPLE_NAME_PREFIX = '(예시)';
const isExampleName = (name: string) => name.replace(/\s/g, '').startsWith(EXAMPLE_NAME_PREFIX);

/** 양식 열 — 순서가 곧 양식 파일의 열 순서 */
export const TEMPLATE_COLUMNS: Array<{ header: string; note: string; example: Cell }> = [
  { header: '전학년반', note: '필수 · 숫자', example: 1 },
  { header: '전학년번호', note: '필수 · 숫자', example: 1 },
  { header: '이름', note: '필수', example: '홍길동' },
  { header: '성별', note: '필수 · 남/여', example: '남' },
  { header: '성적순위(반 내)', note: '석차 기준 편성 시 · 1 = 최상위', example: 5 },
  { header: '평균성적', note: '점수 기준 편성 시', example: 85 },
  { header: '국어성적', note: '선택', example: 88 },
  { header: '수학성적', note: '선택', example: 82 },
  { header: '생활지도', note: '0~3 (3 = 집중 지도)', example: 0 },
  { header: '기초학력', note: 'O = 지원 대상', example: '' },
  { header: '특수교육', note: 'O = 특수교육대상(통합학급)', example: '' },
  { header: '분리요청학생', note: '이름 또는 이름(전반-번호), 여러 명은 쉼표', example: '' },
  { header: '같은반희망', note: '같은 반이어야 하는 학생', example: '' },
  { header: '쌍생아', note: '쌍생아 형제 이름', example: '' },
  { header: '고정반', note: '반드시 배정할 반(예: 2 또는 나)', example: '' },
  { header: '제외반', note: '배정하면 안 되는 반, 여러 개는 쉼표', example: '' },
  { header: '특이사항', note: '참고용(편성에 쓰지 않음)', example: '' },
];

type Field =
  | 'assigned' | 'prevClass' | 'prevNumber' | 'name' | 'gender' | 'korean' | 'math' | 'average' | 'rank'
  | 'behavior' | 'basic' | 'special' | 'separation' | 'together' | 'twins' | 'fixed' | 'excluded' | 'notes';

const ALIASES: Record<string, Field> = {
  배정반: 'assigned', 편성반: 'assigned', 새반: 'assigned',
  전학년반: 'prevClass', 이전반: 'prevClass', 전반: 'prevClass', 현재반: 'prevClass', 반: 'prevClass',
  전학년번호: 'prevNumber', 번호: 'prevNumber', 이전번호: 'prevNumber',
  이름: 'name', 성명: 'name', 학생명: 'name',
  성별: 'gender',
  국어성적: 'korean', 국어: 'korean',
  수학성적: 'math', 수학: 'math',
  평균성적: 'average', 평균: 'average', 평균점수: 'average',
  성적순위: 'rank', 석차: 'rank', 반내석차: 'rank', 순위: 'rank',
  생활지도: 'behavior', 생활지도점수: 'behavior',
  기초학력: 'basic', 기초학력대상: 'basic',
  특수교육: 'special', 특수교육대상: 'special', 특수: 'special',
  분리요청학생: 'separation', 분리요청: 'separation', 분리희망: 'separation',
  같은반희망: 'together', 동반배정: 'together',
  쌍생아: 'twins', 쌍둥이: 'twins',
  고정반: 'fixed', 지정반: 'fixed',
  제외반: 'excluded',
  특이사항: 'notes', 비고: 'notes', 메모: 'notes',
};

/** "성적순위(반 내)" → "성적순위", 공백 제거 */
export const normalizeHeader = (h: unknown) => String(h ?? '').replace(/\(.*?\)/g, '').replace(/[\s_]/g, '').trim();

/** RFC 4180 CSV (따옴표 안 쉼표·줄바꿈·"" 처리, BOM 제거) */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}

const str = (v: Cell | undefined) => (v === null || v === undefined ? '' : String(v).trim());
function num(v: Cell | undefined): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const t = str(v).replace(/,/g, '');
  if (!t || t.includes('#')) return null;
  const n = Number(t.replace(/[^\d.-]/g, ''));
  return t.match(/\d/) && Number.isFinite(n) ? n : null;
}
const isYes = (v: Cell | undefined) => /^(o|○|◯|y|yes|예|해당|1|true|v|✓|●)$/i.test(str(v));

function parseGender(v: Cell | undefined): Gender | '' {
  const t = str(v).toUpperCase();
  if (['남', '남자', 'M', 'MALE', '남학생'].includes(t)) return '남';
  if (['여', '여자', 'F', 'FEMALE', '여학생'].includes(t)) return '여';
  return '';
}

export interface ParseResult {
  students: ClassStudent[];
  diagnostics: Diagnostic[];
  /** 숫자 값이 있는 추가 열(사용자 정의 기준 후보) */
  extraNumericColumns: string[];
  /** 결과 파일을 다시 올린 경우 최대 배정반 */
  importedClassCount: number;
}

/** 시트(행 배열)들에서 학생을 읽는다. 결과 파일이면 '전체명단' 시트만 사용 */
export function rowsToStudents(sheets: SheetData[]): ParseResult {
  const diagnostics: Diagnostic[] = [];
  const full = sheets.find(s => s.name.replace(/\s/g, '') === '전체명단');
  const sources = full ? [full] : sheets;
  const students: ClassStudent[] = [];
  const extraNumeric = new Set<string>();
  const seen = new Map<string, ClassStudent>();
  let exampleRows = 0;

  for (const sheet of sources) {
    // 머리글 행 = '이름'과 함께 '전학년반' 또는 '성별'이 있는 행.
    // (양식의 「작성방법」 시트처럼 '이름'이라는 글자만 있는 안내 시트는 명단으로 보지 않는다)
    const headerIdx = sheet.rows.findIndex(r => {
      const fields = new Set(r.map(c => ALIASES[normalizeHeader(c)]));
      return fields.has('name') && (fields.has('prevClass') || fields.has('gender'));
    });
    if (headerIdx < 0) continue;
    const header = sheet.rows[headerIdx].map(normalizeHeader);
    const raw = sheet.rows[headerIdx].map(c => str(c));
    const col = new Map<Field, number>();
    const extraCols: Array<{ i: number; name: string }> = [];
    header.forEach((h, i) => {
      const f = ALIASES[h];
      if (f && !col.has(f)) col.set(f, i);
      else if (!f && h) extraCols.push({ i, name: raw[i] });
    });
    if (!col.has('prevClass') || !col.has('gender')) {
      diagnostics.push({ level: 'error', message: `'${sheet.name}' 시트에 '전학년반' 또는 '성별' 열이 없습니다.` });
      continue;
    }
    const get = (row: Cell[], f: Field) => (col.has(f) ? row[col.get(f)!] : null);

    for (let r = headerIdx + 1; r < sheet.rows.length; r++) {
      const row = sheet.rows[r] ?? [];
      const name = str(get(row, 'name'));
      if (!name) continue;
      if (isExampleName(name)) { exampleRows++; continue; }
      const where = `${sheet.name} ${r + 1}행`;
      const prevClass = num(get(row, 'prevClass'));
      const prevNumber = num(get(row, 'prevNumber'));
      const gender = parseGender(get(row, 'gender'));
      if (prevClass === null || prevClass <= 0) {
        diagnostics.push({ level: 'error', message: `${where} ${name}: 전학년반이 비어 있거나 숫자가 아닙니다.` });
        continue;
      }
      if (!gender) diagnostics.push({ level: 'error', message: `${where} ${name}: 성별 '${str(get(row, 'gender'))}'을(를) 알 수 없습니다(남/여).` });
      const behaviorRaw = num(get(row, 'behavior'));
      const behavior = behaviorRaw === null ? 0 : Math.max(0, Math.min(3, Math.round(behaviorRaw)));
      if (behaviorRaw !== null && behavior !== behaviorRaw) {
        diagnostics.push({ level: 'warning', message: `${where} ${name}: 생활지도 ${behaviorRaw} → ${behavior}(0~3)로 조정했습니다.` });
      }
      const extra: Record<string, number | string> = {};
      for (const { i, name: colName } of extraCols) {
        const v = row[i];
        const n = num(v);
        if (n !== null && typeof v === 'number') { extra[colName] = n; extraNumeric.add(colName); }
        else if (n !== null && /^-?[\d.,]+$/.test(str(v))) { extra[colName] = n; extraNumeric.add(colName); }
        else if (str(v)) extra[colName] = str(v);
      }
      const excludedClasses = str(get(row, 'excluded')).split(/[,;/\s]+/).map(parseClassLabel).filter((x): x is number => x !== null);
      const fixedRaw = str(get(row, 'fixed'));
      const fixedClass = fixedRaw ? parseClassLabel(fixedRaw) : null;
      if (fixedRaw && fixedClass === null) diagnostics.push({ level: 'warning', message: `${where} ${name}: 고정반 '${fixedRaw}'을(를) 읽을 수 없어 무시합니다.` });
      const pn = prevNumber ?? 0;
      let id = `${prevClass}-${pn}`;
      const dup = seen.get(id);
      if (dup) {
        if (dup.name === name) continue; // 같은 학생이 여러 시트에 있으면 한 번만
        diagnostics.push({ level: 'warning', message: `${where}: ${name}과(와) ${dup.name}의 전학년반-번호(${id})가 같습니다. 번호를 확인해 주세요.` });
        let k = 2;
        while (seen.has(`${id}#${k}`)) k++;
        id = `${id}#${k}`;
      }
      const student: ClassStudent = {
        id, prevClass, prevNumber: pn, name, gender,
        korean: num(get(row, 'korean')), math: num(get(row, 'math')), average: num(get(row, 'average')),
        rank: num(get(row, 'rank')), behavior,
        basicAcademic: isYes(get(row, 'basic')), specialNeeds: isYes(get(row, 'special')),
        separationRaw: str(get(row, 'separation')), togetherRaw: str(get(row, 'together')), twinsRaw: str(get(row, 'twins')),
        fixedClass, excludedClasses, notes: str(get(row, 'notes')), extra,
        importedClass: parseClassLabel(get(row, 'assigned')),
      };
      seen.set(id, student);
      students.push(student);
      if (students.length > MAX_STUDENTS) throw new Error(`학생 수가 ${MAX_STUDENTS}명을 넘습니다. 학년별로 나눠 올려 주세요.`);
    }
  }
  if (students.length === 0 && !diagnostics.some(d => d.level === 'error')) {
    diagnostics.push({ level: 'error', message: "학생을 찾지 못했습니다. 첫 줄에 '이름'·'전학년반'·'성별' 머리글이 있는지 확인해 주세요." });
  }

  if (exampleRows > 0) {
    diagnostics.push({ level: 'info', message: `양식의 예시 행 ${exampleRows}개('${EXAMPLE_NAME_PREFIX}'로 시작하는 이름)는 편성에서 제외했습니다.` });
  }

  // 동명이인 안내
  const byName = new Map<string, ClassStudent[]>();
  for (const s of students) byName.set(s.name.replace(/\s/g, ''), [...(byName.get(s.name.replace(/\s/g, '')) ?? []), s]);
  for (const [name, list] of byName) {
    if (list.length > 1) {
      diagnostics.push({
        level: 'info',
        message: `동명이인 ${name} ${list.length}명(${list.map(s => `${s.prevClass}-${s.prevNumber}`).join(', ')}) — 분리요청 등에 적을 때는 '${name}(전반-번호)' 형식을 쓰세요.`,
        studentIds: list.map(s => s.id),
      });
    }
  }
  const scored = students.filter(s => s.rank !== null).length;
  if (students.length && scored === 0 && students.every(s => s.average === null)) {
    diagnostics.push({ level: 'info', message: '석차·성적 자료가 없어 학업 수준 평준화는 적용되지 않습니다.' });
  }
  return {
    students,
    diagnostics,
    extraNumericColumns: [...extraNumeric],
    importedClassCount: Math.max(0, ...students.map(s => s.importedClass ?? 0)),
  };
}

export async function parseRosterFile(file: { name: string; size: number; arrayBuffer(): Promise<ArrayBuffer> }): Promise<ParseResult> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (file.size > MAX_XLSX_BYTES) throw new Error('파일이 5MB를 넘습니다.');
  const buffer = await file.arrayBuffer();
  if (ext === 'xlsx') return rowsToStudents(await readXlsx(buffer));
  if (ext === 'csv' || ext === 'txt') {
    let text = new TextDecoder('utf-8').decode(buffer);
    // 엑셀이 저장한 CSV(CP949)는 UTF-8로 읽으면 깨진다 → euc-kr로 다시 읽기
    if (text.includes('�')) {
      try { text = new TextDecoder('euc-kr').decode(buffer); } catch { /* 지원하지 않으면 그대로 */ }
    }
    return rowsToStudents([{ name: file.name, rows: parseCsv(text) }]);
  }
  if (ext === 'xls') throw new Error('구형 .xls 파일은 엑셀에서 「다른 이름으로 저장 → Excel 통합 문서(.xlsx)」로 바꿔 올려 주세요.');
  throw new Error('xlsx 또는 csv 파일만 올릴 수 있습니다.');
}

import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { classLabel, defaultConfig, parseClassLabel } from '../classAssignment/criteria';
import { buildResultWorkbook, buildTemplateWorkbook } from '../classAssignment/export';
import { evaluateCompliance } from '../classAssignment/metrics';
import { parseCsv, rowsToStudents, TEMPLATE_COLUMNS } from '../classAssignment/parse';
import { resolveRelations } from '../classAssignment/relations';
import { readXlsx, writeXlsx } from '../classAssignment/xlsx';
import { makeCohort, student } from './classAssignment.fixtures';

describe('CSV 파싱', () => {
  it('따옴표 안 쉼표·줄바꿈·"" 와 BOM을 처리한다', () => {
    const rows = parseCsv('﻿이름,특이사항\r\n홍길동,"쉼표, 있음"\n김철수,"줄\n바꿈 ""인용"""\n');
    expect(rows).toEqual([['이름', '특이사항'], ['홍길동', '쉼표, 있음'], ['김철수', '줄\n바꿈 "인용"']]);
  });
});

describe('명단 읽기', () => {
  const header = ['전학년반', '전학년번호', '이름', '성별', '성적순위(반 내)', '생활지도', '기초학력', '분리요청학생', '고정반', '제외반', '체육'];
  it('머리글 별칭·성별 오류·생활지도 범위·추가 숫자열을 처리한다', () => {
    const r = rowsToStudents([{ name: '명단', rows: [header, [1, 1, '홍길동', '남자', 3, 5, 'O', '', '나', '1,2', 80], [1, 2, '김영희', '?', 1, 0, '', '홍길동', '', '', 75]] }]);
    expect(r.students).toHaveLength(2);
    const [a, b] = r.students;
    expect(a).toMatchObject({ id: '1-1', gender: '남', rank: 3, behavior: 3, basicAcademic: true, fixedClass: 2, excludedClasses: [1, 2] });
    expect(a.extra['체육']).toBe(80);
    expect(b.gender).toBe('');
    expect(r.extraNumericColumns).toEqual(['체육']);
    expect(r.diagnostics.some(d => d.level === 'error' && d.message.includes('성별'))).toBe(true);
    expect(r.diagnostics.some(d => d.message.includes('생활지도 5'))).toBe(true);
  });

  it('결과 파일을 다시 올리면 전체명단 시트만 읽고 배정반을 복원한다', () => {
    const r = rowsToStudents([
      { name: '결과리포트', rows: [['반편성 결과 리포트'], ['반', '인원']] },
      { name: '가반', rows: [['번호', '이름', '성별', '전학년반'], [1, '홍길동', '남', 1]] },
      { name: '전체명단', rows: [['배정반', ...header], ['나반', 1, 1, '홍길동', '남']] },
    ]);
    expect(r.students).toHaveLength(1);
    expect(r.students[0].importedClass).toBe(2);
    expect(r.importedClassCount).toBe(2);
  });

  it('반 이름 변환', () => {
    expect(classLabel(1)).toBe('가반');
    expect(classLabel(15)).toBe('가가반');
    expect(classLabel(3, 'number')).toBe('3반');
    expect(parseClassLabel('다반')).toBe(3);
    expect(parseClassLabel('가가')).toBe(15);
    expect(parseClassLabel('4반')).toBe(4);
    expect(parseClassLabel('?')).toBeNull();
  });
});

describe('관계 해석', () => {
  it('부분 문자열은 매칭하지 않는다("이준" ≠ "이준호")', () => {
    const students = [
      student({ prevClass: 1, prevNumber: 1, name: '이준호', twinsRaw: '이준' }),
      student({ prevClass: 1, prevNumber: 2, name: '이준서' }),
    ];
    const r = resolveRelations(students, 'together');
    expect(r.togetherGroups).toHaveLength(0);
    expect(r.diagnostics[0].message).toContain('명단에 없습니다');
  });

  it('동명이인은 경고하고, 이름(전반-번호)로 구분한다', () => {
    const students = [
      student({ prevClass: 1, prevNumber: 1, name: '김민준', separationRaw: '이서연' }),
      student({ prevClass: 2, prevNumber: 3, name: '이서연' }),
      student({ prevClass: 3, prevNumber: 4, name: '이서연' }),
      student({ prevClass: 1, prevNumber: 2, name: '박하은', separationRaw: '이서연(3-4); 2-3' }),
    ];
    const r = resolveRelations(students, 'together');
    expect(r.diagnostics.some(d => d.message.includes('동명이인'))).toBe(true);
    expect(r.separationPairs).toEqual([['1-2', '3-4'], ['1-2', '2-3']]);
  });

  it('분리요청과 같은반이 충돌하면 오류로 알린다', () => {
    const students = [
      student({ prevClass: 1, prevNumber: 1, name: '가', twinsRaw: '나', separationRaw: '나' }),
      student({ prevClass: 1, prevNumber: 2, name: '나', twinsRaw: '가' }),
    ];
    const r = resolveRelations(students, 'together');
    expect(r.diagnostics.some(d => d.level === 'error')).toBe(true);
  });

  it('세쌍둥이·겹치는 묶음을 하나로 합친다', () => {
    const students = [
      student({ prevClass: 1, prevNumber: 1, name: '가', twinsRaw: '나,다' }),
      student({ prevClass: 1, prevNumber: 2, name: '나' }),
      student({ prevClass: 1, prevNumber: 3, name: '다', togetherRaw: '라' }),
      student({ prevClass: 1, prevNumber: 4, name: '라' }),
    ];
    expect(resolveRelations(students, 'together').togetherGroups.map(g => g.length)).toEqual([4]);
  });
});

describe('XLSX 읽기·쓰기', () => {
  it('왕복: 문자열·숫자·빈칸·수식처럼 보이는 텍스트', async () => {
    const buf = await writeXlsx([{ name: '시험/시트', rows: [['이름', '점수', '메모'], ['홍길동', 90.5, '=CMD()'], ['김<영>희', null, '']] }]);
    const sheets = await readXlsx(buf);
    expect(sheets[0].name).toBe('시험 시트');
    expect(sheets[0].rows[1]).toEqual(['홍길동', 90.5, '=CMD()']);
    expect(sheets[0].rows[2][0]).toBe('김<영>희');
    // '='로 시작하는 값은 수식(<f>)이 아니라 텍스트로 저장된다
    const zip = await JSZip.loadAsync(buf);
    expect(await zip.file('xl/worksheets/sheet1.xml')!.async('string')).not.toContain('<f>');
  });

  it('공유 문자열(sharedStrings)을 쓰는 일반 엑셀 파일을 읽는다', async () => {
    const zip = new JSZip();
    zip.file('xl/workbook.xml', '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="1반" sheetId="1" r:id="rId1"/></sheets></workbook>');
    zip.file('xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>');
    zip.file('xl/sharedStrings.xml', '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>이름</t></si><si><r><t>홍</t></r><r><t>길동</t></r></si></sst>');
    zip.file('xl/worksheets/sheet1.xml', '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1"><v>3</v></c></row><row r="3"><c r="B3" t="s"><v>1</v></c></row></sheetData></worksheet>');
    const sheets = await readXlsx(await zip.generateAsync({ type: 'arraybuffer' }));
    expect(sheets[0].rows).toEqual([['이름', null, 3], [], [null, '홍길동']]);
  });

  it('양식 파일에 모든 열과 예시 3명이 있다', async () => {
    const sheets = await readXlsx(await buildTemplateWorkbook());
    expect(sheets[0].rows[0]).toEqual(TEMPLATE_COLUMNS.map(c => c.header));
    expect(sheets[0].rows.slice(1)).toHaveLength(3);
    expect(sheets[0].rows.slice(1).every(r => r.length <= TEMPLATE_COLUMNS.length)).toBe(true);
  });

  it('예시 행은 지우지 않고 올려도 편성에서 빠지고, 안내가 나온다', async () => {
    const template = await readXlsx(await buildTemplateWorkbook());
    template[0].rows.push([3, 1, '홍길동', '남', 1, 90]);
    const r = rowsToStudents(template);
    expect(r.students.map(s => s.name)).toEqual(['홍길동']);
    expect(r.diagnostics.some(d => d.level === 'info' && d.message.includes('예시 행 3개'))).toBe(true);
    expect(r.diagnostics.some(d => d.level === 'error')).toBe(false);
  });

  it('예시 행 값은 실제 행으로 읽어도 형식이 올바르다(열 순서 확인)', async () => {
    const template = await readXlsx(await buildTemplateWorkbook());
    const rows = template[0].rows.map((row, i) => (i === 0 ? row : row.map((c, k) => (k === 2 ? String(c).replace('(예시)', '') : typeof c === 'string' ? c.replace(/\(예시\)/g, '') : c))));
    const r = rowsToStudents([{ name: '명단', rows }]);
    expect(r.students).toHaveLength(3);
    const [a, b, c] = r.students;
    expect(a).toMatchObject({ name: '김하늘', gender: '여', rank: 3, behavior: 0, separationRaw: '박바다' });
    expect(b).toMatchObject({ name: '박바다', basicAcademic: true, behavior: 2, togetherRaw: '이솔(2-5)' });
    expect(c).toMatchObject({ name: '이솔', specialNeeds: true, fixedClass: 2, excludedClasses: [1] });
    const rel = resolveRelations(r.students, 'together');
    expect(rel.diagnostics).toHaveLength(0);
  });

  it('결과 파일을 다시 읽으면 같은 배정이 복원된다', async () => {
    const students = makeCohort(40, 2, 3, { separations: 2 });
    const cfg = defaultConfig(3);
    const assignment = Object.fromEntries(students.map((s, i) => [s.id, (i % 3) + 1]));
    const relations = resolveRelations(students, cfg.twinsMode);
    const buf = await buildResultWorkbook(students, assignment, cfg, null, evaluateCompliance(students, assignment, cfg, relations));
    const parsed = rowsToStudents(await readXlsx(buf));
    expect(parsed.students).toHaveLength(40);
    for (const s of parsed.students) expect(s.importedClass).toBe(assignment[s.id]);
    expect(parsed.students.map(s => s.separationRaw)).toEqual(
      [...students].sort((a, b) => assignment[a.id] - assignment[b.id] || a.name.localeCompare(b.name, 'ko')).map(s => s.separationRaw),
    );
  });
});

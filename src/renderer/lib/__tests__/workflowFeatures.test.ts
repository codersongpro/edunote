import { describe, expect, it } from 'vitest';
import {
  buildInstitutionFormatInstruction,
  calculateBudgetActuals,
  contentFingerprint,
  filterResourceUsage,
  normalizeInstitutionFormat,
  retryableStudentIds,
  splitRecordSentences,
  generationStatusForError,
  ensureWorksheetQuestionIds,
  validateWorksheetVariantLinkage,
} from '../workflowFeatures';

describe('workflowFeatures', () => {
  it('완료되었거나 안전 차단된 학생과 최종본 고정 학생은 재시도하지 않는다', () => {
    expect(retryableStudentIds([
      { id: '1', generatedContent: '완료', generationStatus: 'completed' },
      { id: '2', generationStatus: 'failed' },
      { id: '3', generationStatus: 'blocked' },
      { id: '4', generationStatus: 'idle' },
      { id: '5', generationStatus: 'failed', reviewStatus: 'final' },
    ])).toEqual(['2', '4']);
  });

  it('학생 기록을 근거 연결 가능한 문장으로 나눈다', () => {
    expect(splitRecordSentences('탐구에 참여함. 친구의 이해를 도왔음!')).toEqual([
      '탐구에 참여함.',
      '친구의 이해를 도왔음!',
    ]);
  });

  it('안전 정책 오류는 자동 재시도 대상이 아닌 차단 상태로 분류한다', () => {
    expect(generationStatusForError(new Error('AI 응답이 안전 정책에 따라 중단되었습니다.'))).toBe('blocked');
    expect(generationStatusForError(new Error('network error'))).toBe('failed');
  });

  it('선택한 기관 서식을 생성 프롬프트 문장으로 만든다', () => {
    expect(buildInstitutionFormatInstruction({
      name: '학교 계획서(번호식)',
      outline: '1. 추진 배경 / 2. 목적',
      bulletStyle: '1. → 가. → 1)',
      fontSize: 13,
      endingStyle: '명사형 개조식(~함, ~임)',
    })).toBe([
      '서식명: 학교 계획서(번호식)',
      '목차: 1. 추진 배경 / 2. 목적',
      '글머리표: 1. → 가. → 1)',
      '기본 글자 크기: 13pt',
      '문장 종결: 명사형 개조식(~함, ~임)',
    ].join('\n'));
  });

  it('채우지 않은 항목은 서식 문장에서 빼고, 목차·글머리표·종결이 모두 비면 서식으로 보지 않는다', () => {
    expect(buildInstitutionFormatInstruction({ name: '', outline: '', bulletStyle: '가.', fontSize: 13, endingStyle: '' }))
      .toBe('글머리표: 가.\n기본 글자 크기: 13pt');
    // 글자 크기만 남으면 기본 말머리 서식 보정을 끄지 않도록 빈 문자열을 돌려준다.
    expect(buildInstitutionFormatInstruction({ name: '이름만 있음', outline: '', bulletStyle: '', fontSize: 15, endingStyle: '' })).toBe('');
    expect(buildInstitutionFormatInstruction({})).toBe('');
  });

  it('계획액과 여러 실제 지출의 합계·잔액을 분리한다', () => {
    expect(calculateBudgetActuals(200000, [
      { id: 'a', paidAt: '2026-09-01', amount: 120000, memo: '' },
      { id: 'b', paidAt: '2026-09-03', amount: 50000, memo: '' },
    ])).toEqual({ planned: 200000, spent: 170000, balance: 30000 });
  });

  it('자료 활용 기록은 학년 또는 단원으로 검색한다', () => {
    const records = [
      { id: '1', usedAt: '2026-09-01', grade: '5학년', unit: '분수', note: '앞 3분만 사용' },
      { id: '2', usedAt: '2026-09-02', grade: '6학년', unit: '비와 비율', note: '좋음' },
    ];
    expect(filterResourceUsage(records, '분수')).toHaveLength(1);
    expect(filterResourceUsage(records, '5학년')).toHaveLength(1);
  });

  it('기관 서식에서 본문·학생·인명 필드를 저장하지 않는다', () => {
    expect(normalizeInstitutionFormat({
      id: 'f1', docType: 'PLAN', name: '학교 계획서', outline: 'Ⅰ. 목적', bulletStyle: '가.',
      fontSize: 13, endingStyle: '~함', body: '민감 본문', studentName: '홍길동', personName: '김교사',
    })).toEqual({
      id: 'f1', docType: 'PLAN', name: '학교 계획서', outline: 'Ⅰ. 목적', bulletStyle: '가.',
      fontSize: 13, endingStyle: '~함',
    });
  });

  it('원본 내용이 바뀌면 답안 연결 지문도 바뀐다', () => {
    expect(contentFingerprint('<p>문항 1</p>')).toBe(contentFingerprint('<p>문항 1</p>'));
    expect(contentFingerprint('<p>문항 1</p>')).not.toBe(contentFingerprint('<p>문항 2</p>'));
  });

  it('원본 문항에 안정적인 ID를 붙이고 실제 변형본 연결만 허용한다', () => {
    const source = ensureWorksheetQuestionIds('<html><body><section class="question">1</section><section class="question">2</section></body></html>', 2);
    expect(source.questionIds).toEqual(['q1', 'q2']);
    expect(validateWorksheetVariantLinkage(source.html, '<html><body><section data-source-question-id="q1">A</section><section data-source-question-id="q2">B</section></body></html>')).toEqual([
      { sourceId: 'q1', targetId: 'q1' },
      { sourceId: 'q2', targetId: 'q2' },
    ]);
    expect(() => validateWorksheetVariantLinkage(source.html, '<html><body><section data-source-question-id="q1">A</section></body></html>')).toThrow('원본 문항 연결');
  });

  it('식별한 문항 수가 요청 수와 다르면 원본 연결 생성을 중단한다', () => {
    expect(() => ensureWorksheetQuestionIds('<html><body><section class="question">1</section></body></html>', 2)).toThrow('요청 2개');
  });
});

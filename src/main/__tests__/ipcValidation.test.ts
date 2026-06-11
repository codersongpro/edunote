import { describe, it, expect } from 'vitest';
import { validateGenerateArgs, validateMultipartArgs } from '../ipcValidation';

describe('validateGenerateArgs', () => {
  it('정상 프롬프트는 통과한다', () => {
    expect(() => validateGenerateArgs('학생 평어를 작성해줘', '시스템 지시', { temperature: 0.8 })).not.toThrow();
    expect(() => validateGenerateArgs('프롬프트만')).not.toThrow();
  });

  it('비어 있거나 문자열이 아닌 프롬프트는 거부한다', () => {
    expect(() => validateGenerateArgs('')).toThrow('비어');
    expect(() => validateGenerateArgs('   ')).toThrow('비어');
    expect(() => validateGenerateArgs(123)).toThrow('비어');
    expect(() => validateGenerateArgs(null)).toThrow('비어');
  });

  it('과도하게 긴 프롬프트는 거부한다', () => {
    expect(() => validateGenerateArgs('가'.repeat(1_500_001))).toThrow('너무');
  });

  it('잘못된 temperature는 거부한다', () => {
    expect(() => validateGenerateArgs('p', undefined, { temperature: -1 })).toThrow('temperature');
    expect(() => validateGenerateArgs('p', undefined, { temperature: 3 })).toThrow('temperature');
    expect(() => validateGenerateArgs('p', undefined, { temperature: NaN })).toThrow('temperature');
    expect(() => validateGenerateArgs('p', undefined, { temperature: '1' as unknown as number })).toThrow('temperature');
  });

  it('잘못된 시스템 지시문은 거부한다', () => {
    expect(() => validateGenerateArgs('p', 123 as unknown as string)).toThrow('지시문');
    expect(() => validateGenerateArgs('p', '가'.repeat(200_001))).toThrow('지시문');
  });
});

describe('validateMultipartArgs', () => {
  const inlinePart = { inlineData: { data: 'aGVsbG8=', mimeType: 'application/pdf' } };

  it('파일 10개 + 텍스트 1개(실사용 최대 배치)는 통과한다', () => {
    const parts = [...Array(10).fill(inlinePart), { text: '표로 정리해줘' }];
    expect(() => validateMultipartArgs(parts, '', { temperature: 0.8 })).not.toThrow();
  });

  it('빈 배열·배열이 아닌 값은 거부한다', () => {
    expect(() => validateMultipartArgs([])).toThrow('비어');
    expect(() => validateMultipartArgs('text')).toThrow('비어');
  });

  it('part 개수 초과는 거부한다', () => {
    expect(() => validateMultipartArgs(Array(17).fill(inlinePart))).toThrow('개수');
  });

  it('text도 inlineData도 없는 part는 거부한다', () => {
    expect(() => validateMultipartArgs([{}])).toThrow('형식');
    expect(() => validateMultipartArgs([null])).toThrow('형식');
  });

  it('잘못된 inlineData는 거부한다', () => {
    expect(() => validateMultipartArgs([{ inlineData: { data: '', mimeType: 'image/png' } }])).toThrow('첨부 파일');
    expect(() => validateMultipartArgs([{ inlineData: { data: 123, mimeType: 'image/png' } }])).toThrow('첨부 파일');
    expect(() => validateMultipartArgs([{ inlineData: { data: 'abc', mimeType: 'not-a-mime' } }])).toThrow('형식 정보');
    expect(() => validateMultipartArgs([{ inlineData: { data: 'abc', mimeType: '<script>' } }])).toThrow('형식 정보');
  });

  it('지나치게 큰 첨부는 거부한다', () => {
    const big = { inlineData: { data: 'a'.repeat(28_000_001), mimeType: 'application/pdf' } };
    expect(() => validateMultipartArgs([big])).toThrow('너무 큽니다');
  });
});

import { describe, it, expect } from 'vitest';
import { parseJsonArrayFromAiText } from '../aiJson';

describe('parseJsonArrayFromAiText', () => {
  it('코드펜스로 감싼 JSON 배열을 해석한다', () => {
    expect(parseJsonArrayFromAiText('```json\n[{"a":1}]\n```')).toEqual([{ a: 1 }]);
  });

  it('펜스 없는 JSON 배열을 해석한다', () => {
    expect(parseJsonArrayFromAiText('[1, 2, 3]')).toEqual([1, 2, 3]);
  });

  it('산문 속에 섞인 배열을 찾아 해석한다', () => {
    expect(parseJsonArrayFromAiText('다음과 같습니다.\n[{"항목":"연필"}]\n참고하세요.')).toEqual([{ 항목: '연필' }]);
  });

  it('잘린 JSON은 한국어 에러를 던진다', () => {
    expect(() => parseJsonArrayFromAiText('[{"a":1}, {"b"')).toThrow('AI 응답을 해석하지 못했습니다');
  });

  it('배열이 없는 산문 응답은 한국어 에러를 던진다', () => {
    expect(() => parseJsonArrayFromAiText('죄송합니다. 품목을 만들 수 없습니다.')).toThrow('AI 응답을 해석하지 못했습니다');
  });

  it('배열이 아닌 JSON(객체)은 형식 에러를 던진다', () => {
    expect(() => parseJsonArrayFromAiText('```json\n{"a":1}\n```')).toThrow('AI 응답 형식이 올바르지 않습니다');
  });
});

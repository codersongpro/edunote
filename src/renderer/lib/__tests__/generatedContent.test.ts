import { describe, it, expect } from 'vitest';
import { stripGeneratedCodeFences, markdownOrHtmlToHtml } from '../generatedContent';

describe('stripGeneratedCodeFences', () => {
  it('```html 코드펜스를 벗겨낸다', () => {
    expect(stripGeneratedCodeFences('```html\n<p>안녕</p>\n```')).toBe('<p>안녕</p>');
  });

  it('언어 표기 없는 코드펜스도 벗겨낸다', () => {
    expect(stripGeneratedCodeFences('```\n내용\n```')).toBe('내용');
  });

  it("''' 형태의 펜스도 벗겨낸다", () => {
    expect(stripGeneratedCodeFences("'''markdown\n# 제목\n'''")).toBe('# 제목');
  });

  it('펜스가 없는 일반 텍스트는 그대로 둔다(트림만)', () => {
    expect(stripGeneratedCodeFences('  그냥 텍스트  ')).toBe('그냥 텍스트');
  });

  it('null·undefined를 빈 문자열로 처리한다', () => {
    expect(stripGeneratedCodeFences(undefined as unknown as string)).toBe('');
  });
});

describe('markdownOrHtmlToHtml', () => {
  it('이미 HTML이면 태그를 보존한다', () => {
    const result = markdownOrHtmlToHtml('<p>안녕하세요</p>');
    expect(result).toContain('<p>안녕하세요</p>');
  });

  it('마크다운 굵게를 <strong>으로 변환한다', () => {
    const result = markdownOrHtmlToHtml('**굵게**');
    expect(result).toContain('<strong>굵게</strong>');
  });

  it('마크다운 제목을 헤딩 태그로 변환한다', () => {
    const result = markdownOrHtmlToHtml('# 제목');
    expect(result).toMatch(/<h1[^>]*>제목<\/h1>/);
  });

  it('HTML 안의 script를 제거(sanitize)한다', () => {
    const result = markdownOrHtmlToHtml('<p>본문</p><script>alert(1)</script>');
    expect(result).toContain('<p>본문</p>');
    expect(result).not.toContain('<script>');
  });

  it('코드펜스로 감싼 HTML도 처리한다', () => {
    const result = markdownOrHtmlToHtml('```html\n<table><tr><td>셀</td></tr></table>\n```');
    expect(result).toContain('<td>셀</td>');
  });
});

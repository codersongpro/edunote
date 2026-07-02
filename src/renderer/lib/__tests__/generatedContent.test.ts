import { describe, it, expect } from 'vitest';
import { extractPlainText, stripGeneratedCodeFences, markdownOrHtmlToHtml } from '../generatedContent';

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

  it('인라인 <br>이 섞인 마크다운도 마크다운으로 처리한다', () => {
    // 이전에는 <br> 하나 때문에 전체가 HTML로 오판되어 **굵게**가 그대로 노출됐다.
    const result = markdownOrHtmlToHtml('**중요**<br>다음 줄');
    expect(result).toContain('<strong>중요</strong>');
  });

  it('마크다운 리스트에 <span>이 있어도 리스트로 변환한다', () => {
    const result = markdownOrHtmlToHtml('- 첫째 <span>표시</span>\n- 둘째');
    expect(result).toMatch(/<li[^>]*>/);
  });
});

describe('extractPlainText', () => {
  it('HTML 태그를 제거하고 텍스트만 반환한다', () => {
    expect(extractPlainText('<p>안녕 <strong>세상</strong></p>')).toBe('안녕 세상');
  });

  it('onerror 같은 이벤트 속성이 있어도 안전하게 텍스트만 추출한다', () => {
    expect(extractPlainText('<img src=x onerror="window.__pwned=true">안녕')).toBe('안녕');
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
  });

  it('script 내용은 텍스트로 포함하지 않고 실행하지도 않는다', () => {
    expect(extractPlainText('<script>window.__pwned2=true</script>본문')).toBe('본문');
    expect((window as unknown as { __pwned2?: boolean }).__pwned2).toBeUndefined();
  });

  it('null·undefined를 빈 문자열로 처리한다', () => {
    expect(extractPlainText(undefined as unknown as string)).toBe('');
    expect(extractPlainText(null as unknown as string)).toBe('');
  });
});

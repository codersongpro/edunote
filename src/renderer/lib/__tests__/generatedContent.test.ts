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

  it('<!DOCTYPE html>로 시작하는 전체 문서는 본문에 번호 목록(1. ~)이 있어도 HTML로 처리한다', () => {
    // 이전에는 <!DOCTYPE의 '!' 때문에 HTML 시작 판별을 통과하지 못하고 마크다운으로 새어 나가,
    // 본문의 "1. 문제" 같은 번호 목록 텍스트 때문에 마크다운으로 오판되어
    // remark가 원시 HTML을 통째로 버리거나(빈 결과) 일부만 태그를 그대로 노출시켰다.
    const doc = [
      '<!DOCTYPE html>',
      '<html><head><title>워크시트</title></head><body>',
      '<table><tr><td>1. 문제 내용</td></tr></table>',
      '<p>2. 다음 문제</p>',
      '</body></html>',
    ].join('\n');
    const result = markdownOrHtmlToHtml(doc);
    expect(result).toContain('<table');
    expect(result).toContain('1. 문제 내용');
    expect(result).not.toContain('&lt;table');
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

  it('HTML 안에서 <br> 없이 줄바꿈 문자만으로 구분된 개조식 항목은 <br>로 보정한다', () => {
    // 계획서·보고서에서 AI가 가./나./다. 항목을 <br> 태그 없이 실제 줄바꿈 문자만으로
    // 구분해 보낼 때가 있었다. HWPX 저장은 원문 줄바꿈을 그대로 문단으로 나눠 정상 출력됐지만,
    // 브라우저 미리보기는 일반 HTML 흐름에서 줄바꿈을 한 칸으로 접어버려 모든 항목이 한 줄로
    // 붙어 보였다.
    const doc = [
      '<div>',
      '1. 추진배경',
      '가. 첫째 이유',
      '나. 둘째 이유',
      '2. 목적',
      '</div>',
    ].join('\n');
    const result = markdownOrHtmlToHtml(doc);
    expect(result).toContain('1. 추진배경<br>가. 첫째 이유<br>나. 둘째 이유<br>2. 목적');
  });

  it('표 태그 사이의 서식용 줄바꿈에는 <br>를 끼워 넣지 않는다', () => {
    const doc = '<table>\n<tr>\n<td>셀1</td>\n</tr>\n</table>';
    const result = markdownOrHtmlToHtml(doc);
    expect(result).not.toContain('<br>');
    expect(result).toContain('<td>셀1</td>');
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

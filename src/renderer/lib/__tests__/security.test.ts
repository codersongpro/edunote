import { describe, it, expect } from 'vitest';
import {
  isSafeHttpsUrl,
  sanitizeHtml,
  validateImportedTool,
  parseImportedTools,
} from '../security';

describe('isSafeHttpsUrl', () => {
  it('https URL은 허용한다', () => {
    expect(isSafeHttpsUrl('https://example.com')).toBe(true);
  });

  it('http·기타 프로토콜은 거부한다', () => {
    expect(isSafeHttpsUrl('http://example.com')).toBe(false);
    expect(isSafeHttpsUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeHttpsUrl('ftp://example.com')).toBe(false);
  });

  it('URL이 아닌 문자열은 거부한다', () => {
    expect(isSafeHttpsUrl('그냥 텍스트')).toBe(false);
    expect(isSafeHttpsUrl('')).toBe(false);
  });
});

describe('sanitizeHtml', () => {
  it('일반 태그는 보존한다', () => {
    expect(sanitizeHtml('<p>안녕하세요</p>')).toBe('<p>안녕하세요</p>');
  });

  it('script 태그를 제거한다', () => {
    const result = sanitizeHtml('<script>alert(1)</script><p>안전</p>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('<p>안전</p>');
  });

  it('on* 이벤트 핸들러 속성을 제거한다', () => {
    const result = sanitizeHtml('<p onclick="steal()">텍스트</p>');
    expect(result).not.toContain('onclick');
    expect(result).toContain('텍스트');
  });

  it('javascript: 링크를 제거한다', () => {
    const result = sanitizeHtml('<a href="javascript:alert(1)">링크</a>');
    expect(result.toLowerCase()).not.toContain('javascript:');
  });

  it('iframe을 제거한다', () => {
    const result = sanitizeHtml('<iframe src="https://evil.test"></iframe><p>본문</p>');
    expect(result).not.toContain('<iframe');
    expect(result).toContain('<p>본문</p>');
  });
});

// validateImportedTool가 통과시키는 최소 유효 도구
const validTool = {
  name: '요약 도구',
  description: '문서를 요약합니다.',
  category: 'admin',
  inputs: [
    { id: 'text', label: '원문', type: 'textarea', required: true },
  ],
  promptTemplate: '{text} 를 요약해줘',
};

describe('validateImportedTool', () => {
  it('유효한 프롬프트 도구를 통과시킨다', () => {
    const result = validateImportedTool(validTool);
    expect(result.ok).toBe(true);
  });

  it('이름이 없으면 거부한다', () => {
    const result = validateImportedTool({ ...validTool, name: '' });
    expect(result.ok).toBe(false);
  });

  it('잘못된 분류는 거부한다', () => {
    const result = validateImportedTool({ ...validTool, category: 'hacker' });
    expect(result.ok).toBe(false);
  });

  it('입력 항목 형식이 틀리면 거부한다', () => {
    const result = validateImportedTool({
      ...validTool,
      inputs: [{ id: 'x', label: 'y', type: 'select' }],
    });
    expect(result.ok).toBe(false);
  });

  it('객체가 아니면 거부한다', () => {
    expect(validateImportedTool(null).ok).toBe(false);
    expect(validateImportedTool('문자열').ok).toBe(false);
  });

  it('html-app 도구에서 위험한 HTML 요소를 거부한다', () => {
    const result = validateImportedTool({
      ...validTool,
      toolType: 'html-app',
      htmlContent: '<object data="x"></object>',
    });
    expect(result.ok).toBe(false);
  });

  it('정상 html-app 도구는 통과시킨다', () => {
    const result = validateImportedTool({
      ...validTool,
      toolType: 'html-app',
      htmlContent: '<div><h1>게임</h1><button>시작</button></div>',
    });
    expect(result.ok).toBe(true);
  });
});

describe('parseImportedTools', () => {
  it('단일 도구 JSON을 배열로 반환한다', () => {
    const result = parseImportedTools(JSON.stringify(validTool));
    expect(result.error).toBeUndefined();
    expect(result.tools).toHaveLength(1);
  });

  it('도구 배열 JSON을 그대로 반환한다', () => {
    const result = parseImportedTools(JSON.stringify([validTool, validTool]));
    expect(result.tools).toHaveLength(2);
  });

  it('잘못된 JSON은 오류를 반환한다', () => {
    const result = parseImportedTools('{ 깨진 json');
    expect(result.tools).toHaveLength(0);
    expect(result.error).toBeTruthy();
  });

  it('하나라도 유효하지 않으면 전체를 거부한다', () => {
    const result = parseImportedTools(JSON.stringify([validTool, { ...validTool, name: '' }]));
    expect(result.tools).toHaveLength(0);
    expect(result.error).toBeTruthy();
  });
});

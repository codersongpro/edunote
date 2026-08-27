import { describe, expect, it } from 'vitest';
import {
  OUTLINE_LEVEL_STYLES,
  applyOutlineStyles,
  detectOutlineLevel,
} from '../outlineFormat';

const parse = (html: string): Document => new DOMParser().parseFromString(html, 'text/html');

const lineOf = (html: string, level: number): HTMLElement | null =>
  parse(html).querySelector<HTMLElement>(`[data-outline-level="${level}"]`);

describe('말머리 단계 판별', () => {
  it('네 단계 말머리를 각각 알아본다', () => {
    expect(detectOutlineLevel('1. 개인정보 처리의 기본 원칙')).toBe(1);
    expect(detectOutlineLevel('가. 최소 수집 원칙 준수')).toBe(2);
    expect(detectOutlineLevel('1) 수집 항목 사전 안내')).toBe(3);
    expect(detectOutlineLevel('가) 동의서 보관 기간 확인')).toBe(4);
  });

  it('앞에 공백이나 &nbsp;가 있어도 같은 단계로 본다', () => {
    expect(detectOutlineLevel('  가. 최소 수집 원칙 준수')).toBe(2);
    expect(detectOutlineLevel('    1) 수집 항목 사전 안내')).toBe(3);
  });

  it('말머리가 없는 문장은 단계로 보지 않는다', () => {
    expect(detectOutlineLevel('교직원 개인정보보호 연수')).toBeNull();
    // 연도로 시작하는 날짜 표기를 대항목으로 오인하지 않는다.
    expect(detectOutlineLevel('2026. 3. 2. 시행')).toBeNull();
    expect(detectOutlineLevel('')).toBeNull();
  });
});

describe('말머리 서식 보정', () => {
  it('한 문단 안의 각 단계에 서로 다른 들여쓰기와 글자 크기를 넣는다', () => {
    const result = applyOutlineStyles(
      '<div>1. 개인정보 처리의 기본 원칙<br>가. 최소 수집 원칙 준수<br>1) 수집 항목 사전 안내<br>가) 동의서 보관 기간 확인</div>',
    );

    ([1, 2, 3, 4] as const).forEach(level => {
      const line = lineOf(result, level);
      expect(line?.style.paddingLeft).toBe(OUTLINE_LEVEL_STYLES[level].indent);
      expect(line?.style.fontSize).toBe(OUTLINE_LEVEL_STYLES[level].fontSize);
    });
    expect(lineOf(result, 1)?.style.fontWeight).toBe('bold');
    expect(lineOf(result, 2)?.style.fontWeight).toBe('');
  });

  it('AI가 &nbsp;로 넣은 들여쓰기는 지워서 중복 들여쓰기를 막는다', () => {
    const result = applyOutlineStyles('<div>  가. 최소 수집 원칙 준수</div>');

    expect(lineOf(result, 2)?.textContent).toBe('가. 최소 수집 원칙 준수');
  });

  it('말머리가 없는 줄은 그대로 둔다', () => {
    const result = applyOutlineStyles('<div>교직원이 알아야 할 기본 사항<br>가. 최소 수집 원칙 준수</div>');

    expect(parse(result).querySelectorAll('[data-outline-level]')).toHaveLength(1);
    expect(parse(result).body.textContent).toContain('교직원이 알아야 할 기본 사항');
  });

  it('제목 태그에 글자 크기가 없으면 계획서와 같은 크기를 넣는다', () => {
    const result = applyOutlineStyles('<h1>교직원 개인정보보호 연수</h1><h2>1. 기본 원칙</h2>');
    const doc = parse(result);

    expect(doc.querySelector<HTMLElement>('h1')?.style.fontSize).toBe('22pt');
    expect(doc.querySelector<HTMLElement>('h2')?.style.fontSize).toBe('16pt');
    expect(doc.querySelector<HTMLElement>('h2')?.style.fontWeight).toBe('bold');
  });

  it('AI가 직접 넣은 제목 글자 크기는 바꾸지 않는다', () => {
    const result = applyOutlineStyles('<h1 style="font-size:26pt;">교직원 개인정보보호 연수</h1>');

    expect(parse(result).querySelector<HTMLElement>('h1')?.style.fontSize).toBe('26pt');
  });

  it('표 안의 내용은 건드리지 않는다', () => {
    const result = applyOutlineStyles('<table><tbody><tr><td><div>가. 최소 수집 원칙 준수</div></td></tr></tbody></table>');

    expect(parse(result).querySelectorAll('[data-outline-level]')).toHaveLength(0);
  });

  it('이미 서식이 들어간 문서를 다시 처리해도 중복해서 감싸지 않는다', () => {
    const once = applyOutlineStyles('<div>가. 최소 수집 원칙 준수</div>');
    const twice = applyOutlineStyles(once);

    expect(parse(twice).querySelectorAll('[data-outline-level]')).toHaveLength(1);
  });

  it('전체 HTML 문서로 와도 본문 서식만 보정한다', () => {
    const result = applyOutlineStyles(
      '<!DOCTYPE html><html><head><title>Document</title></head><body><div>가. 최소 수집 원칙 준수</div></body></html>',
    );

    expect(lineOf(result, 2)?.style.paddingLeft).toBe(OUTLINE_LEVEL_STYLES[2].indent);
    expect(result).not.toContain('<div data-outline-root>');
  });

  it('빈 문자열은 그대로 돌려준다', () => {
    expect(applyOutlineStyles('')).toBe('');
  });
});

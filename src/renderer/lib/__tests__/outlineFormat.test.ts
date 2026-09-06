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
    expect(detectOutlineLevel('1.5배 증가')).toBeNull();
    expect(detectOutlineLevel('3.14를 반올림')).toBeNull();
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
      expect(line?.style.marginLeft).toBe(OUTLINE_LEVEL_STYLES[level].indent);
      expect(line?.style.fontSize).toBe(OUTLINE_LEVEL_STYLES[level].fontSize);
      expect(line?.style.paddingLeft).not.toBe('');
      expect(line?.style.textIndent).toMatch(/^-/);
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
    expect(twice).toBe(once);
  });

  it('기존 부모 여백 대신 정규화 요소 하나만 단계 들여쓰기를 책임진다', () => {
    const result = applyOutlineStyles(
      '<h2 style="font-size:16pt">1. 운영 방법</h2>'
      + '<div style="margin-left:14px">가. 대상별 안내</div>'
      + '<div style="margin-left:30px">1) 안내 자료 확인</div>'
      + '<div style="margin-left:46px">가) 제출 항목 점검</div>',
    );
    const doc = parse(result);

    ([2, 3, 4] as const).forEach(level => {
      const line = doc.querySelector<HTMLElement>(`[data-outline-level="${level}"]`);
      expect(line?.style.marginLeft).toBe(OUTLINE_LEVEL_STYLES[level].indent);
      expect(line?.parentElement?.style.marginLeft).toBe('');
      expect(line?.parentElement?.style.paddingLeft).toBe('');
    });
  });

  it('긴 항목은 내어쓰기로 둘째 줄을 항목 본문 시작점에 맞춘다', () => {
    const result = applyOutlineStyles('<div>가. 대상별 안내 자료를 충분히 길게 작성하여 다음 줄로 넘어가는 항목</div>');
    const line = lineOf(result, 2);

    expect(line?.style.display).toBe('block');
    expect(line?.style.paddingLeft).toBe('2.2em');
    expect(line?.style.textIndent).toBe('-2.2em');
  });

  it('이미 data-outline-level이 있는 항목은 중첩 래퍼 없이 정규화한다', () => {
    const result = applyOutlineStyles('<div data-outline-level="2" style="margin-left:14px;font-size:13pt;">가. 안내</div>');
    const doc = parse(result);
    const line = doc.querySelector<HTMLElement>('[data-outline-level="2"]');

    expect(doc.querySelectorAll('[data-outline-level="2"]')).toHaveLength(1);
    expect(line?.style.marginLeft).toBe('14px');
    expect(line?.style.paddingLeft).toBe('2.2em');
  });

  it('강조 태그로 시작하는 항목과 표 앞의 직접 본문을 빠뜨리지 않는다', () => {
    const result = applyOutlineStyles(
      '<div><strong>가. 강조된 안내</strong></div>'
      + '<div>1. 표 앞 본문<table><tbody><tr><td>1.5배 증가</td></tr></tbody></table></div>',
    );
    const doc = parse(result);

    expect(doc.querySelectorAll('[data-outline-level="2"]')).toHaveLength(1);
    expect(doc.querySelectorAll('[data-outline-level="1"]')).toHaveLength(1);
    expect(doc.querySelector('strong')?.textContent).toBe('가. 강조된 안내');
    expect(doc.querySelector('td [data-outline-level]')).toBeNull();
  });

  it('전체 HTML 문서로 와도 본문 서식만 보정한다', () => {
    const result = applyOutlineStyles(
      '<!DOCTYPE html><html><head><title>Document</title></head><body><div>가. 최소 수집 원칙 준수</div></body></html>',
    );

    expect(lineOf(result, 2)?.style.marginLeft).toBe(OUTLINE_LEVEL_STYLES[2].indent);
    expect(result).not.toContain('<div data-outline-root>');
  });

  it('빈 문자열은 그대로 돌려준다', () => {
    expect(applyOutlineStyles('')).toBe('');
  });
});

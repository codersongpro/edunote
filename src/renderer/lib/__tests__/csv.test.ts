import { describe, it, expect } from 'vitest';
import { toCsv } from '../csv';

describe('toCsv', () => {
  it('모든 셀을 큰따옴표로 감싼다', () => {
    expect(toCsv([['학생명', '의견']])).toBe('"학생명","의견"');
  });

  it('쉼표가 든 값이 한 셀로 유지된다', () => {
    // 감싸지 않으면 "협동심, 배려심"이 두 칸으로 쪼개져 이후 열이 전부 밀린다.
    const csv = toCsv([['홍길동', '협동심, 배려심']]);
    expect(csv).toBe('"홍길동","협동심, 배려심"');
  });

  it('값 안의 큰따옴표를 두 번 반복해 이스케이프한다', () => {
    expect(toCsv([['그는 "성실"하다']])).toBe('"그는 ""성실""하다"');
  });

  it('줄바꿈이 든 값도 따옴표 안에 그대로 담는다', () => {
    expect(toCsv([['첫 줄\n둘째 줄']])).toBe('"첫 줄\n둘째 줄"');
  });

  it('빈 문자열·undefined·null을 빈 셀로 만든다', () => {
    expect(toCsv([['', undefined, null]])).toBe('"","",""');
  });

  it('숫자를 문자열로 바꿔 담는다', () => {
    expect(toCsv([[0, 1500]])).toBe('"0","1500"');
  });

  it('행을 줄바꿈으로 잇는다', () => {
    expect(toCsv([['a', 'b'], ['c', 'd']])).toBe('"a","b"\n"c","d"');
  });

  it('BOM을 붙이지 않는다 (메인 프로세스가 저장 시 한 번만 붙인다)', () => {
    expect(toCsv([['학생명']]).startsWith('﻿')).toBe(false);
  });

  it('빈 행 목록은 빈 문자열이 된다', () => {
    expect(toCsv([])).toBe('');
  });
});

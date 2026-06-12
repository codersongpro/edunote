import { describe, it, expect } from 'vitest';
import {
  MAX_STREAM_CHARS,
  RetryableStreamError,
  isDegenerateStream,
  isRetryableStreamError,
} from '../streamGuard';

// 실제 비정상 출력에서 관찰된 빈 문단 마크업 (보이는 글자 없음)
const EMPTY_PARAGRAPH =
  '<p style="margin-top:0pt; margin-bottom:0pt; font-size:12pt;">' +
  '<span style="font-family:\'Dotum\';"></span></p>\n';

// 정상 문서 문단 (본문 텍스트 포함)
const NORMAL_PARAGRAPH =
  '<p style="margin:0 0 8pt;">2026학년도 학교폭력예방교육을 다음과 같이 실시하고자 합니다.</p>\n';

describe('isDegenerateStream', () => {
  it('누적 길이가 짧으면 판단하지 않는다', () => {
    expect(isDegenerateStream(EMPTY_PARAGRAPH.repeat(10))).toBe(false);
  });

  it('본문 텍스트가 이어지는 정상 문서는 통과시킨다', () => {
    expect(isDegenerateStream(NORMAL_PARAGRAPH.repeat(120))).toBe(false);
  });

  it('정상 본문 뒤라도 꼬리가 빈 마크업 반복이면 감지한다', () => {
    const output = NORMAL_PARAGRAPH.repeat(30) + EMPTY_PARAGRAPH.repeat(60);
    expect(isDegenerateStream(output)).toBe(true);
  });

  it('빈 마크업만 길게 반복되면 감지한다', () => {
    expect(isDegenerateStream(EMPTY_PARAGRAPH.repeat(100))).toBe(true);
  });

  it('표 등 마크업이 많아도 셀에 텍스트가 있으면 통과시킨다', () => {
    const row = '<tr><td style="border:1pt solid #333;">국어</td><td>월요일 1교시</td></tr>\n';
    const table = `<table>${row.repeat(150)}</table>`;
    expect(isDegenerateStream(table)).toBe(false);
  });

  it('전체 길이 상한을 넘으면 내용과 무관하게 감지한다', () => {
    expect(isDegenerateStream(NORMAL_PARAGRAPH.repeat(Math.ceil(MAX_STREAM_CHARS / NORMAL_PARAGRAPH.length) + 1))).toBe(true);
  });
});

describe('isRetryableStreamError', () => {
  it('RetryableStreamError를 폴백 대상으로 인식한다', () => {
    expect(isRetryableStreamError(new RetryableStreamError('반복 출력'))).toBe(true);
  });

  it('일반 오류는 폴백 대상이 아니다', () => {
    expect(isRetryableStreamError(new Error('network error'))).toBe(false);
    expect(isRetryableStreamError(null)).toBe(false);
  });
});

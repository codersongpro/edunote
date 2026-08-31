import { describe, it, expect } from 'vitest';
import { isPngDataUrl } from '../clipboardImage';

// 1x1 투명 PNG
const VALID = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('isPngDataUrl', () => {
  it('PNG data URL을 통과시킨다', () => {
    expect(isPngDataUrl(VALID)).toBe(true);
  });

  it('패딩 없는 base64도 통과시킨다', () => {
    expect(isPngDataUrl('data:image/png;base64,iVBORw0KGgo')).toBe(true);
  });

  it('PNG가 아닌 이미지 형식은 거부한다', () => {
    expect(isPngDataUrl('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).toBe(false);
    expect(isPngDataUrl('data:image/jpeg;base64,/9j/4AAQ')).toBe(false);
  });

  it('data URL이 아닌 값은 거부한다', () => {
    expect(isPngDataUrl('https://example.com/qr.png')).toBe(false);
    expect(isPngDataUrl('file:///tmp/qr.png')).toBe(false);
    expect(isPngDataUrl('javascript:alert(1)')).toBe(false);
  });

  it('base64가 아닌 문자가 섞이면 거부한다', () => {
    expect(isPngDataUrl('data:image/png;base64,<script>')).toBe(false);
    expect(isPngDataUrl('data:image/png;base64,aa bb')).toBe(false);
  });

  it('본문이 비어 있으면 거부한다', () => {
    expect(isPngDataUrl('data:image/png;base64,')).toBe(false);
  });

  it('문자열이 아닌 값은 거부한다', () => {
    expect(isPngDataUrl(undefined)).toBe(false);
    expect(isPngDataUrl(null)).toBe(false);
    expect(isPngDataUrl(123)).toBe(false);
    expect(isPngDataUrl({})).toBe(false);
  });
});

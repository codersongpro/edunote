import { describe, expect, it } from 'vitest';
import { FinishReason, type GenerateContentResponse } from '@google/genai';
import { assertGenerationResponseAccepted, validateGeneratedResponse } from '../generationResponseValidation';

const response = (value: Partial<GenerateContentResponse>): GenerateContentResponse => value as GenerateContentResponse;

describe('validateGeneratedResponse', () => {
  it.each(['일반 응답', '파일 분석 응답'])('정상 텍스트를 허용한다: %s', (text) => {
    expect(validateGeneratedResponse(response({
      text,
      candidates: [{ finishReason: FinishReason.STOP }],
    }), text)).toBe(text);
  });

  it('후보가 없거나 텍스트가 공백뿐이면 실패한다', () => {
    expect(() => validateGeneratedResponse(response({ candidates: [] }), '')).toThrow(/빈 응답/);
    expect(() => validateGeneratedResponse(response({ text: '   ' }), '   ')).toThrow(/빈 응답/);
  });

  it('프롬프트 차단 응답을 안전 안내로 거부한다', () => {
    expect(() => validateGeneratedResponse(response({
      promptFeedback: { blockReason: 'SAFETY' as never },
    }), '')).toThrow(/안전 정책/);
  });

  it('안전 사유로 끝난 후보의 일부 텍스트도 거부한다', () => {
    expect(() => validateGeneratedResponse(response({
      candidates: [{ finishReason: FinishReason.SAFETY }],
    }), '일부 결과')).toThrow(/안전 정책/);
  });

  it('MAX_TOKENS로 잘린 일부 텍스트를 완료 결과로 인정하지 않는다', () => {
    expect(() => validateGeneratedResponse(response({
      candidates: [{ finishReason: FinishReason.MAX_TOKENS }],
    }), '끝나지 않은 결과')).toThrow(/출력 한도/);
  });

  it('그 밖의 비정상 종료도 완료 결과로 인정하지 않는다', () => {
    expect(() => validateGeneratedResponse(response({
      candidates: [{ finishReason: FinishReason.OTHER }],
    }), '일부 결과')).toThrow(/완료되지/);
  });
});

describe('assertGenerationResponseAccepted', () => {
  it('스트림의 마지막 메타데이터 전용 청크에서도 MAX_TOKENS를 감지한다', () => {
    const metadataOnly = response({ candidates: [{ finishReason: FinishReason.MAX_TOKENS }] });
    expect(() => assertGenerationResponseAccepted(metadataOnly)).toThrow(/출력 한도/);
  });

  it('중간 청크처럼 종료 사유가 없는 응답은 통과시킨다', () => {
    expect(() => assertGenerationResponseAccepted(response({ text: '' }))).not.toThrow();
  });
});

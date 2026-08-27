import { describe, expect, it } from 'vitest';
import { describeOpenApiError, parseOpenApiBody } from '../openApiError';

describe('공공데이터포털 오류 응답 해석', () => {
  it('정상 JSON 응답은 오류로 보지 않는다', () => {
    const body = JSON.stringify({
      response: { header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' }, body: { items: [] } },
    });

    expect(describeOpenApiError(body)).toBeNull();
  });

  it('인증키 미등록 XML 응답에서 조치 안내를 만든다', () => {
    // 인증 오류일 때는 type=json을 요청해도 HTTP 200에 이 XML이 온다.
    const body = `<?xml version="1.0"?><OpenAPI_ServiceResponse><cmmMsgHeader>`
      + `<returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg>`
      + `<returnReasonCode>30</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>`;

    const reason = describeOpenApiError(body);

    expect(reason).toContain('SERVICE_KEY_IS_NOT_REGISTERED_ERROR');
    expect(reason).toContain('일반 인증키를 다시 복사해 저장');
  });

  it('요청 횟수 초과는 사용량 안내로 바꾼다', () => {
    const body = `<OpenAPI_ServiceResponse><cmmMsgHeader>`
      + `<returnAuthMsg>LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR</returnAuthMsg>`
      + `<returnReasonCode>22</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>`;

    expect(describeOpenApiError(body)).toContain('요청 횟수를 모두 썼습니다');
  });

  it('활용신청 미승인은 신청 상태 확인을 안내한다', () => {
    const body = '<response><header><resultCode>20</resultCode><resultMsg>SERVICE_ACCESS_DENIED_ERROR</resultMsg></header></response>';

    expect(describeOpenApiError(body)).toContain('활용신청');
  });

  it('오류 코드가 담긴 JSON 헤더도 오류로 본다', () => {
    const body = JSON.stringify({
      response: { header: { resultCode: '30', resultMsg: 'SERVICE KEY IS NOT REGISTERED ERROR' } },
    });

    expect(describeOpenApiError(body)).toContain('일반 인증키를 다시 복사해 저장');
  });

  it('빈 응답과 알 수 없는 형식도 사유를 남긴다', () => {
    expect(describeOpenApiError('')).toBe('응답이 비어 있습니다.');
    expect(describeOpenApiError('알 수 없는 텍스트')).toBe('응답 형식을 알 수 없습니다.');
  });

  it('CDATA로 감싼 메시지도 읽는다', () => {
    const body = '<response><header><resultCode>30</resultCode><resultMsg><![CDATA[등록되지 않은 서비스키]]></resultMsg></header></response>';

    expect(describeOpenApiError(body)).toContain('등록되지 않은 서비스키');
  });
});

describe('본문 파싱', () => {
  it('정상 응답은 객체로 돌려준다', () => {
    const body = JSON.stringify({
      response: { header: { resultCode: '00' }, body: { items: { item: [{ prdctIdntNoNm: '복사용지' }] } } },
    });

    expect(parseOpenApiBody(body)).toMatchObject({
      response: { body: { items: { item: [{ prdctIdntNoNm: '복사용지' }] } } },
    });
  });

  it('오류 응답은 사유를 담아 예외를 던진다', () => {
    const body = '<OpenAPI_ServiceResponse><cmmMsgHeader><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg><returnReasonCode>30</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>';

    expect(() => parseOpenApiBody(body)).toThrowError(/SERVICE_KEY_IS_NOT_REGISTERED_ERROR/);
  });
});

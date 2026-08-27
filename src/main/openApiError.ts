// 공공데이터포털(data.go.kr) OpenAPI는 인증 오류·필수값 누락·트래픽 초과일 때
// type=json을 요청해도 HTTP 200에 XML 오류 본문을 돌려주는 경우가 많다.
// 이를 그대로 response.json()에 넣으면 파싱 예외만 남아, 호출부에서는
// "결과 0건"과 "키가 잘못됨"을 구분할 수 없게 된다.
// 여기서 오류 본문을 먼저 알아보고 사람이 읽을 수 있는 이유로 바꿔 준다.

// 포털이 돌려주는 대표 오류 코드에 대한 조치 안내.
const ERROR_HINTS: Array<{ match: RegExp; hint: string }> = [
  {
    match: /SERVICE_KEY_IS_NOT_REGISTERED|SERVICE KEY IS NOT REGISTERED|등록되지\s*않은\s*(서비스|인증)/i,
    hint: '등록되지 않은 인증키입니다. 공공데이터포털 마이페이지의 일반 인증키를 다시 복사해 저장해주세요.',
  },
  {
    match: /LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS|요청횟수|트래픽/i,
    hint: '오늘 사용할 수 있는 요청 횟수를 모두 썼습니다. 내일 다시 시도하거나 공공데이터포털에서 운영계정으로 전환 신청해주세요.',
  },
  {
    match: /SERVICE_ACCESS_DENIED|접근\s*거부|권한/i,
    hint: '이 서비스에 대한 활용신청이 승인되지 않았습니다. 공공데이터포털에서 종합쇼핑몰 품목정보 서비스 활용신청 상태를 확인해주세요.',
  },
  {
    match: /NO_OPENAPI_SERVICE_ERROR|HTTP\s*ROUTING\s*ERROR|해당\s*오픈API서비스가\s*없거나/i,
    hint: '요청한 서비스 주소를 찾지 못했습니다. 활용신청한 서비스가 맞는지 확인이 필요합니다.',
  },
  {
    match: /DEADLINE_HAS_EXPIRED|기한만료|활용기간/i,
    hint: '인증키 활용 기간이 만료되었습니다. 공공데이터포털에서 연장 신청해주세요.',
  },
  {
    match: /INVALID_REQUEST_PARAMETER|필수요청파라메터|파라미터/i,
    hint: '요청 항목이 올바르지 않습니다. 검색어를 바꿔 다시 시도해주세요.',
  },
  {
    // 인증은 통과했지만 게이트웨이가 요청을 처리하지 못한 경우. 오퍼레이션 이름이나
    // 필수 요청변수가 서비스 명세와 맞지 않을 때 주로 나온다.
    match: /HTTP[\s_]*(에러|ERROR)/i,
    hint: '인증키 문제가 아니라 요청 주소나 요청 항목이 서비스 명세와 맞지 않습니다. 서비스 참고문서의 오퍼레이션 이름과 필수 요청변수를 확인해야 합니다.',
  },
];

// 포털은 응답 봉투를 한 가지로 고정하지 않는다. 정상 응답은 response.header 아래에,
// 인증 오류는 OpenAPI_ServiceResponse.cmmMsgHeader 아래에 담겨 오고, 같은 오류가
// XML로 올 때도 JSON으로 올 때도 있다. 그래서 봉투 모양을 가정하지 않고 필드 이름으로 찾는다.
const CODE_FIELDS = ['returnReasonCode', 'resultCode', 'errorCode'];
const MESSAGE_FIELDS = ['returnAuthMsg', 'errMsg', 'resultMsg', 'errorMessage', 'errorMsg'];

const MAX_SEARCH_DEPTH = 6;

function findField(value: unknown, names: string[], depth = 0): string {
  if (depth > MAX_SEARCH_DEPTH || !value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  for (const name of names) {
    const found = record[name];
    if (typeof found === 'string' && found.trim()) return found.trim();
    if (typeof found === 'number') return String(found);
  }
  for (const nested of Object.values(record)) {
    const found = findField(nested, names, depth + 1);
    if (found) return found;
  }
  return '';
}

function pickTag(text: string, tag: string): string {
  const matched = text.match(new RegExp(`<${tag}>\\s*(?:<!\\[CDATA\\[)?\\s*([^<\\]]*)`, 'i'));
  return matched?.[1]?.trim() ?? '';
}

function pickAnyTag(text: string, tags: string[]): string {
  for (const tag of tags) {
    const found = pickTag(text, tag);
    if (found) return found;
  }
  return '';
}

function describeCodeAndMessage(code: string, message: string): string {
  const combined = `${code} ${message}`.trim();
  const hint = ERROR_HINTS.find(entry => entry.match.test(combined))?.hint;
  const label = message || code || '알 수 없는 오류';
  // 안내 문구로 덮이지 않는 오류도 원인을 좁힐 수 있도록 포털이 준 코드를 함께 남긴다.
  const prefix = code && message ? `[${code}] ` : '';
  return hint ? `${prefix}${label} — ${hint}` : `${prefix}${label}`;
}

// 응답 본문이 오류면 사람이 읽을 수 있는 사유를, 정상이면 null을 돌려준다.
export function describeOpenApiError(bodyText: string): string | null {
  const text = String(bodyText ?? '');
  if (!text.trim()) return '응답이 비어 있습니다.';

  const trimmed = text.trim();

  // JSON 정상/오류 응답
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return '응답을 해석하지 못했습니다.';
    }
    const code = findField(parsed, CODE_FIELDS);
    const message = findField(parsed, MESSAGE_FIELDS);
    // 오류 표시가 전혀 없으면 정상 응답으로 본다.
    if (!code && !message) return null;
    if (code === '00' || code === '0') return null;
    return describeCodeAndMessage(code, message);
  }

  // XML 오류 응답(인증 오류일 때 type=json이어도 이 형태로 오는 경우가 있다)
  if (trimmed.startsWith('<')) {
    const code = pickAnyTag(text, CODE_FIELDS);
    const message = pickAnyTag(text, MESSAGE_FIELDS);
    if (!code && !message) return '응답 형식을 알 수 없습니다.';
    if (code === '00' || code === '0') return null;
    return describeCodeAndMessage(code, message);
  }

  return '응답 형식을 알 수 없습니다.';
}

// 응답 본문을 JSON으로 읽되, 오류 본문이면 사유를 담아 예외를 던진다.
export function parseOpenApiBody(bodyText: string): unknown {
  const reason = describeOpenApiError(bodyText);
  if (reason) throw new Error(reason);
  const trimmed = String(bodyText).trim();
  // 오류는 아닌데 XML로 왔다면 type=json이 먹지 않은 것이다. JSON.parse의 영어 예외
  // 대신 무엇이 잘못됐는지 그대로 알려, 다음 확인에서 원인을 좁힐 수 있게 한다.
  if (trimmed.startsWith('<')) {
    throw new Error('서비스가 JSON이 아닌 XML로 응답했습니다. 응답 형식 요청 항목(type)이 이 서비스에 맞지 않습니다.');
  }
  return JSON.parse(trimmed);
}

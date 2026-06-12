// 스트리밍 생성 중 비정상 출력을 감지하는 순수 로직 (테스트 가능하도록 SDK 의존 없이 분리).
//
// 모델이 글자 없는 빈 문단 마크업(<p ...><span ...></span></p>)만 끝없이
// 반복하는 경우가 있다. 이때는 API 오류가 발생하지 않아 폴백 체인이 동작하지
// 않고 생성이 영원히 끝나지 않으므로, 출력 내용을 보고 직접 감지해 중단한다.

// 전체 출력 상한 — A4 수 장 분량의 HTML도 이보다 훨씬 작다.
export const MAX_STREAM_CHARS = 400_000;

// 꼬리부 검사 크기와 검사를 시작할 최소 누적 길이.
// 정상 문서는 어떤 3,000자 구간에도 보이는 글자(본문 텍스트)가 들어 있다.
const TAIL_WINDOW = 3_000;
const MIN_LENGTH_BEFORE_CHECK = 8_000;
const MIN_VISIBLE_CHARS = 10;

// 같은 모델 재시도가 무의미하고 다음 모델로 폴백해야 하는 스트리밍 오류.
// 모델 체인은 retryWithNextModel 플래그를 보고 다음 모델로 넘어간다.
export class RetryableStreamError extends Error {
  readonly retryWithNextModel = true;
}

export function isRetryableStreamError(error: unknown): boolean {
  return (error as { retryWithNextModel?: boolean })?.retryWithNextModel === true;
}

// 누적 출력이 비정상 반복 상태인지 판단한다.
// 꼬리 3,000자에서 태그·공백·&nbsp;를 걷어냈을 때 보이는 글자가 거의 없으면
// 빈 마크업만 반복 생성 중인 것으로 본다.
export function isDegenerateStream(accumulated: string): boolean {
  if (accumulated.length > MAX_STREAM_CHARS) return true;
  if (accumulated.length < MIN_LENGTH_BEFORE_CHECK) return false;
  // 창이 태그 중간에서 잘리면 태그 잔여 문자열이 글자로 계산되므로 첫 < 앞은 버린다.
  const tail = accumulated.slice(-TAIL_WINDOW);
  const firstTag = tail.indexOf('<');
  const visible = (firstTag === -1 ? tail : tail.slice(firstTag))
    .replace(/<[^>]*>/g, '')
    .replace(/&(nbsp|#160);/gi, '')
    .replace(/\s+/g, '');
  return visible.length < MIN_VISIBLE_CHARS;
}

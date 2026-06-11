// AI 생성 실패 원인을 구분해 사용자가 바로 조치할 수 있는 한국어 안내문을 만든다.
// 메인 프로세스(GeminiService·ipcHandlers)가 던지는 실제 메시지 패턴을 기준으로 분류한다.

export const isTemporaryApiError = (error: unknown): boolean => {
  const message = String((error as any)?.message || error || '').toLowerCase();
  return [
    'quota',
    '429',
    'resource_exhausted',
    'rate limit',
    'too many requests',
    '잠시 기다리',
    '토큰 소모',
    '잦은 요청',
    '사용 가능한 모델이 없습니다',
  ].some(pattern => message.includes(pattern));
};

export function describeGenerationError(error: unknown): string {
  const raw = String((error as any)?.message || error || '');
  const message = raw.toLowerCase();

  if (raw.includes('API 키가 설정되지 않았습니다')) {
    return '⚠️ [API 키 없음] Gemini API 키가 설정되지 않았습니다. 설정 화면에서 API 키를 먼저 입력해주세요.';
  }
  if (
    message.includes('api key not valid') ||
    message.includes('api_key_invalid') ||
    message.includes('invalid api key') ||
    message.includes('401') ||
    message.includes('403') ||
    message.includes('permission denied') ||
    message.includes('unauthenticated')
  ) {
    return '⚠️ [API 키 오류] Gemini API 키가 유효하지 않습니다. 설정 화면에서 키를 다시 확인해주세요.';
  }
  if (isTemporaryApiError(error)) {
    return '⚠️ [사용량 알림] 현재 AI 생성량이 많아 잠시 지연되고 있습니다. 작성 내용을 백업하시고 1분 후 다시 시도해주세요.';
  }
  if (raw.includes('요청 시간이 초과') || message.includes('timeout') || message.includes('timed out')) {
    return '⚠️ [시간 초과] 요청 시간이 초과되었습니다. 네트워크 상태를 확인하고 다시 시도해주세요.';
  }
  if (
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('enotfound') ||
    message.includes('econnrefused') ||
    message.includes('econnreset') ||
    message.includes('err_internet_disconnected')
  ) {
    return '⚠️ [네트워크 오류] 인터넷 연결을 확인한 뒤 다시 시도해주세요.';
  }

  const detail = raw.replace(/^Error:\s*/i, '').slice(0, 120);
  return detail
    ? `⚠️ AI 생성 중 오류가 발생했습니다: ${detail}`
    : '⚠️ AI 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
}

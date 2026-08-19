// 나이스(NEIS) 생기부 시스템과 동일하게 UTF-8 인코딩 기준으로 바이트 수를 계산한다.
// (한글 1자 = 3byte, 영문/숫자/공백 = 1byte)
export function getByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

// 생기부 항목별 입력 바이트 상한.
export const RECORD_KINDS = ['opinion', 'subject', 'creative', 'sports'] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];

// 기본값 — 기재요령은 학년도·학교급·시도교육청에 따라 달라지므로 어디까지나 출발점이다.
// 사용자가 설정 화면에서 자기 학교 기준으로 조정할 수 있게 하고, 화면에도 적용 중인
// 기준값을 함께 표시해 잘못된 기준으로 경고가 뜨는 상황을 사용자가 알아챌 수 있게 한다.
export const DEFAULT_BYTE_LIMITS: Record<RecordKind, number> = {
  opinion: 1500,
  subject: 1500,
  creative: 1500,
  sports: 500,
};

// 설정 화면·config 검증에서 함께 쓰는 상한값 자체의 유효 범위.
const MAX_BYTE_LIMIT = 10_000;

export function isValidByteLimit(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= MAX_BYTE_LIMIT;
}

export type ByteLimitState = 'ok' | 'near' | 'over' | 'unknown';

// 상한 대비 현재 길이 상태. near는 "곧 넘칠 것 같으니 눈여겨보라"는 뜻으로 90%부터 표시한다.
// 상한값이 유효하지 않으면 임의로 판정하지 않고 unknown을 돌려준다(잘못된 경고 방지).
export function getByteLimitState(text: string, limit: number): ByteLimitState {
  if (!isValidByteLimit(limit)) return 'unknown';
  const bytes = getByteLength(text);
  if (bytes > limit) return 'over';
  if (bytes >= limit * 0.9) return 'near';
  return 'ok';
}

// 설정(neisByteLimits)에 저장된 JSON 문자열을 안전하게 해석한다.
// 값이 없거나 깨졌거나 범위를 벗어난 항목은 기본값으로 되돌려, 잘못된 기준으로
// 경고가 뜨는 상황을 만들지 않는다.
export function parseByteLimits(raw: unknown): Record<RecordKind, number> {
  const limits = { ...DEFAULT_BYTE_LIMITS };
  if (typeof raw !== 'string' || !raw.trim()) return limits;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return limits;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return limits;
  for (const kind of RECORD_KINDS) {
    const value = (parsed as Record<string, unknown>)[kind];
    if (isValidByteLimit(value)) limits[kind] = value as number;
  }
  return limits;
}

// 설정에서 바이트 상한을 읽어온다. 조회 실패 시에도 기본값으로 동작한다.
export async function loadByteLimits(): Promise<Record<RecordKind, number>> {
  const raw = await window.electronAPI.getConfig('neisByteLimits').catch(() => '');
  return parseByteLimits(raw);
}

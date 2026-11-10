import * as path from 'path';
import { sanitizeConfigEntryWith } from './configRules';

// config:set / 백업 복원에서 들어오는 설정값을 키별 타입에 맞게 검증한다.
// 백업 파일이 임의로 수정되었거나 렌더러가 잘못된 값을 보내도
// electron-store에 비정상 타입이 저장되지 않도록 막는다.

export { MAX_STRING_VALUE_CHARS } from './configRules';

export function sanitizeConfigEntry(key: string, value: unknown): unknown | undefined {
  return sanitizeConfigEntryWith(key, value, path.isAbsolute);
}

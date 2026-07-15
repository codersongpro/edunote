// Gemini API 키를 OS 안전 저장소(safeStorage)로 암호화해 보관하는 로직.
// 암호화 가능 환경에서는 암호문(base64)을 별도 키(<이름>Enc)에 저장하고 평문은 남기지 않으며,
// 불가 환경(리눅스 키링 부재 등)에서는 기존 평문 방식으로 폴백한다.
// electron 모듈에 직접 의존하지 않도록 암호화 구현과 저장소를 주입받는다(단위 테스트 용이).

export interface SecretCrypto {
  isEncryptionAvailable(): boolean;
  encryptString(plain: string): Buffer;
  decryptString(encrypted: Buffer): string;
}

export interface SecretBackend {
  get(key: string): unknown;
  set(key: string, value: string): void;
}

export const SECRET_KEYS = ['geminiApiKey', 'geminiPaidApiKey', 'naramarketApiKey', 'naverShoppingClientSecret'] as const;
export type SecretKey = (typeof SECRET_KEYS)[number];

export function encKeyOf(key: SecretKey): string {
  return `${key}Enc`;
}

// 평문 키와 암호문 키 전체 목록 — 렌더러 조회·설정 파일 동기화·백업에서 항상 제외해야 하는 키들.
// 시크릿이 추가되면 SECRET_KEYS만 늘리면 되고, 이 목록과 아래 헬퍼는 자동으로 따라온다.
export const SECRET_STORE_KEYS: readonly string[] = [...SECRET_KEYS, ...SECRET_KEYS.map(encKeyOf)];

export function isSecretKey(key: string): key is SecretKey {
  return (SECRET_KEYS as readonly string[]).includes(key);
}

// 설정 객체에서 시크릿(평문·암호문)을 모두 제거한 사본을 돌려준다.
export function stripSecrets(settings: object): Record<string, unknown> {
  const safe: Record<string, unknown> = { ...settings };
  for (const key of SECRET_STORE_KEYS) delete safe[key];
  return safe;
}

export function readSecret(backend: SecretBackend, crypto: SecretCrypto, key: SecretKey): string {
  const enc = backend.get(encKeyOf(key));
  if (typeof enc === 'string' && enc) {
    try {
      if (crypto.isEncryptionAvailable()) {
        return crypto.decryptString(Buffer.from(enc, 'base64'));
      }
    } catch {
      // 다른 PC에서 설정 파일을 복사해 온 경우 등 복호화 불가 → 키 없음으로 처리해 재입력을 유도한다.
    }
    return '';
  }
  const plain = backend.get(key);
  return typeof plain === 'string' ? plain : '';
}

export function writeSecret(backend: SecretBackend, crypto: SecretCrypto, key: SecretKey, value: string): void {
  const trimmed = value.trim();
  if (trimmed && crypto.isEncryptionAvailable()) {
    try {
      const encrypted = crypto.encryptString(trimmed).toString('base64');
      backend.set(encKeyOf(key), encrypted);
      backend.set(key, '');
      return;
    } catch {
      // 암호화 실패 시 평문 저장으로 폴백해 키 자체를 잃지 않게 한다.
    }
  }
  backend.set(key, trimmed);
  backend.set(encKeyOf(key), '');
}

// 기존 평문 키를 암호화 저장으로 1회 이관한다. 이관한 키 개수를 돌려준다.
export function migrateSecrets(backend: SecretBackend, crypto: SecretCrypto): number {
  if (!crypto.isEncryptionAvailable()) return 0;
  let migrated = 0;
  for (const key of SECRET_KEYS) {
    const plain = backend.get(key);
    if (typeof plain === 'string' && plain.trim()) {
      writeSecret(backend, crypto, key, plain);
      migrated++;
    }
  }
  return migrated;
}

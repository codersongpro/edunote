import { describe, it, expect } from 'vitest';
import { readSecret, writeSecret, migrateSecrets, encKeyOf, SecretBackend, SecretCrypto, SECRET_KEYS, SECRET_STORE_KEYS, isSecretKey, stripSecrets } from '../secretStore';

// XOR 기반의 단순 가짜 암호화 — 실제 safeStorage를 대신해 왕복 동작만 검증한다.
function makeCrypto(available = true): SecretCrypto {
  return {
    isEncryptionAvailable: () => available,
    encryptString: (plain: string) => Buffer.from(plain, 'utf-8').map(b => b ^ 0x5a) as Buffer,
    decryptString: (encrypted: Buffer) => Buffer.from(encrypted.map(b => b ^ 0x5a)).toString('utf-8'),
  };
}

function makeBackend(initial: Record<string, string> = {}): SecretBackend & { data: Record<string, string> } {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    get: (key: string) => data[key],
    set: (key: string, value: string) => { data[key] = value; },
  };
}

describe('secretStore', () => {
  it('암호화 가능 환경에서는 암호문만 저장하고 평문을 남기지 않는다', () => {
    const backend = makeBackend();
    const crypto = makeCrypto();
    writeSecret(backend, crypto, 'geminiApiKey', ' my-key ');
    expect(backend.data['geminiApiKey']).toBe('');
    expect(backend.data[encKeyOf('geminiApiKey')]).not.toBe('');
    expect(backend.data[encKeyOf('geminiApiKey')]).not.toContain('my-key');
    expect(readSecret(backend, crypto, 'geminiApiKey')).toBe('my-key');
  });

  it('암호화 불가 환경에서는 평문으로 폴백해 저장·조회한다', () => {
    const backend = makeBackend();
    const crypto = makeCrypto(false);
    writeSecret(backend, crypto, 'geminiApiKey', 'plain-key');
    expect(backend.data['geminiApiKey']).toBe('plain-key');
    expect(backend.data[encKeyOf('geminiApiKey')]).toBe('');
    expect(readSecret(backend, crypto, 'geminiApiKey')).toBe('plain-key');
  });

  it('빈 값 저장은 암호문·평문을 모두 지운다 (키 삭제)', () => {
    const backend = makeBackend();
    const crypto = makeCrypto();
    writeSecret(backend, crypto, 'geminiApiKey', 'my-key');
    writeSecret(backend, crypto, 'geminiApiKey', '');
    expect(backend.data['geminiApiKey']).toBe('');
    expect(backend.data[encKeyOf('geminiApiKey')]).toBe('');
    expect(readSecret(backend, crypto, 'geminiApiKey')).toBe('');
  });

  it('복호화에 실패하면 빈 값을 돌려줘 재입력을 유도한다', () => {
    const backend = makeBackend({ [encKeyOf('geminiApiKey')]: 'not-real-cipher' });
    const crypto: SecretCrypto = {
      isEncryptionAvailable: () => true,
      encryptString: () => { throw new Error('unused'); },
      decryptString: () => { throw new Error('decrypt failed'); },
    };
    expect(readSecret(backend, crypto, 'geminiApiKey')).toBe('');
  });

  it('암호문이 있으면 평문 잔여값보다 우선한다', () => {
    const backend = makeBackend();
    const crypto = makeCrypto();
    writeSecret(backend, crypto, 'geminiApiKey', 'new-key');
    backend.data['geminiApiKey'] = 'stale-plain';
    expect(readSecret(backend, crypto, 'geminiApiKey')).toBe('new-key');
  });

  it('암호화 실패 시 평문 저장으로 폴백해 키를 잃지 않는다', () => {
    const backend = makeBackend();
    const crypto: SecretCrypto = {
      isEncryptionAvailable: () => true,
      encryptString: () => { throw new Error('encrypt failed'); },
      decryptString: () => { throw new Error('unused'); },
    };
    writeSecret(backend, crypto, 'geminiApiKey', 'my-key');
    expect(backend.data['geminiApiKey']).toBe('my-key');
    expect(readSecret(backend, crypto, 'geminiApiKey')).toBe('my-key');
  });

  it('기존 평문 키를 암호화 저장으로 이관한다', () => {
    const backend = makeBackend({ geminiApiKey: 'free-key', geminiPaidApiKey: 'paid-key' });
    const crypto = makeCrypto();
    expect(migrateSecrets(backend, crypto)).toBe(2);
    expect(backend.data['geminiApiKey']).toBe('');
    expect(backend.data['geminiPaidApiKey']).toBe('');
    expect(readSecret(backend, crypto, 'geminiApiKey')).toBe('free-key');
    expect(readSecret(backend, crypto, 'geminiPaidApiKey')).toBe('paid-key');
  });

  it('평문 키가 없거나 암호화 불가면 이관하지 않는다', () => {
    const emptyBackend = makeBackend();
    expect(migrateSecrets(emptyBackend, makeCrypto())).toBe(0);

    const backend = makeBackend({ geminiApiKey: 'free-key' });
    expect(migrateSecrets(backend, makeCrypto(false))).toBe(0);
    expect(backend.data['geminiApiKey']).toBe('free-key');
  });

  it('이관은 반복 실행해도 안전하다 (두 번째 실행은 이관 대상 없음)', () => {
    const backend = makeBackend({ geminiApiKey: 'free-key' });
    const crypto = makeCrypto();
    expect(migrateSecrets(backend, crypto)).toBe(1);
    expect(migrateSecrets(backend, crypto)).toBe(0);
    expect(readSecret(backend, crypto, 'geminiApiKey')).toBe('free-key');
  });

  it('나라장터 인증키·네이버 Secret도 암호화 저장·이관 대상이다', () => {
    const backend = makeBackend({ naramarketApiKey: 'nara-key', naverShoppingClientSecret: 'naver-secret' });
    const crypto = makeCrypto();
    expect(migrateSecrets(backend, crypto)).toBe(2);
    expect(backend.data['naramarketApiKey']).toBe('');
    expect(backend.data['naverShoppingClientSecret']).toBe('');
    expect(readSecret(backend, crypto, 'naramarketApiKey')).toBe('nara-key');
    expect(readSecret(backend, crypto, 'naverShoppingClientSecret')).toBe('naver-secret');

    // 새로 저장하는 값도 암호문만 남는다
    writeSecret(backend, crypto, 'naramarketApiKey', 'new-nara');
    expect(backend.data['naramarketApiKey']).toBe('');
    expect(backend.data[encKeyOf('naramarketApiKey')]).not.toContain('new-nara');
    expect(readSecret(backend, crypto, 'naramarketApiKey')).toBe('new-nara');
  });

  it('SECRET_STORE_KEYS는 모든 시크릿의 평문·암호문 키를 포함한다', () => {
    for (const key of SECRET_KEYS) {
      expect(SECRET_STORE_KEYS).toContain(key);
      expect(SECRET_STORE_KEYS).toContain(encKeyOf(key));
    }
  });

  it('isSecretKey는 시크릿 키만 참으로 판별한다', () => {
    expect(isSecretKey('naramarketApiKey')).toBe(true);
    expect(isSecretKey('naverShoppingClientSecret')).toBe(true);
    expect(isSecretKey('geminiApiKey')).toBe(true);
    expect(isSecretKey('teacherName')).toBe(false);
    expect(isSecretKey('naramarketApiKeyEnc')).toBe(false);
  });

  it('stripSecrets는 평문·암호문 시크릿을 모두 제거하고 나머지는 보존한다', () => {
    const settings = {
      teacherName: '김교사',
      geminiApiKey: 'g1',
      geminiApiKeyEnc: 'enc1',
      naramarketApiKey: 'n1',
      naramarketApiKeyEnc: 'enc2',
      naverShoppingClientSecret: 's1',
      naverShoppingClientSecretEnc: 'enc3',
      naverShoppingClientId: 'public-id',
    };
    const safe = stripSecrets(settings);
    expect(safe).toEqual({ teacherName: '김교사', naverShoppingClientId: 'public-id' });
    // 원본은 변형되지 않는다
    expect(settings.geminiApiKey).toBe('g1');
  });
});

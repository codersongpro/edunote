import { describe, expect, it } from 'vitest';
import { collectStorage, replaceStorageTransactionally } from '../backupStorage';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  failOnceFor: string | null = null;

  get length(): number { return this.values.size; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  clear(): void { this.values.clear(); }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void {
    if (this.failOnceFor === key) {
      this.failOnceFor = null;
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    }
    this.values.set(key, value);
  }
}

describe('backupStorage', () => {
  it('현재 저장 값을 빠짐없이 수집한다', () => {
    const storage = new MemoryStorage();
    storage.setItem('first', '1');
    storage.setItem('second', '2');

    expect(collectStorage(storage)).toEqual({ first: '1', second: '2' });
  });

  it('새 값 적용 중 실패하면 기존 값을 복원한다', () => {
    const storage = new MemoryStorage();
    storage.setItem('before', 'keep');
    storage.failOnceFor = 'bad';

    expect(() => replaceStorageTransactionally(storage, { first: '1', bad: '2' })).toThrow('quota exceeded');
    expect(collectStorage(storage)).toEqual({ before: 'keep' });
  });
});

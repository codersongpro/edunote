export interface StorageLike {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
}

export function collectStorage(storage: StorageLike): Record<string, string> {
  const dump: Record<string, string> = {};
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key === null) continue;
    const value = storage.getItem(key);
    if (value !== null) dump[key] = value;
  }
  return dump;
}

/** 새 값 적용에 실패하면 이 함수 안에서 기존 localStorage를 즉시 복원합니다. */
export function replaceStorageTransactionally(
  storage: StorageLike,
  replacement: Record<string, string>,
): void {
  const before = collectStorage(storage);
  try {
    storage.clear();
    for (const [key, value] of Object.entries(replacement)) storage.setItem(key, value);
  } catch (error) {
    storage.clear();
    for (const [key, value] of Object.entries(before)) storage.setItem(key, value);
    throw error;
  }
}

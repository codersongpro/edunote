// 웹판 저장소 — 브라우저 IndexedDB 하나에 설정·데이터 파일·시크릿을 키-값으로 보관한다.
// localStorage를 쓰지 않는 이유: 렌더러가 백업 때 localStorage 전체를 덤프하므로,
// 여기에 API 키를 두면 백업 파일로 새어 나간다. IndexedDB는 그 덤프에 포함되지 않는다.
// 서버로는 아무것도 보내지 않는다(학생 개인정보는 이 브라우저에만 남는다).

const DB_NAME = 'edunote-web';
const STORE = 'kv';

export type Namespace = 'config' | 'data' | 'secret' | 'meta';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error ?? new Error('브라우저 저장소를 열 수 없습니다. 시크릿 모드이거나 저장 공간이 꺼져 있을 수 있습니다.'));
    };
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return openDb().then(db => new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error ?? new Error('브라우저 저장소 작업에 실패했습니다.'));
    tx.onabort = () => reject(tx.error ?? new Error('브라우저 저장 공간이 부족합니다.'));
  }));
}

const fullKey = (ns: Namespace, key: string) => `${ns}:${key}`;

export async function kvGet<T = unknown>(ns: Namespace, key: string): Promise<T | undefined> {
  return run<T>('readonly', s => s.get(fullKey(ns, key)) as IDBRequest<T>);
}

export async function kvSet(ns: Namespace, key: string, value: unknown): Promise<void> {
  await run('readwrite', s => { s.put(value, fullKey(ns, key)); });
}

export async function kvDelete(ns: Namespace, key: string): Promise<void> {
  await run('readwrite', s => { s.delete(fullKey(ns, key)); });
}

// 한 네임스페이스의 모든 항목을 { key: value }로 돌려준다(백업·설정 전체 조회용).
export async function kvEntries(ns: Namespace): Promise<Record<string, unknown>> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const out: Record<string, unknown> = {};
    const prefix = `${ns}:`;
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).openCursor(IDBKeyRange.bound(prefix, `${prefix}￿`));
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      out[String(cursor.key).slice(prefix.length)] = cursor.value;
      cursor.continue();
    };
    tx.oncomplete = () => resolve(out);
    tx.onerror = () => reject(tx.error);
  });
}

// "이 브라우저의 EduNote 데이터 모두 지우기" — 공용 PC 사용 후 정리용.
export async function kvClearAll(): Promise<void> {
  await run('readwrite', s => { s.clear(); });
}

// 브라우저가 저장 공간이 부족할 때 데이터를 임의로 지우지 않도록 영구 저장을 요청한다(실패해도 무시).
export function requestPersistentStorage(): void {
  try {
    void navigator.storage?.persist?.().catch(() => {});
  } catch {
    // 지원하지 않는 브라우저
  }
}

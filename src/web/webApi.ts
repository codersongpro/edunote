// EduNote 웹판의 window.electronAPI 구현.
//
// 데스크톱판은 preload(src/preload/index.ts)가 이 객체를 만들고, 웹판은 이 파일이 만든다.
// 화면(src/renderer)은 두 판이 똑같이 공유하므로, 화면 코드를 고치면 웹판에도 그대로 반영된다.
//
// ⚠ 동기화 규칙: 아래 객체는 ElectronAPI 인터페이스(src/preload/types.d.ts)로 타입을 고정했다.
//   데스크톱에 새 API를 추가하면서 여기 구현을 빠뜨리면 `npm run typecheck`가 실패한다.
//
// 보안 원칙
// - Gemini API 키는 서버로 보내지 않는다. 브라우저에서 Google API로 직접 호출한다.
// - 설정·학생 데이터는 이 브라우저의 IndexedDB에만 저장한다(서버 저장 없음).
// - 외부 사이트 조회(CORS 때문에 브라우저에서 직접 못 하는 것)만 /api 서버 함수가 중계한다.

import type { ElectronAPI, BackupInspection, BackupRestoreResult, ModelFallbackNoticePayload } from '../preload/types';
import {
  generateContent,
  generateContentMultipart,
  generateContentMultipartStream,
  generateSlideImage,
  getModelDiagnostics,
  resetModelCache,
  testApiKey,
  type ApiTier,
} from '../main/GeminiService';
import { validateGenerateArgs, validateMultipartArgs } from '../main/ipcValidation';
import { selectActiveApiKey } from '../main/apiKeySelection';
import { buildHwpxBytes } from '../main/hwpxDocument';
import { ALLOWED_CONFIG_KEYS, MAX_STRING_VALUE_CHARS, sanitizeConfigEntryWith } from '../main/configRules';
import { CONFIG_DEFAULTS } from '../main/configDefaults';
import { MAX_BACKUP_BYTES, parseBackup, serializeValidatedBackup, type ParsedBackup } from '../main/backupFormat';
import { isSecretKey, stripSecrets, type SecretKey } from '../main/secretStore';
import { isPngDataUrl } from '../main/clipboardImage';
import { buildNaverShoppingSearchUrl } from '../main/priceSearch';
import { buildEduReferenceSearchUrl } from '../main/eduReferenceSearch';
import { kvClearAll, kvDelete, kvEntries, kvGet, kvSet } from './storage';
import { dataUrlToBlob, pickFile, saveBlob } from './files';
import {
  isChatPopupOpen,
  isSafeHttpUrl,
  onChatPopupState,
  openChatPopup,
  openDemoPopup,
  openExternalTab,
  openSandboxedHtml,
  openSearchPopup,
  printHtml,
} from './windows';

declare const __APP_VERSION__: string;

const API_KEY_MISSING = 'API 키가 설정되지 않았습니다. 설정에서 Gemini API 키를 입력해주세요.';
const PATH_CONFIG_KEYS = new Set(['saveDir', 'appDataDir']);
const BROWSER_STORAGE_LABEL = '브라우저 저장소';

// ── 시크릿(API 키·나라장터 인증키) ───────────────────────────────────
// "이 브라우저에 기억"(기본값)이면 IndexedDB에, 끄면 탭을 닫을 때 사라지는 sessionStorage에 둔다.
// 둘 다 localStorage가 아니므로 렌더러의 백업 덤프에 섞이지 않는다.
const SESSION_SECRET_PREFIX = 'edunote-web-secret:';

async function isRememberSecrets(): Promise<boolean> {
  return (await kvGet<boolean>('meta', 'rememberSecrets')) !== false;
}

async function readSecret(key: SecretKey): Promise<string> {
  const session = sessionStorage.getItem(SESSION_SECRET_PREFIX + key);
  if (session) return session;
  const stored = await kvGet<string>('secret', key);
  return typeof stored === 'string' ? stored : '';
}

async function writeSecret(key: SecretKey, value: string): Promise<void> {
  sessionStorage.removeItem(SESSION_SECRET_PREFIX + key);
  await kvDelete('secret', key);
  if (!value) return;
  if (await isRememberSecrets()) await kvSet('secret', key, value);
  else sessionStorage.setItem(SESSION_SECRET_PREFIX + key, value);
}

// 기억하기 설정을 바꾸면 이미 저장된 키를 새 위치로 옮긴다.
async function setRememberSecrets(remember: boolean): Promise<void> {
  const keys: SecretKey[] = ['geminiApiKey', 'geminiPaidApiKey', 'naramarketApiKey'];
  const current = await Promise.all(keys.map(k => readSecret(k)));
  await kvSet('meta', 'rememberSecrets', remember);
  await Promise.all(keys.map((k, i) => writeSecret(k, current[i])));
}

// ── 설정 ────────────────────────────────────────────────────────────
async function getConfigValue(key: string): Promise<unknown> {
  if (!ALLOWED_CONFIG_KEYS.includes(key)) return undefined;
  const stored = await kvGet('config', key);
  if (stored !== undefined) return stored;
  return (CONFIG_DEFAULTS as Record<string, unknown>)[key];
}

// 웹에는 폴더 경로 설정이 없으므로 저장 경로 키는 받지 않는다(백업 복원에서도 제외).
function sanitizeWebConfig(key: string, value: unknown): unknown | undefined {
  if (!ALLOWED_CONFIG_KEYS.includes(key) || PATH_CONFIG_KEYS.has(key)) return undefined;
  return sanitizeConfigEntryWith(key, value, () => false);
}

async function getActiveApi(): Promise<{ apiKey: string; apiTier: ApiTier }> {
  const apiTier = ((await getConfigValue('apiTier')) || 'free') as ApiTier;
  const [freeKey, paidKey] = await Promise.all([readSecret('geminiApiKey'), readSecret('geminiPaidApiKey')]);
  return { apiKey: selectActiveApiKey(apiTier, freeKey, paidKey), apiTier };
}

async function requireActiveApi(): Promise<{ apiKey: string; apiTier: ApiTier }> {
  const active = await getActiveApi();
  if (!active.apiKey) throw new Error(API_KEY_MISSING);
  return active;
}

// ── 대체 모델 알림 ───────────────────────────────────────────────────
const fallbackListeners = new Set<(payload: ModelFallbackNoticePayload) => void>();
function notifyFallback<T extends { model: string; fallbacks: Array<{ fromModel: string; reason: 'quota' | 'stream' }> }>(result: T): T {
  if (result.fallbacks.some(item => item.reason === 'quota')) {
    for (const cb of fallbackListeners) {
      try { cb({ usedModel: result.model, fallbacks: result.fallbacks }); } catch { /* 무시 */ }
    }
  }
  return result;
}

// ── 데이터 파일 ─────────────────────────────────────────────────────
function safeDataName(name: string): string {
  return String(name ?? '').replace(/[^a-zA-Z0-9_-]/g, '');
}

// ── 서버 함수(/api) 호출 ────────────────────────────────────────────
async function callApi<T>(path: string, init: RequestInit = {}, timeoutMs = 30_000): Promise<T> {
  const res = await fetch(path, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  const body = await res.json().catch(() => null) as { error?: string } | null;
  if (!res.ok) throw new Error(body?.error || `요청에 실패했습니다(HTTP ${res.status}).`);
  return body as T;
}

const apiGet = <T>(path: string, params: Record<string, string>, timeoutMs?: number) =>
  callApi<T>(`/api/${path}?${new URLSearchParams(params).toString()}`, {}, timeoutMs);

// ── 백업 ────────────────────────────────────────────────────────────
const BACKUP_TTL_MS = 5 * 60 * 1000;
const pendingInspections = new Map<string, { fileName: string; backup: ParsedBackup; expiresAt: number }>();
const pendingRestores = new Map<string, { rollback: () => Promise<void>; expiresAt: number }>();

function cleanupBackupOps(): void {
  const now = Date.now();
  for (const [id, v] of pendingInspections) if (v.expiresAt <= now) pendingInspections.delete(id);
  for (const [id, v] of pendingRestores) {
    if (v.expiresAt > now) continue;
    void v.rollback().catch(() => {});
    pendingRestores.delete(id);
  }
}

async function buildBackupPayload(localStorageDump?: Record<string, string>) {
  const stored = await kvEntries('config');
  const settings = stripSecrets({ ...CONFIG_DEFAULTS, ...stored });
  const dataFiles = await kvEntries('data');
  return {
    app: 'EduNote',
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    settings,
    dataFiles,
    localStorage: localStorageDump && typeof localStorageDump === 'object' ? localStorageDump : {},
  };
}

async function applyBackup(backup: ParsedBackup): Promise<() => Promise<void>> {
  const settingChanges = Object.entries(backup.settings)
    .map(([key, value]) => ({ key, value: sanitizeWebConfig(key, value) }))
    .filter((e): e is { key: string; value: unknown } => e.value !== undefined);
  const settingSnapshots = await Promise.all(settingChanges.map(async ({ key }) => ({ key, value: await kvGet('config', key) })));
  const fileSnapshots = await Promise.all(Object.keys(backup.dataFiles).map(async name => ({ name, value: await kvGet('data', name) })));

  const rollback = async () => {
    for (const s of settingSnapshots) {
      if (s.value === undefined) await kvDelete('config', s.key);
      else await kvSet('config', s.key, s.value);
    }
    for (const f of fileSnapshots) {
      if (f.value === undefined) await kvDelete('data', f.name);
      else await kvSet('data', f.name, f.value);
    }
  };

  try {
    for (const [name, value] of Object.entries(backup.dataFiles)) await kvSet('data', name, value);
    for (const { key, value } of settingChanges) await kvSet('config', key, value);
  } catch (error) {
    await rollback().catch(() => {});
    throw error;
  }
  return rollback;
}

function dateStamp(): string {
  const now = new Date();
  return `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
}

async function askLocation(): Promise<boolean> {
  return (await getConfigValue('alwaysAskPath')) !== false;
}

const textBlob = (content: string, type: string) => new Blob([content], { type: `${type};charset=utf-8` });

// ── electronAPI 구현 ────────────────────────────────────────────────
export const webApi: ElectronAPI = {
  // AI 생성 — 데스크톱 메인 프로세스와 같은 GeminiService(모델 선택·대체·스트리밍 규칙)를 브라우저에서 실행한다.
  async aiGenerate(prompt, systemInstruction, options) {
    validateGenerateArgs(prompt, systemInstruction, options);
    const { apiKey, apiTier } = await requireActiveApi();
    return notifyFallback(await generateContent(apiKey, prompt, { systemInstruction, ...options, apiTier }));
  },
  async aiGenerateMultipart(parts, systemInstruction, options) {
    validateMultipartArgs(parts, systemInstruction, options);
    const { apiKey, apiTier } = await requireActiveApi();
    return notifyFallback(await generateContentMultipart(apiKey, parts, { systemInstruction, ...options, apiTier }));
  },
  async aiGenerateMultipartStream(parts, systemInstruction, options, onEvent) {
    validateMultipartArgs(parts, systemInstruction, options);
    const { apiKey, apiTier } = await requireActiveApi();
    const result = await generateContentMultipartStream(apiKey, parts, { systemInstruction, ...options, apiTier }, event => {
      onEvent(event.type === 'chunk' ? { type: 'chunk', text: event.text } : { type: 'start' });
    });
    return notifyFallback(result);
  },
  onModelFallback(callback) {
    fallbackListeners.add(callback);
    return () => { fallbackListeners.delete(callback); };
  },
  async getModelInfo(forceRefresh) {
    const { apiKey, apiTier } = await requireActiveApi();
    return getModelDiagnostics(apiKey, apiTier, forceRefresh === true);
  },
  async testApiKey(key, apiTier = 'free') {
    if (!key || typeof key !== 'string') return { ok: false, error: 'API 키를 입력해 주세요.' };
    return testApiKey(key, apiTier);
  },
  async testStoredApiKey() {
    const { apiKey, apiTier } = await getActiveApi();
    if (!apiKey) return { ok: false, error: '저장된 API 키가 없습니다.' };
    return testApiKey(apiKey, apiTier);
  },

  // 파일 저장 — 데스크톱의 저장 대화상자 대신 "다른 이름으로 저장" 창(지원 브라우저) 또는 다운로드.
  async saveFile(content, suggestedName, ext) {
    const cleanExt = String(ext || '').replace('.', '');
    const name = cleanExt && !suggestedName.toLowerCase().endsWith(`.${cleanExt.toLowerCase()}`) ? `${suggestedName}.${cleanExt}` : suggestedName;
    const blob = typeof content === 'string' ? textBlob(content, 'text/plain') : new Blob([content as BlobPart]);
    return saveBlob(blob, name, await askLocation());
  },
  async saveBuffer(buffer, suggestedName) {
    const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : Uint8Array.from(buffer as unknown as number[]);
    return saveBlob(new Blob([bytes]), suggestedName, true);
  },
  async saveTxt(content, suggestedName) {
    return saveBlob(textBlob(content, 'text/plain'), suggestedName || `document_${Date.now()}.txt`, true);
  },
  async exportHtml(content, suggestedName) {
    return saveBlob(textBlob(content, 'text/html'), suggestedName || `app_${Date.now()}.html`, true);
  },
  async saveCsv(content, suggestedName) {
    // 엑셀에서 한글이 깨지지 않도록 데스크톱과 같이 UTF-8 BOM을 붙인다.
    return saveBlob(textBlob('﻿' + content, 'text/csv'), suggestedName || `export_${Date.now()}.csv`, true);
  },
  async openCsvFile() {
    const file = await pickFile('.csv,text/csv');
    if (!file) return null;
    return { filePath: file.name, content: await file.text() };
  },
  async saveHwpx(templateName, content, meta) {
    const title = meta.title || templateName;
    const safeName = title.replace(/[\\/:*?"<>|]/g, '_');
    const bytes = await buildHwpxBytes(title, content, meta);
    return saveBlob(new Blob([bytes as BlobPart], { type: 'application/hwp+zip' }), `(${dateStamp()})_${safeName}.hwpx`, true);
  },
  async savePdf(htmlContent, suggestedName) {
    // 브라우저 인쇄 창에서 "PDF로 저장"을 선택하는 방식. 파일 이름은 문서 제목으로 제안된다.
    const titled = htmlContent.includes('<title>')
      ? htmlContent
      : htmlContent.replace(/<head([^>]*)>/i, `<head$1><title>${suggestedName.replace(/\.pdf$/i, '').replace(/[<>&]/g, '')}</title>`);
    await printHtml(titled);
    return suggestedName;
  },
  async openHtmlExternal(htmlContent, suggestedName) {
    return openSandboxedHtml(htmlContent) ? (suggestedName || '새 창') : null;
  },

  async copyImageToClipboard(dataUrl) {
    if (!isPngDataUrl(dataUrl)) return false;
    const blob = dataUrlToBlob(dataUrl);
    if (!blob || typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return false;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      return true;
    } catch {
      return false;
    }
  },

  // 웹에는 내 컴퓨터 폴더를 여는 기능이 없다.
  async openFolder() { return false; },
  async openExternal(url) {
    if (typeof url !== 'string') return false;
    try {
      if (new URL(url).protocol !== 'https:') return false;
    } catch {
      return false;
    }
    return openExternalTab(url);
  },

  // 설정
  async getConfig(key) { return getConfigValue(key); },
  async getAllConfig() {
    return stripSecrets({ ...CONFIG_DEFAULTS, ...(await kvEntries('config')) });
  },
  async setConfig(data) {
    for (const [key, value] of Object.entries(data ?? {})) {
      if (key === 'geminiApiKey' || key === 'geminiPaidApiKey') continue; // 전용 함수로만 저장
      if (isSecretKey(key)) {
        if (typeof value === 'string' && value.length <= MAX_STRING_VALUE_CHARS) await writeSecret(key, value);
        continue;
      }
      const safeValue = sanitizeWebConfig(key, value);
      if (safeValue === undefined) continue;
      await kvSet('config', key, safeValue);
    }
  },
  async setApiKey(key, apiTier = 'free') {
    if (typeof key !== 'string') return { usedPlaintext: false };
    await writeSecret(apiTier === 'paid' ? 'geminiPaidApiKey' : 'geminiApiKey', key);
    await kvSet('config', 'apiTier', apiTier);
    resetModelCache();
    // 웹판은 OS 금고가 없어 브라우저 저장소에 그대로 보관한다 — 기존 안내 UI가 이를 알리도록 true를 돌려준다.
    return { usedPlaintext: key.length > 0 };
  },
  async hasApiKey() {
    const [freeKey, paidKey] = await Promise.all([readSecret('geminiApiKey'), readSecret('geminiPaidApiKey')]);
    return [freeKey, paidKey].some(k => k.trim().length > 0);
  },
  async deleteApiKey(apiTier) {
    const target = apiTier || ((await getConfigValue('apiTier')) as ApiTier) || 'free';
    await writeSecret(target === 'paid' ? 'geminiPaidApiKey' : 'geminiApiKey', '');
    resetModelCache();
  },
  async readJsonData(name) {
    const value = await kvGet('data', safeDataName(name));
    return value === undefined ? null : value;
  },
  async writeJsonData(name, data) {
    const safe = safeDataName(name);
    // 데스크톱과 같이 JSON으로 직렬화할 수 있는 값만 저장한다(구조 복제가 안 되는 값 방지).
    await kvSet('data', safe, JSON.parse(JSON.stringify(data ?? null)));
    return `${BROWSER_STORAGE_LABEL}/${safe}.json`;
  },
  async getJsonDataPath(name) {
    return `${BROWSER_STORAGE_LABEL}/${safeDataName(name)}.json`;
  },
  async exportBackup(localStorageDump) {
    const raw = serializeValidatedBackup(await buildBackupPayload(localStorageDump));
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return saveBlob(new Blob([raw], { type: 'application/json' }), `edunote_backup_${stamp}.json`, true);
  },
  async inspectBackup(): Promise<BackupInspection | null> {
    cleanupBackupOps();
    const file = await pickFile('.json,application/json');
    if (!file) return null;
    if (file.size > MAX_BACKUP_BYTES) throw new Error('백업 파일은 최대 50MiB까지 불러올 수 있습니다.');
    const backup = parseBackup(await file.text(), file.size);
    const inspectionId = crypto.randomUUID();
    pendingInspections.set(inspectionId, { fileName: file.name, backup, expiresAt: Date.now() + BACKUP_TTL_MS });
    return {
      inspectionId,
      filePath: file.name,
      schemaVersion: backup.schemaVersion,
      settingsCount: Object.keys(backup.settings).length,
      dataFileCount: Object.keys(backup.dataFiles).length,
      localStorageCount: Object.keys(backup.localStorage).length,
      warnings: backup.warnings,
    };
  },
  async restoreBackup(inspectionId): Promise<BackupRestoreResult> {
    cleanupBackupOps();
    const inspection = pendingInspections.get(inspectionId);
    pendingInspections.delete(inspectionId);
    if (!inspection || inspection.expiresAt <= Date.now()) {
      throw new Error('백업 검사 시간이 만료되었습니다. 파일을 다시 선택해 주세요.');
    }
    const rollback = await applyBackup(inspection.backup);
    const restoreId = crypto.randomUUID();
    pendingRestores.set(restoreId, { rollback, expiresAt: Date.now() + BACKUP_TTL_MS });
    return { restoreId, filePath: inspection.fileName, localStorage: inspection.backup.localStorage };
  },
  async commitBackupRestore(restoreId) {
    if (!pendingRestores.delete(restoreId)) throw new Error('완료할 백업 복원 작업을 찾을 수 없습니다.');
  },
  async rollbackBackupRestore(restoreId) {
    const pending = pendingRestores.get(restoreId);
    pendingRestores.delete(restoreId);
    if (!pending) throw new Error('되돌릴 백업 복원 작업을 찾을 수 없습니다.');
    await pending.rollback();
  },
  // 브라우저는 사용자 동작 없이 파일을 만들 수 없어 자동 백업을 지원하지 않는다(설정 화면에서 안내).
  async autoBackup() { return null; },

  async selectFolder() { return null; },
  async fetchUrlMeta(url) {
    try {
      return await apiGet('url-meta', { url, kind: 'page' }, 12_000);
    } catch {
      return { title: '', description: '', image: '', domain: '' };
    }
  },
  async fetchYoutubeMeta(url) {
    const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/)?.[1] || '';
    const thumbnail = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';
    if (!videoId) return { title: '', description: '', thumbnail: '', videoId: '' };
    try {
      return await apiGet('url-meta', { url, kind: 'youtube' }, 12_000);
    } catch {
      return { title: '', description: '', thumbnail, videoId };
    }
  },
  async fetchImage(url) {
    if (!isSafeHttpUrl(url)) return null;
    try {
      const { dataUrl } = await apiGet<{ dataUrl: string | null }>('fetch-proxy', { kind: 'image', url }, 15_000);
      return dataUrl;
    } catch {
      return null;
    }
  },
  // 웹페이지 스크린샷은 브라우저에서 만들 수 없다 — 화면은 미리보기 이미지(og:image)만 쓴다.
  async screenshotUrl() { return null; },
  async fetchSlideImage(keyword) {
    try {
      const { apiKey } = await getActiveApi();
      if (!apiKey) return null;
      return await generateSlideImage(apiKey, keyword);
    } catch {
      return null;
    }
  },
  async openDemoWindow() { openDemoPopup(); },
  async openPriceSearchWindow(itemName) {
    const url = buildNaverShoppingSearchUrl(String(itemName ?? ''));
    return url ? openSearchPopup(url) : false;
  },
  async openEduReferenceSearchWindow(topic) {
    const url = buildEduReferenceSearchUrl(String(topic ?? ''));
    if (url) openSearchPopup(url);
  },
  async openChatWindow(opts) { openChatPopup(opts?.reload); },
  async isChatWindowOpen() { return isChatPopupOpen(); },
  onChatWindowState(callback) { return onChatPopupState(callback); },
  async getVersion() { return __APP_VERSION__; },
  // 웹판은 배포될 때마다 모두가 최신 버전을 쓰므로 업데이트 확인이 필요 없다.
  async checkUpdate() {
    return { currentVersion: __APP_VERSION__, latestVersion: null, hasUpdate: false, releaseUrl: '' };
  },

  async openJsonFile() {
    const file = await pickFile('.json,application/json');
    if (!file) return null;
    if (file.size > 5 * 1024 * 1024) throw new Error('파일은 최대 5MiB까지 불러올 수 있습니다.');
    return file.text();
  },
  async fetchMarket(sheetId) {
    const { text } = await apiGet<{ text: string }>('fetch-proxy', { kind: 'market', sheetId: String(sheetId ?? '') }, 20_000);
    return text;
  },
  async fetchUrlJson(url) {
    const { text } = await apiGet<{ text: string }>('fetch-proxy', { kind: 'json', url: String(url ?? '') }, 25_000);
    return text;
  },
  async naramarketSearch(keyword, pageNo = 1) {
    return naramarket('thng', keyword, pageNo);
  },
  async naramarketShoppingSearch(keyword, pageNo = 1) {
    return naramarket('shopping', keyword, pageNo);
  },
  async hasNaramarketKey() {
    return (await readSecret('naramarketApiKey')).trim().length > 0;
  },
};

// 나라장터 인증키는 교사 본인 키다. 서버 함수는 받은 키로 요청만 중계하고 저장·기록하지 않는다.
async function naramarket(kind: 'thng' | 'shopping', keyword: string, pageNo: number): Promise<unknown> {
  const serviceKey = (await readSecret('naramarketApiKey')).trim();
  if (!serviceKey) throw new Error('나라장터 인증키가 저장되어 있지 않습니다. 예산안작성 화면에서 키를 먼저 저장해주세요.');
  return callApi('/api/naramarket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Naramarket-Key': serviceKey },
    body: JSON.stringify({ kind, keyword, pageNo }),
  }, 60_000);
}

// 웹판에만 있는 기능 — 렌더러는 src/renderer/lib/platform.ts를 통해서만 쓴다.
export const webExtras = {
  isRememberSecrets,
  setRememberSecrets,
  // 이 브라우저에 남은 EduNote 데이터(설정·학생 자료·API 키)를 모두 지운다(공용 PC 정리용).
  async clearAllData(): Promise<void> {
    await kvClearAll();
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith(SESSION_SECRET_PREFIX)) sessionStorage.removeItem(key);
    }
    localStorage.clear();
    resetModelCache();
  },
};

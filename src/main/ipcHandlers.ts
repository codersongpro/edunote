import { ipcMain, dialog, shell, app, BrowserWindow, net, safeStorage } from 'electron';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { pathToFileURL } from 'url';
import { store } from './store';
import { sanitizeConfigEntry, MAX_STRING_VALUE_CHARS } from './configValidation';
import { assertSafeUrl } from './netGuard';
import { ApiTier, generateContent, generateContentMultipart, generateContentMultipartStream, testApiKey, generateSlideImage, resetModelCache, getModelDiagnostics } from './GeminiService';
import { generateHwpx } from './HwpxGenerator';
import { resolveDialogPath, resolveOpenableDir, resolveAutoSavePath } from './pathSafety';
import { semverGt } from './versionCompare';
import { validateGenerateArgs, validateMultipartArgs } from './ipcValidation';
import { readSecret, writeSecret, migrateSecrets, SecretCrypto, SecretKey, isSecretKey, stripSecrets } from './secretStore';
import { buildNaverShoppingSearchUrl } from './priceSearch';
import { buildEduReferenceSearchUrl } from './eduReferenceSearch';

// 시크릿(나라장터 인증키·네이버 Secret 등)은 이 목록에 넣지 않는다 — isSecretKey 인터셉트가 암호화 저장으로 처리한다.
// config:get·config:set이 함께 쓰는 허용 목록. 새 설정값을 추가할 때는 여기와
// configValidation.ts의 sanitizeConfigEntry(값 검증 규칙)를 함께 갱신해야 한다.
const ALLOWED_CONFIG_KEYS = ['saveDir', 'appDataDir', 'alwaysAskPath', 'teacherName', 'schoolName', 'institution', 'schoolLevel', 'gradeClass', 'studentNames', 'studentMaleNames', 'studentFemaleNames', 'darkMode', 'apiTier', 'apiKeyLastUsable', 'onboardingDismissed', 'privacyModeEnabled', 'reviewChecklistEnabled', 'cautionTerms', 'lastBackupAt', 'autoBackupInterval', 'fontSize', 'chatFirebaseConfig', 'chatActiveRoomId', 'chatRoomHistory', 'neisByteLimits', 'eduMaterialWebSearch'];

// API 키는 가능하면 OS 안전 저장소(safeStorage) 암호화로 보관한다.
const secretCrypto: SecretCrypto = {
  isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
  encryptString: (plain: string) => safeStorage.encryptString(plain),
  decryptString: (encrypted: Buffer) => safeStorage.decryptString(encrypted),
};
const getSecret = (key: SecretKey) => readSecret(store, secretCrypto, key);
const setSecret = (key: SecretKey, value: string) => writeSecret(store, secretCrypto, key, value);

// 앱 시작 시 1회 호출 — 기존 평문 키를 암호화 저장으로 이관한다. (app ready 이후에만 호출할 것)
export function migrateApiKeysToSafeStorage(): void {
  try {
    const migrated = migrateSecrets(store, secretCrypto);
    if (migrated > 0) console.log(`[secretStore] API 키 ${migrated}개를 암호화 저장으로 이관했습니다.`);
  } catch (e) {
    console.warn('[secretStore] API 키 이관 실패 (기존 방식으로 계속 동작):', e);
  }
}

function getActiveApi(): { apiKey: string; apiTier: ApiTier } {
  const apiTier = (store.get('apiTier') || 'free') as ApiTier;
  const freeKey = getSecret('geminiApiKey');
  const paidKey = getSecret('geminiPaidApiKey');
  const apiKey = apiTier === 'paid' ? (paidKey || freeKey) : (freeKey || paidKey);
  return { apiKey, apiTier };
}

function safeDataFile(name: string): string {
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '');
  const dir = store.get('appDataDir') || path.join(app.getPath('userData'), 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${safeName}.json`);
}

function getDataDir(): string {
  const dir = store.get('appDataDir') || path.join(app.getPath('userData'), 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// HTML 미리보기·PDF 변환용 세션 임시 디렉터리.
// mkdtemp로 매 실행마다 예측 불가능한 경로를 만들고, 앱 종료 시 정리한다.
let sessionTmpDir: string | null = null;

function getSessionTmpDir(): string {
  if (!sessionTmpDir || !fs.existsSync(sessionTmpDir)) {
    sessionTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edunote-'));
  }
  return sessionTmpDir;
}

export function cleanupSessionTmpDir(): void {
  if (!sessionTmpDir) return;
  try {
    fs.rmSync(sessionTmpDir, { recursive: true, force: true });
  } catch {
    // 다른 프로세스(브라우저 등)가 파일을 잡고 있으면 OS가 임시 폴더를 정리하도록 둔다.
  }
  sessionTmpDir = null;
}

// url:fetch-meta·resource:fetch-image·resource:youtube-meta가 공유하는 리다이렉트 안전 요청 헬퍼.
// data:fetch-url-json과 동일한 원칙(각 리다이렉트 홉마다 assertSafeUrl로 재검사)을 net.request로 구현한다.
// net.fetch(redirect 기본값 follow)를 그대로 쓰면 최초 URL만 검사하고 리다이렉트는 검사 없이
// 따라가 버려, 공인 도메인이 사설 IP·루프백으로 302를 보내는 SSRF를 막지 못한다.
function fetchSafely(
  rawUrl: string,
  options: { timeoutMs?: number; maxRedirects?: number } = {},
): Promise<{ buffer: Buffer; contentType: string }> {
  const { timeoutMs = 10000, maxRedirects = 5 } = options;
  const deadline = Date.now() + timeoutMs;
  const encodeUrl = (s: string): string => s.replace(/[^\x00-\x7F]/g, c => encodeURIComponent(c));

  const attempt = (targetUrl: string, redirectsLeft: number): Promise<{ buffer: Buffer; contentType: string }> =>
    new Promise((resolve, reject) => {
      if (redirectsLeft < 0) { reject(new Error('리다이렉트가 너무 많습니다')); return; }
      let safeUrl: string;
      try {
        safeUrl = assertSafeUrl(targetUrl);
      } catch (e) {
        reject(e);
        return;
      }
      const remaining = deadline - Date.now();
      if (remaining <= 0) { reject(new Error('연결 시간이 초과되었습니다')); return; }

      const req = net.request({ url: encodeUrl(safeUrl), redirect: 'manual' });
      req.setHeader('User-Agent', 'Mozilla/5.0');

      let settled = false;
      // 어떤 경로로 종료되든(응답·리다이렉트·오류·타임아웃) 타이머를 반드시 정리한다.
      const done = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn();
      };

      const timer = setTimeout(() => {
        done(() => reject(new Error('연결 시간이 초과되었습니다')));
        req.abort();
      }, remaining);

      req.on('redirect', (_code, _method, redirectUrl) => {
        done(() => resolve(attempt(redirectUrl, redirectsLeft - 1)));
        req.abort();
      });

      req.on('response', (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          done(() => reject(new Error(`HTTP ${res.statusCode}`)));
          return;
        }
        const rawContentType = res.headers['content-type'];
        const contentType = Array.isArray(rawContentType) ? (rawContentType[0] || '') : (rawContentType || '');
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => done(() => resolve({ buffer: Buffer.concat(chunks), contentType })));
        res.on('error', (e: Error) => done(() => reject(e)));
      });

      req.on('error', (e: Error) => done(() => reject(e)));
      req.end();
    });

  return attempt(rawUrl, maxRedirects);
}

function readOpenApiItems(data: any): any[] {
  const raw = data?.response?.body?.items ?? data?.body?.items ?? [];
  const rows = raw?.item ?? raw;
  return Array.isArray(rows) ? rows : (rows ? [rows] : []);
}

export function registerIpcHandlers(): void {
  // ── AI Generation ─────────────────────────────────────────────────
  ipcMain.handle('ai:generate', async (_e, prompt: string, systemInstruction?: string, options?: { temperature?: number; maxOutputTokens?: number; useSearchGrounding?: boolean; requireSearchGrounding?: boolean }) => {
    validateGenerateArgs(prompt, systemInstruction, options);
    const { apiKey, apiTier } = getActiveApi();
    if (!apiKey) throw new Error('API 키가 설정되지 않았습니다. 설정에서 Gemini API 키를 입력해주세요.');
    return generateContent(apiKey, prompt, { systemInstruction, ...options, apiTier });
  });

  ipcMain.handle('ai:generate-multipart', async (_e, parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }>, systemInstruction?: string, options?: { temperature?: number; maxOutputTokens?: number; useSearchGrounding?: boolean; requireSearchGrounding?: boolean }) => {
    validateMultipartArgs(parts, systemInstruction, options);
    const { apiKey, apiTier } = getActiveApi();
    if (!apiKey) throw new Error('API 키가 설정되지 않았습니다. 설정에서 Gemini API 키를 입력해주세요.');
    return generateContentMultipart(apiKey, parts, { systemInstruction, ...options, apiTier });
  });

  // 스트리밍 생성 — 진행 중 텍스트를 'ai:stream-event'로 보내고 전체 텍스트를 반환한다.
  ipcMain.handle('ai:generate-multipart-stream', async (e, requestId: unknown, parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }>, systemInstruction?: string, options?: { temperature?: number; maxOutputTokens?: number; responseJson?: boolean; useSearchGrounding?: boolean; requireSearchGrounding?: boolean }) => {
    if (typeof requestId !== 'string' || !/^[\w-]{1,64}$/.test(requestId)) {
      throw new Error('AI 요청 형식이 올바르지 않습니다.');
    }
    validateMultipartArgs(parts, systemInstruction, options);
    const { apiKey, apiTier } = getActiveApi();
    if (!apiKey) throw new Error('API 키가 설정되지 않았습니다. 설정에서 Gemini API 키를 입력해주세요.');
    return generateContentMultipartStream(apiKey, parts, { systemInstruction, ...options, apiTier }, (event) => {
      if (!e.sender.isDestroyed()) e.sender.send('ai:stream-event', { requestId, ...event });
    });
  });

  // 어떤 모델이 왜 선택되는지 설정 화면에서 확인할 수 있게 한다.
  ipcMain.handle('ai:model-info', async (_e, forceRefresh?: unknown) => {
    const { apiKey, apiTier } = getActiveApi();
    if (!apiKey) throw new Error('API 키가 설정되지 않았습니다. 설정에서 Gemini API 키를 입력해주세요.');
    return getModelDiagnostics(apiKey, apiTier, forceRefresh === true);
  });

  ipcMain.handle('ai:test-key', async (_e, key: string, apiTier: ApiTier = 'free') => {
    if (!key || typeof key !== 'string') {
      return { ok: false, error: 'API 키를 입력해 주세요.' };
    }
    return testApiKey(key, apiTier);
  });

  ipcMain.handle('ai:test-stored-key', async () => {
    const { apiKey, apiTier } = getActiveApi();
    if (!apiKey) return { ok: false, error: '저장된 API 키가 없습니다.' };
    return testApiKey(apiKey, apiTier);
  });

  // ── File Save ─────────────────────────────────────────────────────
  ipcMain.handle('file:save', async (_e, content: string | Buffer, suggestedName: string, ext: string) => {
    const alwaysAsk = store.get('alwaysAskPath');
    const saveDir = store.get('saveDir');

    let savePath: string | undefined;

    if (!alwaysAsk && saveDir && fs.existsSync(saveDir)) {
      // 렌더러가 준 파일명으로 폴더를 벗어나지 못하도록 검증하고, 실패 시 대화상자로 폴백한다.
      savePath = resolveAutoSavePath(saveDir, suggestedName) ?? undefined;
    }

    if (!savePath) {
      const result = await dialog.showSaveDialog({
        defaultPath: path.join(saveDir || app.getPath('documents'), suggestedName),
        filters: [{ name: ext.toUpperCase(), extensions: [ext.replace('.', '')] }],
      });
      if (result.canceled || !result.filePath) return null;
      savePath = result.filePath;
    }

    const dir = path.dirname(savePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    if (Buffer.isBuffer(content)) {
      fs.writeFileSync(savePath, content);
    } else {
      fs.writeFileSync(savePath, content, 'utf-8');
    }
    return savePath;
  });

  ipcMain.handle('file:save-buffer', async (_e, bufferData: ArrayBuffer | number[], suggestedName: string) => {
    const saveDir = store.get('saveDir');
    const result = await dialog.showSaveDialog({
      defaultPath: path.join(saveDir || app.getPath('documents'), suggestedName),
      filters: [{ name: 'HWPX', extensions: ['hwpx'] }],
    });
    if (result.canceled || !result.filePath) return null;

    const buf = Buffer.isBuffer(bufferData) ? bufferData : Buffer.from(bufferData as ArrayBuffer);
    fs.writeFileSync(result.filePath, buf);
    return result.filePath;
  });

  ipcMain.handle('file:export-html', async (_e, content: string, suggestedName?: string) => {
    const saveDir = store.get('saveDir');
    const name = suggestedName || `app_${Date.now()}.html`;
    const result = await dialog.showSaveDialog({
      defaultPath: path.join(saveDir || app.getPath('documents'), name),
      filters: [{ name: 'HTML 앱', extensions: ['html'] }],
    });
    if (result.canceled || !result.filePath) return null;
    fs.writeFileSync(result.filePath, content, 'utf-8');
    return result.filePath;
  });

  ipcMain.handle('file:save-txt', async (_e, content: string, suggestedName?: string) => {
    const saveDir = store.get('saveDir');
    const name = suggestedName || `document_${Date.now()}.txt`;
    const result = await dialog.showSaveDialog({
      defaultPath: path.join(saveDir || app.getPath('documents'), name),
      filters: [{ name: 'Text', extensions: ['txt'] }],
    });
    if (result.canceled || !result.filePath) return null;
    fs.writeFileSync(result.filePath, content, 'utf-8');
    return result.filePath;
  });

  ipcMain.handle('file:save-csv', async (_e, content: string, suggestedName?: string) => {
    const saveDir = store.get('saveDir');
    const name = suggestedName || `export_${Date.now()}.csv`;
    const result = await dialog.showSaveDialog({
      defaultPath: path.join(saveDir || app.getPath('documents'), name),
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });
    if (result.canceled || !result.filePath) return null;
    // UTF-8 BOM for Korean Excel compatibility
    fs.writeFileSync(result.filePath, '﻿' + content, 'utf-8');
    return result.filePath;
  });

  ipcMain.handle('file:open-csv', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      filters: [{ name: 'CSV', extensions: ['csv'] }],
      properties: ['openFile'],
    });
    if (canceled || !filePaths[0]) return null;
    const filePath = resolveDialogPath(filePaths[0]);
    return {
      filePath,
      content: fs.readFileSync(filePath, 'utf-8'),
    };
  });

  ipcMain.handle('file:save-hwpx', async (_e, templateName: string, content: string, meta: Record<string, string>) => {
    const saveDir = store.get('saveDir');
    const title = meta.title || templateName;
    const safeName = title.replace(/[\\/:*?"<>|]/g, '_');
    // 다른 저장 형식과 동일하게 파일명 앞에 날짜를 붙인다: (YYMMDD)_제목.hwpx
    const now = new Date();
    const stamp = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const result = await dialog.showSaveDialog({
      defaultPath: path.join(saveDir || app.getPath('documents'), `(${stamp})_${safeName}.hwpx`),
      filters: [{ name: 'HWPX', extensions: ['hwpx'] }],
    });
    if (result.canceled || !result.filePath) return null;
    await generateHwpx(templateName, content, meta, result.filePath);
    return result.filePath;
  });

  // ── Shell ─────────────────────────────────────────────────────────
  ipcMain.handle('shell:open-folder', async (_e, folderPath: string) => {
    const allowedRoots = [
      os.homedir(),
      app.getPath('userData'),
      app.getPath('documents'),
      app.getPath('downloads'),
      store.get('saveDir'),
      store.get('appDataDir'),
    ];
    const safe = resolveOpenableDir(folderPath, allowedRoots, target => {
      try { return fs.statSync(target); } catch { return null; }
    });
    if (!safe) return false;
    await shell.openPath(safe);
    return true;
  });

  ipcMain.handle('shell:open-external', async (_e, url: string) => {
    try {
      if (typeof url !== 'string') return false;
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') return false;
      await shell.openExternal(parsed.href);
      return true;
    } catch (e) {
      console.warn('[ipc:shell:open-external]', e);
      return false;
    }
  });

  // ── Config ────────────────────────────────────────────────────────
  ipcMain.handle('config:get', (_e, key: string) => {
    // 거부 목록(SECRET_STORE_KEYS) 대신 허용 목록으로 검사한다 — 새 시크릿 키를
    // SECRET_KEYS에 등록하는 걸 깜빡해도, 애초에 ALLOWED_CONFIG_KEYS에 없으면 노출되지 않는다.
    if (!ALLOWED_CONFIG_KEYS.includes(key)) return undefined;
    return store.get(key as keyof typeof store.store);
  });

  // 시크릿 원문은 렌더러로 보내지 않고 저장 여부만 알려준다.
  ipcMain.handle('config:has-naramarket-key', () => {
    return getSecret('naramarketApiKey').trim().length > 0;
  });

  ipcMain.handle('config:get-all', () => {
    return stripSecrets(store.store);
  });

  ipcMain.handle('config:set', (_e, data: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(data)) {
      if (key === 'geminiApiKey' || key === 'geminiPaidApiKey') {
        // API key is set via dedicated channel only
        continue;
      }
      if (isSecretKey(key)) {
        // 시크릿은 평문 store.set 대신 safeStorage 암호화 저장을 거친다. 길이 상한은 일반 설정값과 동일.
        if (typeof value === 'string' && value.length <= MAX_STRING_VALUE_CHARS) setSecret(key, value);
        continue;
      }
      if (ALLOWED_CONFIG_KEYS.includes(key)) {
        const safeValue = sanitizeConfigEntry(key, value);
        if (safeValue === undefined) {
          console.warn(`[ipc:config:set] 무효한 설정값을 건너뜁니다: ${key}`);
          continue;
        }
        store.set(key as any, safeValue as any);
      }
    }
    const safeSettings = stripSecrets(store.store);
    try {
      fs.writeFileSync(safeDataFile('user-settings'), JSON.stringify(safeSettings, null, 2), 'utf-8');
    } catch (e) {
      // 설정 저장 자체는 electron-store가 처리하므로 폴더 동기화 실패는 무시합니다.
      console.warn('[ipc:config:set] 설정 폴더 동기화 실패:', e);
    }
  });

  ipcMain.handle('config:set-api-key', (_e, key: string, apiTier: ApiTier = 'free') => {
    if (typeof key !== 'string') return { usedPlaintext: false };
    const { usedPlaintext } = apiTier === 'paid' ? setSecret('geminiPaidApiKey', key) : setSecret('geminiApiKey', key);
    store.set('apiTier', apiTier);
    resetModelCache();
    // 렌더러가 이 값을 보고, 금고(safeStorage)를 못 써서 평문 저장으로 폴백했음을 사용자에게 알린다.
    return { usedPlaintext };
  });

  ipcMain.handle('config:has-api-key', () => {
    const freeKey = getSecret('geminiApiKey');
    const paidKey = getSecret('geminiPaidApiKey');
    return [freeKey, paidKey].some(key => key.trim().length > 0);
  });

  ipcMain.handle('config:delete-api-key', (_e, apiTier?: ApiTier) => {
    const target = apiTier || store.get('apiTier') || 'free';
    if (target === 'paid') setSecret('geminiPaidApiKey', '');
    else setSecret('geminiApiKey', '');
  });

  ipcMain.handle('data:read-json', async (_e, name: string) => {
    const file = safeDataFile(name);
    if (!fs.existsSync(file)) return null;
    try {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch (e) {
      // 손상된 JSON 파일은 없는 것처럼 null을 돌려줘 호출부가 안전하게 처리하도록 한다.
      console.warn(`[ipc:data:read-json] 손상된 데이터 파일: ${name}`, e);
      return null;
    }
  });

  ipcMain.handle('data:write-json', async (_e, name: string, data: unknown) => {
    const file = safeDataFile(name);
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
    return file;
  });

  ipcMain.handle('data:get-file-path', (_e, name: string) => safeDataFile(name));

  // 백업 페이로드(설정·데이터 파일·localStorage)를 만든다 — 수동/자동 백업 공용.
  const buildBackupPayload = (localStorageDump?: Record<string, string>) => {
    const safeSettings = stripSecrets(store.store);
    const dataDir = getDataDir();
    const dataFiles: Record<string, unknown> = {};
    for (const fileName of fs.readdirSync(dataDir)) {
      if (!/^[a-zA-Z0-9_-]+\.json$/.test(fileName)) continue;
      const fullPath = path.join(dataDir, fileName);
      try {
        dataFiles[fileName.replace(/\.json$/, '')] = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      } catch (e) {
        // 손상된 JSON 파일은 백업에 포함하지 않습니다.
        console.warn(`[ipc:data:export-backup] 손상된 데이터 파일 제외: ${fileName}`, e);
      }
    }

    // 렌더러 localStorage(공문 히스토리·메뉴 순서·즐겨찾기 등)도 함께 백업합니다.
    const localStorageData = (localStorageDump && typeof localStorageDump === 'object') ? localStorageDump : {};

    return {
      app: 'EduNote',
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      settings: safeSettings,
      dataFiles,
      localStorage: localStorageData,
    };
  };

  ipcMain.handle('data:export-backup', async (_e, localStorageDump?: Record<string, string>) => {
    const saveDir = store.get('saveDir');
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const result = await dialog.showSaveDialog({
      defaultPath: path.join(saveDir || app.getPath('documents'), `edunote_backup_${stamp}.json`),
      filters: [{ name: 'EduNote 백업 파일', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return null;

    fs.writeFileSync(result.filePath, JSON.stringify(buildBackupPayload(localStorageDump), null, 2), 'utf-8');
    return result.filePath;
  });

  // 자동 정기 백업 — 주기가 지났을 때만 대화상자 없이 데이터 폴더의 backups에 저장한다.
  // 주기 전이거나 꺼져 있으면 null을 돌려준다.
  ipcMain.handle('data:auto-backup', async (_e, localStorageDump?: Record<string, string>) => {
    const interval = store.get('autoBackupInterval');
    if (interval !== 'daily' && interval !== 'weekly') return null;
    const last = Date.parse(store.get('lastAutoBackupAt') || '') || 0;
    const dueMs = (interval === 'daily' ? 1 : 7) * 24 * 60 * 60 * 1000;
    if (Date.now() - last < dueMs) return null;

    const backupDir = path.join(getDataDir(), 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const now = new Date();
    const stamp = now.toISOString().slice(0, 10).replace(/-/g, '');
    const filePath = path.join(backupDir, `edunote_backup_${stamp}.json`);
    fs.writeFileSync(filePath, JSON.stringify(buildBackupPayload(localStorageDump), null, 2), 'utf-8');
    store.set('lastAutoBackupAt', now.toISOString());

    // 오래된 자동 백업은 최근 10개만 남긴다
    const files = fs.readdirSync(backupDir).filter(f => /^edunote_backup_\d{8}\.json$/.test(f)).sort();
    for (const f of files.slice(0, Math.max(0, files.length - 10))) {
      try {
        fs.unlinkSync(path.join(backupDir, f));
      } catch {
        // 정리 실패는 다음 백업 때 다시 시도한다.
      }
    }
    return filePath;
  });

  ipcMain.handle('file:open-html-external', async (_e, htmlContent: string, suggestedName?: string) => {
    const baseName = (suggestedName || `edunote_game_${Date.now()}.html`).replace(/[\\/:*?"<>|]/g, '_');
    const fileName = baseName.toLowerCase().endsWith('.html') ? baseName : `${baseName}.html`;
    const filePath = path.join(getSessionTmpDir(), fileName);
    fs.writeFileSync(filePath, htmlContent, 'utf-8');
    const openPathError = await shell.openPath(filePath);
    if (openPathError) await shell.openExternal(pathToFileURL(filePath).toString());
    return filePath;
  });

  ipcMain.handle('data:import-backup', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'EduNote 백업 파일', extensions: ['json'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    let backup;
    try {
      backup = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf-8'));
    } catch {
      throw new Error('백업 파일이 손상되어 읽을 수 없습니다.');
    }
    if (backup?.app !== 'EduNote' || !backup.settings || !backup.dataFiles) {
      throw new Error('EduNote 백업 파일 형식이 아닙니다.');
    }

    for (const [key, value] of Object.entries(backup.settings as Record<string, unknown>)) {
      if (key === 'geminiApiKey' || key === 'geminiPaidApiKey') {
        // Gemini 키는 백업에 포함된 적이 없고, 백업 파일로도 설정할 수 없다.
        continue;
      }
      if (isSecretKey(key)) {
        // 구버전 백업에 평문으로 남아 있던 시크릿은 암호화 저장으로 복원한다. 길이 상한은 일반 설정값과 동일.
        if (typeof value === 'string' && value.trim() && value.length <= MAX_STRING_VALUE_CHARS) setSecret(key, value);
        continue;
      }
      if (ALLOWED_CONFIG_KEYS.includes(key)) {
        const safeValue = sanitizeConfigEntry(key, value);
        if (safeValue === undefined) {
          console.warn(`[ipc:data:import-backup] 무효한 설정값을 건너뜁니다: ${key}`);
          continue;
        }
        store.set(key as any, safeValue as any);
      }
    }

    for (const [name, data] of Object.entries(backup.dataFiles as Record<string, unknown>)) {
      const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '');
      if (!safeName) continue;
      fs.writeFileSync(safeDataFile(safeName), JSON.stringify(data, null, 2), 'utf-8');
    }

    // 구버전(schemaVersion 1) 백업에는 localStorage가 없으므로 빈 객체로 처리합니다.
    // 문자열 값만 추려 렌더러가 localStorage에 그대로 복원합니다.
    const rawLocalStorage = (backup.localStorage && typeof backup.localStorage === 'object') ? backup.localStorage : {};
    const localStorageData: Record<string, string> = {};
    for (const [key, value] of Object.entries(rawLocalStorage as Record<string, unknown>)) {
      if (typeof value === 'string') localStorageData[key] = value;
    }

    return { filePath: result.filePaths[0], localStorage: localStorageData };
  });

  // ── Dialog ────────────────────────────────────────────────────────
  ipcMain.handle('dialog:select-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // ── URL Metadata ─────────────────────────────────────────────────
  ipcMain.handle('url:fetch-meta', async (_e, rawUrl: string) => {
    try {
      const parsed = new URL(rawUrl);
      const { buffer } = await fetchSafely(rawUrl, { timeoutMs: 8000 });
      const html = buffer.toString('utf-8').substring(0, 50000);
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
      const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
      const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
      return {
        title: (titleMatch?.[1] ?? '').trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').substring(0, 120),
        description: ((ogDesc?.[1] ?? metaDesc?.[1] ?? '')).trim().replace(/&amp;/g, '&').substring(0, 300),
        image: ogImage?.[1] ?? '',
        domain: parsed.hostname,
      };
    } catch (e) {
      console.warn('[ipc:url:fetch-meta]', e);
      return { title: '', description: '', image: '', domain: '' };
    }
  });

  // ── Resource Thumbnail ───────────────────────────────────────────
  // Fetch any image URL → base64 data URI (bypasses renderer CSP)
  ipcMain.handle('resource:fetch-image', async (_e, imageUrl: string) => {
    try {
      const { buffer, contentType } = await fetchSafely(imageUrl, { timeoutMs: 10000 });
      const rawMime = contentType.split(';')[0].trim().toLowerCase();
      // content-type이 명시적으로 이미지가 아니면(예: 리다이렉트로 도달한 내부 페이지의 text/html) 거부한다.
      // content-type이 아예 없는 경우는 기존과 동일하게 image/jpeg로 간주한다.
      if (rawMime && !rawMime.startsWith('image/')) return null;
      const mime = rawMime || 'image/jpeg';
      return `data:${mime};base64,${buffer.toString('base64')}`;
    } catch (e) {
      console.warn('[ipc:resource:fetch-image]', e);
      return null;
    }
  });

  ipcMain.handle('resource:youtube-meta', async (_e, rawUrl: string) => {
    const match = rawUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
    const videoId = match?.[1] || '';
    try {
      if (!videoId) return { title: '', description: '', thumbnail: '', videoId: '' };
      const { buffer } = await fetchSafely(rawUrl, { timeoutMs: 8000 });
      const html = buffer.toString('utf-8').substring(0, 120000);
      const titleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
        || html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const descMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
      const title = (titleMatch?.[1] || '').replace(/\s*[-–—]\s*YouTube\s*$/i, '').trim();
      const description = (descMatch?.[1] || '').trim();
      return {
        title,
        description,
        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        videoId,
      };
    } catch (e) {
      console.warn('[ipc:resource:youtube-meta]', e);
      return { title: '', description: '', thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '', videoId };
    }
  });

  // Generate slide image via Gemini image generation
  ipcMain.handle('resource:slide-image', async (_e, imagePrompt: string) => {
    try {
      const { apiKey } = getActiveApi();
      if (!apiKey) return null;
      return await generateSlideImage(apiKey, imagePrompt);
    } catch (e) {
      console.warn('[ipc:resource:slide-image]', e);
      return null;
    }
  });

  // Screenshot a webpage → base64 PNG (for sites with no og:image)
  ipcMain.handle('resource:screenshot', async (_e, rawUrl: string) => {
    let win: BrowserWindow | null = null;
    try {
      assertSafeUrl(rawUrl);
      win = new BrowserWindow({
        width: 1280, height: 800, show: false,
        webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
      });
      // win.loadURL은 net.fetch처럼 리다이렉트를 그대로 따라간다. 최초 URL만 검사하고 끝내면
      // 공인 도메인이 사설 IP·루프백으로 302를 보내는 SSRF를 막지 못하므로, 각 리다이렉트 홉도 검사한다.
      win.webContents.on('will-redirect', (event, redirectUrl) => {
        try {
          assertSafeUrl(redirectUrl);
        } catch {
          event.preventDefault();
        }
      });
      await Promise.race([
        win.loadURL(rawUrl),
        new Promise((_, r) => setTimeout(() => r(new Error('load timeout')), 12000)),
      ]);
      await new Promise(r => setTimeout(r, 1500));
      const image = await win.webContents.capturePage({ x: 0, y: 0, width: 1280, height: 640 });
      const resized = image.resize({ width: 480, height: 240 });
      return `data:image/png;base64,${resized.toPNG().toString('base64')}`;
    } catch (e) {
      console.warn('[ipc:resource:screenshot]', e);
      return null;
    } finally {
      if (win && !win.isDestroyed()) win.destroy();
    }
  });

  // ── Demo Window ───────────────────────────────────────────────────
  // 창 제목은 페이지 로드 후 index.html의 <title>("EduNote")로 되돌아가므로,
  // title 문자열 비교로는 "이미 열려 있는 데모 창"을 찾을 수 없다(항상 새 창이 생김).
  // 창 참조를 직접 들고 있다가 닫히면 비운다.
  let demoWindowRef: BrowserWindow | null = null;
  ipcMain.handle('window:open-demo', () => {
    if (demoWindowRef && !demoWindowRef.isDestroyed()) { demoWindowRef.focus(); return; }

    const win = new BrowserWindow({
      width: 560,
      height: 760,
      minWidth: 480,
      minHeight: 500,
      title: 'EduNote Demo',
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    win.setMenuBarVisibility(false);
    win.on('closed', () => { demoWindowRef = null; });
    demoWindowRef = win;
    if (process.env['ELECTRON_RENDERER_URL']) {
      win.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#demo');
    } else {
      win.loadFile(path.join(__dirname, '../renderer/index.html'), { hash: 'demo' });
    }
  });

  // ── 가격 검색 창 ───────────────────────────────────────────────────
  // 네이버 쇼핑 검색 API는 2026년 7월 31일 종료되어 상품 단가를 받아올 수 없다. 대신 검색 결과
  // 페이지를 열어 사람이 직접 가격을 확인하게 한다 — API 의존이 없어 서비스 종료의 영향을 받지 않는다.
  // 앱 콘텐츠가 아닌 외부 사이트만 보여주므로 preload 없이 격리된 창으로 연다.
  let priceSearchWindowRef: BrowserWindow | null = null;
  ipcMain.handle('window:open-price-search', (_e, itemName: unknown) => {
    const url = buildNaverShoppingSearchUrl(String(itemName ?? ''));
    if (!url) return false;

    if (priceSearchWindowRef && !priceSearchWindowRef.isDestroyed()) {
      priceSearchWindowRef.loadURL(url);
      priceSearchWindowRef.focus();
      return true;
    }

    const win = new BrowserWindow({
      width: 900,
      height: 800,
      minWidth: 480,
      minHeight: 500,
      title: '가격 검색',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        partition: 'persist:price-search',
      },
    });
    win.setMenuBarVisibility(false);
    win.on('closed', () => { priceSearchWindowRef = null; });

    // 쇼핑몰이 내장 브라우저 접속을 막거나 네트워크가 끊기면 빈 창만 남아 "안 열린다"로 보인다.
    // 본문 로드가 실패하면 창을 닫고 사용자의 기본 브라우저로 같은 검색을 연다.
    // ERR_ABORTED(-3)는 페이지 이동 중 흔히 발생하는 정상 취소라 제외한다.
    win.webContents.on('did-fail-load', (_event, errorCode, _desc, _validatedUrl, isMainFrame) => {
      if (!isMainFrame || errorCode === -3) return;
      if (!win.isDestroyed()) win.destroy();
      shell.openExternal(url).catch(() => { /* 기본 브라우저가 없으면 더 할 수 있는 일이 없다 */ });
    });

    // 검색 결과에서 상품을 누르면 새 창 대신 기본 브라우저로 보내, 창이 계속 쌓이지 않게 한다.
    win.webContents.setWindowOpenHandler(({ url: target }) => {
      if (/^https:/i.test(target)) shell.openExternal(target).catch(() => { /* 무시 */ });
      return { action: 'deny' };
    });

    priceSearchWindowRef = win;
    win.loadURL(url);
    return true;
  });

  // ── 연수자료 참고자료 검색 ─────────────────────────────────────────
  // 연수자료 제작에 참고할 교육부·시도교육청 자료를 사람이 직접 찾아 내려받고
  // '참고 자료'로 첨부하도록, 검색 결과를 기본 브라우저에서 연다.
  //
  // 전용 BrowserWindow로 띄우지 않는 이유: index.ts의 will-navigate 정책이 앱 오리진이
  // 아닌 이동을 모두 기본 브라우저로 넘기기 때문에, 구글처럼 최초 로드 후 리다이렉트하는
  // 사이트는 Electron 창이 빈 채로 남고 결과는 브라우저에 뜨는 창 두 개 문제가 생긴다.
  ipcMain.handle('window:open-edu-reference-search', async (_e, topic: unknown) => {
    const url = buildEduReferenceSearchUrl(String(topic ?? ''));
    if (!url) return;
    await shell.openExternal(url);
  });

  // 채팅방의 대화 창을 별도 창으로 띄운다(같은 렌더러를 '#chat'로 로드). QR·접속주소는 본 창에 두고
  // 이 창에는 대화만 표시한다. 이미 열려 있으면 그 창을 앞으로 가져오며, reload가 true면(새 방을 시작한 경우)
  // 그 창을 다시 불러와 새 방의 대화를 보여준다. 이 창을 닫아도 채팅방은 종료되지 않는다(본 창의 "채팅방 종료"로만 종료).
  // 대화 창의 열림/닫힘 상태를 모든 창에 알려, 본 창(채팅방 관리 화면)이 "대화창 열림" 여부를 표시할 수 있게 한다.
  const broadcastChatWindowState = (open: boolean) => {
    for (const w of BrowserWindow.getAllWindows()) {
      if (!w.isDestroyed()) w.webContents.send('chat:window-state', open);
    }
  };

  ipcMain.handle('window:is-chat-open', () =>
    BrowserWindow.getAllWindows().some(w => w.title === 'EduNote 채팅방'));

  ipcMain.handle('window:open-chat', (_e, opts?: { reload?: boolean }) => {
    const existing = BrowserWindow.getAllWindows().find(w => w.title === 'EduNote 채팅방');
    if (existing) {
      if (opts?.reload) existing.webContents.reload();
      existing.focus();
      broadcastChatWindowState(true);
      return;
    }

    const win = new BrowserWindow({
      width: 760,
      height: 900,
      minWidth: 460,
      minHeight: 560,
      title: 'EduNote 채팅방',
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    win.setMenuBarVisibility(false);
    win.on('closed', () => broadcastChatWindowState(false));

    if (process.env['ELECTRON_RENDERER_URL']) {
      win.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#chat');
    } else {
      win.loadFile(path.join(__dirname, '../renderer/index.html'), { hash: 'chat' });
    }
    broadcastChatWindowState(true);
  });

  // ── App ───────────────────────────────────────────────────────────
  ipcMain.handle('app:get-version', () => app.getVersion());

  ipcMain.handle('app:check-update', async () => {
    try {
      const res = await net.fetch(
        'https://api.github.com/repos/codersongpro/edunote/releases/latest',
        { headers: { 'User-Agent': 'edunote-app' }, signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { tag_name?: string; html_url?: string };
      const latestVersion = (json.tag_name || '').replace(/^v/, '');
      const currentVersion = app.getVersion();
      const hasUpdate: boolean = !!latestVersion && semverGt(latestVersion, currentVersion);
      return { currentVersion, latestVersion: latestVersion || null, hasUpdate, releaseUrl: json.html_url || '' };
    } catch (e) {
      console.warn('[ipc:app:check-update]', e);
      return { currentVersion: app.getVersion(), latestVersion: null, hasUpdate: false, releaseUrl: '' };
    }
  });

  // ── JSON File Open (AI스킬즈 가져오기) ──────────────────────────────
  ipcMain.handle('file:open-json', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      filters: [{ name: 'JSON 파일', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (canceled || !filePaths[0]) return null;
    return fs.readFileSync(resolveDialogPath(filePaths[0]), 'utf-8');
  });

  // ── 공유 마켓: 구글 시트 CSV 읽기 ────────────────────────────────────
  ipcMain.handle('data:fetch-market', async (_e, sheetId: string) => {
    const id = encodeURIComponent(sheetId);
    // 1차: 웹에 게시된 시트용 URL
    // 2차: 공유(링크) 시트용 export URL
    const urls = [
      `https://docs.google.com/spreadsheets/d/${id}/pub?output=csv`,
      `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`,
    ];
    let lastError = '';
    for (const csvUrl of urls) {
      try {
        const res = await net.fetch(csvUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 edunote-app' },
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) { lastError = `HTTP ${res.status}`; continue; }
        const text = await res.text();
        // HTML 응답(로그인 페이지 등) 걸러내기
        if (text.trimStart().startsWith('<')) { lastError = '시트가 공개되어 있지 않습니다'; continue; }
        return text;
      } catch (e: any) {
        lastError = e?.message ?? String(e);
      }
    }
    throw new Error(lastError || '시트를 불러오지 못했습니다');
  });

  // ── 공유 마켓: 구글 드라이브 JSON 파일 다운로드 ──────────────────────
  // net.fetch 대신 Node.js https 모듈 사용 — Google Drive Content-Disposition 헤더의
  // net.request 사용: 시스템 SSL 인증서 + 리다이렉트 URL 한글 인코딩 처리
  ipcMain.handle('data:fetch-url-json', async (_e, url: string) => {
    // 최초 URL과 리다이렉트 URL 모두에 assertSafeUrl(netGuard.ts)로 재검사한다.
    const safeUrl = assertSafeUrl(url);

    const encodeUrl = (s: string): string =>
      s.replace(/[^\x00-\x7F]/g, c => encodeURIComponent(c));

    // 리다이렉트를 포함한 전체 요청에 하나의 마감 시각을 둔다(홉마다 리셋되지 않음).
    const TOTAL_TIMEOUT_MS = 20000;
    const deadline = Date.now() + TOTAL_TIMEOUT_MS;

    const fetchUrl = (targetUrl: string, redirectsLeft: number): Promise<string> =>
      new Promise((resolve, reject) => {
        if (redirectsLeft <= 0) { reject(new Error('리다이렉트가 너무 많습니다')); return; }
        try {
          assertSafeUrl(targetUrl);
        } catch (e) {
          reject(e);
          return;
        }
        const remaining = deadline - Date.now();
        if (remaining <= 0) { reject(new Error('연결 시간이 초과되었습니다 (20초)')); return; }

        const req = net.request({ url: encodeUrl(targetUrl), redirect: 'manual' });
        req.setHeader('User-Agent', 'Mozilla/5.0 edunote-app');

        let settled = false;
        // 어떤 경로로 종료되든(응답·리다이렉트·오류·타임아웃) 타이머를 반드시 정리한다.
        const done = (fn: () => void) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          fn();
        };

        const timer = setTimeout(() => {
          done(() => reject(new Error('연결 시간이 초과되었습니다 (20초)')));
          req.abort();
        }, remaining);

        req.on('redirect', (_code, _method, redirectUrl) => {
          done(() => resolve(fetchUrl(redirectUrl, redirectsLeft - 1)));
          req.abort();
        });

        req.on('response', (res) => {
          if (res.statusCode && res.statusCode >= 400) {
            done(() => reject(new Error(`HTTP ${res.statusCode}`)));
            return;
          }
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => done(() => resolve(Buffer.concat(chunks).toString('utf-8'))));
          res.on('error', (e) => done(() => reject(e)));
        });

        req.on('error', (e) => done(() => reject(e)));

        req.end();
      });

    return await fetchUrl(safeUrl, 6);
  });

  // ── 나라장터 물품 검색 ────────────────────────────────────────────
  // 자격증명(인증키·Client Secret)은 렌더러에서 받지 않고 메인 프로세스 저장소에서 직접 읽는다.
  function getNaramarketKey(): string {
    const serviceKey = getSecret('naramarketApiKey').trim();
    if (!serviceKey) throw new Error('나라장터 인증키가 저장되어 있지 않습니다. 예산안작성 화면에서 키를 먼저 저장해주세요.');
    return serviceKey;
  }

  ipcMain.handle('api:naramarket-search', async (_e, { keyword, pageNo = 1 }: { keyword: string; pageNo?: number }) => {
    const serviceKey = getNaramarketKey();
    // ServiceKey: API 문서 명세에 따라 대소문자 정확히 일치해야 함
    const encodedKey = serviceKey.includes('%') ? serviceKey : encodeURIComponent(serviceKey);
    const fetchList = async (queryKey: string) => {
      const params = new URLSearchParams();
      params.set('pageNo', String(pageNo));
      params.set('numOfRows', '30');
      params.set(queryKey, keyword);
      params.set('type', 'json');
      const rawUrl = `https://apis.data.go.kr/1230000/ao/ThngListInfoService/getThngPrdnmLocplcAccotListInfoInfoPrdlstSearch?ServiceKey=${encodedKey}&${params.toString()}`;
      const response = await net.fetch(rawUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 edunote-app' },
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`API 오류: ${response.status} — ${body.slice(0, 500)}`);
      }
      return response.json();
    };

    const responses = await Promise.allSettled([
      fetchList('krnPrdctNm'),
      fetchList('prdctClsfcNoNm'),
      fetchList('dtilPrdctClsfcNoNm'),
    ]);
    const items = responses.flatMap(result => {
      if (result.status !== 'fulfilled') return [];
      return readOpenApiItems(result.value);
    });
    if (items.length > 0) {
      return { response: { body: { items: { item: items } } } };
    }
    return { response: { body: { items: { item: [] } } } };
  });

  ipcMain.handle('api:naramarket-shopping-search', async (_e, { keyword, pageNo = 1 }: { keyword: string; pageNo?: number }) => {
    const serviceKey = getNaramarketKey();
    const encodedKey = serviceKey.includes('%') ? serviceKey : encodeURIComponent(serviceKey);
    const fetchMall = async (queryKey: string) => {
      const params = new URLSearchParams();
      params.set('pageNo', String(pageNo));
      params.set('numOfRows', '30');
      params.set(queryKey, keyword);
      params.set('type', 'json');
      const rawUrl = `https://apis.data.go.kr/1230000/at/ShoppingMallPrdctInfoService/getShoppingMallPrdctInfoList?ServiceKey=${encodedKey}&${params.toString()}`;
      const response = await net.fetch(rawUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 edunote-app' },
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`종합쇼핑몰 API 오류: ${response.status} — ${body.slice(0, 500)}`);
      }
      return response.json();
    };

    const responses = await Promise.allSettled([
      fetchMall('prdctIdntNoNm'),
      fetchMall('prdctClsfcNoNm'),
      fetchMall('dtilPrdctClsfcNoNm'),
    ]);
    const items = responses.flatMap(result => {
      if (result.status !== 'fulfilled') return [];
      return readOpenApiItems(result.value);
    });
    if (items.length > 0) {
      return { response: { body: { items: { item: items } } } };
    }
    return { response: { body: { items: { item: [] } } } };
  });

  // ── PDF Save ──────────────────────────────────────────────────────
  ipcMain.handle('file:save-pdf', async (_e, htmlContent: string, suggestedName: string) => {
    const tmpFile = path.join(getSessionTmpDir(), `edunote_pdf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.html`);
    fs.writeFileSync(tmpFile, htmlContent, 'utf-8');
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        // 메인 창과 분리된 전용(비영속) 세션을 써서, 아래 CSP 헤더 주입이 다른 창에 영향을 주지 않게 한다.
        partition: 'pdf-render',
      },
    });
    // 렌더러가 만든 HTML을 file:// 로 여는 이 창에는 렌더러(index.html)와 달리 CSP가 없어
    // 스크립트·원격 리소스가 제한 없이 로드될 수 있다. sanitizeHtml이 이미 script를
    // 제거하지만, 이 경로는 GeneratedDisplay의 contentEditable에서 편집된 HTML을 그대로
    // 받을 수 있으므로 별도로 한 번 더 막는다.
    win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': ["default-src 'self'; script-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'none';"],
        },
      });
    });
    try {
      await win.loadFile(tmpFile);
      const pdfData = await win.webContents.printToPDF({
        pageSize: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margins: { marginType: 'none' },
      });
      const saveDir = store.get('saveDir');
      const result = await dialog.showSaveDialog({
        defaultPath: path.join(saveDir || app.getPath('documents'), suggestedName),
        filters: [{ name: 'PDF 파일', extensions: ['pdf'] }],
      });
      if (!result.canceled && result.filePath) {
        fs.writeFileSync(result.filePath, pdfData);
        return result.filePath;
      }
      return null;
    } finally {
      win.destroy();
      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    }
  });
}

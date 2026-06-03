import { ipcMain, dialog, shell, app, BrowserWindow, net } from 'electron';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { pathToFileURL } from 'url';
import { store } from './store';
import { ApiTier, generateContent, generateContentMultipart, testApiKey, generateSlideImage, resetModelCache } from './GeminiService';
import { generateHwpx } from './HwpxGenerator';

const ALLOWED_CONFIG_KEYS = ['saveDir', 'appDataDir', 'alwaysAskPath', 'teacherName', 'schoolName', 'institution', 'schoolLevel', 'gradeClass', 'studentNames', 'studentMaleNames', 'studentFemaleNames', 'darkMode', 'apiTier', 'apiKeyLastUsable', 'privacyModeEnabled', 'reviewChecklistEnabled', 'cautionTerms', 'lastBackupAt'];

function validatePath(p: string): string {
  const resolved = path.resolve(p);
  // Prevent path traversal — must be under home or common writable dirs
  return resolved;
}

function getActiveApi(): { apiKey: string; apiTier: ApiTier } {
  const apiTier = (store.get('apiTier') || 'free') as ApiTier;
  const freeKey = store.get('geminiApiKey');
  const paidKey = store.get('geminiPaidApiKey');
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

export function registerIpcHandlers(): void {
  // ── AI Generation ─────────────────────────────────────────────────
  ipcMain.handle('ai:generate', async (_e, prompt: string, systemInstruction?: string, options?: { temperature?: number }) => {
    const { apiKey, apiTier } = getActiveApi();
    if (!apiKey) throw new Error('API 키가 설정되지 않았습니다. 설정에서 Gemini API 키를 입력해주세요.');
    return generateContent(apiKey, prompt, { systemInstruction, ...options, apiTier });
  });

  ipcMain.handle('ai:generate-multipart', async (_e, parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }>, systemInstruction?: string, options?: { temperature?: number }) => {
    const { apiKey, apiTier } = getActiveApi();
    if (!apiKey) throw new Error('API 키가 설정되지 않았습니다. 설정에서 Gemini API 키를 입력해주세요.');
    return generateContentMultipart(apiKey, parts, { systemInstruction, ...options, apiTier });
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
      savePath = path.join(saveDir, suggestedName);
    } else {
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

  ipcMain.handle('file:save-hwpx', async (_e, templateName: string, content: string, meta: Record<string, string>) => {
    const saveDir = store.get('saveDir');
    const title = meta.title || templateName;
    const safeName = title.replace(/[\\/:*?"<>|]/g, '_');
    const result = await dialog.showSaveDialog({
      defaultPath: path.join(saveDir || app.getPath('documents'), `${safeName}.hwpx`),
      filters: [{ name: 'HWPX', extensions: ['hwpx'] }],
    });
    if (result.canceled || !result.filePath) return null;
    await generateHwpx(templateName, content, meta, result.filePath);
    return result.filePath;
  });

  // ── Shell ─────────────────────────────────────────────────────────
  ipcMain.handle('shell:open-folder', async (_e, folderPath: string) => {
    const safe = validatePath(folderPath);
    if (fs.existsSync(safe)) {
      await shell.openPath(safe);
      return true;
    }
    return false;
  });

  ipcMain.handle('shell:open-external', async (_e, url: string) => {
    try {
      if (typeof url !== 'string') return false;
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') return false;
      await shell.openExternal(parsed.href);
      return true;
    } catch {
      return false;
    }
  });

  // ── Config ────────────────────────────────────────────────────────
  ipcMain.handle('config:get', (_e, key: string) => {
    if (key === 'geminiApiKey' || key === 'geminiPaidApiKey') return undefined;
    return store.get(key as keyof typeof store.store);
  });

  ipcMain.handle('config:get-all', () => {
    const all = store.store;
    const { geminiApiKey: _free, geminiPaidApiKey: _paid, ...safe } = all;
    return safe;
  });

  ipcMain.handle('config:set', (_e, data: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(data)) {
      if (key === 'geminiApiKey' || key === 'geminiPaidApiKey') {
        // API key is set via dedicated channel only
        continue;
      }
      if (ALLOWED_CONFIG_KEYS.includes(key)) {
        store.set(key as any, value as any);
      }
    }
    const { geminiApiKey: _free, geminiPaidApiKey: _paid, ...safeSettings } = store.store;
    try {
      fs.writeFileSync(safeDataFile('user-settings'), JSON.stringify(safeSettings, null, 2), 'utf-8');
    } catch {
      // 설정 저장 자체는 electron-store가 처리하므로 폴더 동기화 실패는 무시합니다.
    }
  });

  ipcMain.handle('config:set-api-key', (_e, key: string, apiTier: ApiTier = 'free') => {
    if (typeof key !== 'string') return;
    if (apiTier === 'paid') store.set('geminiPaidApiKey', key.trim());
    else store.set('geminiApiKey', key.trim());
    store.set('apiTier', apiTier);
    resetModelCache();
  });

  ipcMain.handle('config:has-api-key', () => {
    const freeKey = store.get('geminiApiKey');
    const paidKey = store.get('geminiPaidApiKey');
    return [freeKey, paidKey].some(key => typeof key === 'string' && key.trim().length > 0);
  });

  ipcMain.handle('config:delete-api-key', (_e, apiTier?: ApiTier) => {
    const target = apiTier || store.get('apiTier') || 'free';
    if (target === 'paid') store.set('geminiPaidApiKey', '');
    else store.set('geminiApiKey', '');
  });

  ipcMain.handle('data:read-json', async (_e, name: string) => {
    const file = safeDataFile(name);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  });

  ipcMain.handle('data:write-json', async (_e, name: string, data: unknown) => {
    const file = safeDataFile(name);
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
    return file;
  });

  ipcMain.handle('data:get-file-path', (_e, name: string) => safeDataFile(name));

  ipcMain.handle('data:export-backup', async () => {
    const saveDir = store.get('saveDir');
    const now = new Date();
    const stamp = now.toISOString().slice(0, 10).replace(/-/g, '');
    const result = await dialog.showSaveDialog({
      defaultPath: path.join(saveDir || app.getPath('documents'), `edunote_backup_${stamp}.json`),
      filters: [{ name: 'EduNote 백업 파일', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return null;

    const { geminiApiKey: _free, geminiPaidApiKey: _paid, ...safeSettings } = store.store;
    const dataDir = getDataDir();
    const dataFiles: Record<string, unknown> = {};
    for (const fileName of fs.readdirSync(dataDir)) {
      if (!/^[a-zA-Z0-9_-]+\.json$/.test(fileName)) continue;
      const fullPath = path.join(dataDir, fileName);
      try {
        dataFiles[fileName.replace(/\.json$/, '')] = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      } catch {
        // 손상된 JSON 파일은 백업에 포함하지 않습니다.
      }
    }

    const payload = {
      app: 'EduNote',
      schemaVersion: 1,
      exportedAt: now.toISOString(),
      settings: safeSettings,
      dataFiles,
    };
    fs.writeFileSync(result.filePath, JSON.stringify(payload, null, 2), 'utf-8');
    return result.filePath;
  });

  ipcMain.handle('file:open-html-external', async (_e, htmlContent: string, suggestedName?: string) => {
    const baseName = (suggestedName || `edunote_game_${Date.now()}.html`).replace(/[\\/:*?"<>|]/g, '_');
    const fileName = baseName.toLowerCase().endsWith('.html') ? baseName : `${baseName}.html`;
    const dir = path.join(os.tmpdir(), 'edunote-html-preview');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, fileName);
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

    const backup = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf-8'));
    if (backup?.app !== 'EduNote' || !backup.settings || !backup.dataFiles) {
      throw new Error('EduNote 백업 파일 형식이 아닙니다.');
    }

    for (const [key, value] of Object.entries(backup.settings as Record<string, unknown>)) {
      if (ALLOWED_CONFIG_KEYS.includes(key)) {
        store.set(key as any, value as any);
      }
    }

    for (const [name, data] of Object.entries(backup.dataFiles as Record<string, unknown>)) {
      const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '');
      if (!safeName) continue;
      fs.writeFileSync(safeDataFile(safeName), JSON.stringify(data, null, 2), 'utf-8');
    }
    return result.filePaths[0];
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
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('invalid protocol');
      const res = await net.fetch(rawUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = (await res.text()).substring(0, 50000);
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
    } catch {
      return { title: '', description: '', image: '', domain: '' };
    }
  });

  // ── Resource Thumbnail ───────────────────────────────────────────
  // Fetch any image URL → base64 data URI (bypasses renderer CSP)
  ipcMain.handle('resource:fetch-image', async (_e, imageUrl: string) => {
    try {
      const parsed = new URL(imageUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) return null;
      const res = await net.fetch(imageUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return null;
      const ct = res.headers.get('content-type') || 'image/jpeg';
      const mime = ct.split(';')[0].trim();
      const arrayBuffer = await res.arrayBuffer();
      const buf = Buffer.from(arrayBuffer);
      return `data:${mime};base64,${buf.toString('base64')}`;
    } catch {
      return null;
    }
  });

  ipcMain.handle('resource:youtube-meta', async (_e, rawUrl: string) => {
    const match = rawUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
    const videoId = match?.[1] || '';
    try {
      const parsed = new URL(rawUrl);
      if (!['http:', 'https:'].includes(parsed.protocol) || !videoId) return { title: '', description: '', thumbnail: '', videoId: '' };
      const res = await net.fetch(rawUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = (await res.text()).substring(0, 120000);
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
    } catch {
      return { title: '', description: '', thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '', videoId };
    }
  });

  // Generate slide image via Gemini image generation
  ipcMain.handle('resource:slide-image', async (_e, imagePrompt: string) => {
    try {
      const apiKey = store.get('geminiApiKey');
      if (!apiKey) return null;
      return await generateSlideImage(apiKey, imagePrompt);
    } catch {
      return null;
    }
  });

  // Screenshot a webpage → base64 PNG (for sites with no og:image)
  ipcMain.handle('resource:screenshot', async (_e, rawUrl: string) => {
    let win: BrowserWindow | null = null;
    try {
      const parsed = new URL(rawUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) return null;
      win = new BrowserWindow({
        width: 1280, height: 800, show: false,
        webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
      });
      await Promise.race([
        win.loadURL(rawUrl),
        new Promise((_, r) => setTimeout(() => r(new Error('load timeout')), 12000)),
      ]);
      await new Promise(r => setTimeout(r, 1500));
      const image = await win.webContents.capturePage({ x: 0, y: 0, width: 1280, height: 640 });
      const resized = image.resize({ width: 480, height: 240 });
      return `data:image/png;base64,${resized.toPNG().toString('base64')}`;
    } catch {
      return null;
    } finally {
      if (win && !win.isDestroyed()) win.destroy();
    }
  });

  // ── Demo Window ───────────────────────────────────────────────────
  ipcMain.handle('window:open-demo', () => {
    const existing = BrowserWindow.getAllWindows().find(w => w.title === 'EduNote Demo');
    if (existing) { existing.focus(); return; }

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
        sandbox: false,
      },
    });
    win.setMenuBarVisibility(false);
    if (process.env['ELECTRON_RENDERER_URL']) {
      win.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#demo');
    } else {
      win.loadFile(path.join(__dirname, '../renderer/index.html'), { hash: 'demo' });
    }
  });

  // ── App ───────────────────────────────────────────────────────────
  ipcMain.handle('app:get-version', () => app.getVersion());

  function semverGt(a: string, b: string): boolean {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      const d = (pa[i] || 0) - (pb[i] || 0);
      if (d !== 0) return d > 0;
    }
    return false;
  }

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
    } catch {
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
    return fs.readFileSync(validatePath(filePaths[0]), 'utf-8');
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
    let safeUrl: string;
    try {
      safeUrl = new URL(url).href;
    } catch {
      throw new Error('유효하지 않은 URL입니다: ' + url.slice(0, 80));
    }

    const encodeUrl = (s: string): string =>
      s.replace(/[^\x00-\x7F]/g, c => encodeURIComponent(c));

    const fetchUrl = (targetUrl: string, redirectsLeft: number): Promise<string> =>
      new Promise((resolve, reject) => {
        if (redirectsLeft <= 0) { reject(new Error('리다이렉트가 너무 많습니다')); return; }
        let settled = false;
        const done = (fn: () => void) => { if (!settled) { settled = true; fn(); } };

        const req = net.request({ url: encodeUrl(targetUrl), redirect: 'manual' });
        req.setHeader('User-Agent', 'Mozilla/5.0 edunote-app');

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

        const timer = setTimeout(() => {
          done(() => reject(new Error('연결 시간이 초과되었습니다 (20초)')));
          req.abort();
        }, 20000);
        req.on('response', () => clearTimeout(timer));

        req.end();
      });

    return await fetchUrl(safeUrl, 6);
  });

  // ── 나라장터 물품 검색 ────────────────────────────────────────────
  ipcMain.handle('api:naramarket-search', async (_e, { keyword, serviceKey, pageNo = 1 }: { keyword: string; serviceKey: string; pageNo?: number }) => {
    const url = new URL('https://apis.data.go.kr/1230000/ao/ThngListInfoService/getThngListInfo');
    url.searchParams.set('serviceKey', serviceKey);
    url.searchParams.set('pageNo', String(pageNo));
    url.searchParams.set('numOfRows', '30');
    url.searchParams.set('thngNm', keyword);
    url.searchParams.set('type', 'json');
    const response = await net.fetch(url.toString());
    if (!response.ok) throw new Error(`API 오류: ${response.status}`);
    return response.json();
  });

  // ── PDF Save ──────────────────────────────────────────────────────
  ipcMain.handle('file:save-pdf', async (_e, htmlContent: string, suggestedName: string) => {
    const tmpFile = path.join(os.tmpdir(), `edunote_pdf_${Date.now()}.html`);
    fs.writeFileSync(tmpFile, htmlContent, 'utf-8');
    const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true } });
    try {
      await win.loadFile(tmpFile);
      const pdfData = await win.webContents.printToPDF({
        pageSize: 'A4',
        printBackground: true,
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

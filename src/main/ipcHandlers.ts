import { ipcMain, dialog, shell, app, BrowserWindow } from 'electron';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { store } from './store';
import { ApiTier, generateContent, generateContentMultipart, testApiKey, generateSlideImage, resetModelCache } from './GeminiService';
import { generateHwpx } from './HwpxGenerator';

const ALLOWED_CONFIG_KEYS = ['saveDir', 'appDataDir', 'alwaysAskPath', 'teacherName', 'schoolName', 'institution', 'schoolLevel', 'gradeClass', 'studentNames', 'studentMaleNames', 'studentFemaleNames', 'darkMode', 'apiTier', 'apiKeyLastUsable'];

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
    if (typeof url !== 'string' || !url.startsWith('https://')) return false;
    await shell.openExternal(url);
    return true;
  });

  // ── Config ────────────────────────────────────────────────────────
  ipcMain.handle('config:get', (_e, key: string) => {
    if (key === 'geminiApiKey') return undefined;
    return store.get(key as keyof typeof store.store);
  });

  ipcMain.handle('config:get-all', () => {
    const all = store.store;
    const { geminiApiKey: _g, ...safe } = all;
    return safe;
  });

  ipcMain.handle('config:set', (_e, data: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(data)) {
      if (key === 'geminiApiKey') {
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
      const httpMod = parsed.protocol === 'https:' ? await import('https') : await import('http');
      const html = await new Promise<string>((resolve, reject) => {
        const req = httpMod.default.get(rawUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            resolve('');
            return;
          }
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk: string) => { body += chunk; if (body.length > 50000) req.destroy(); });
          res.on('end', () => resolve(body));
        });
        req.on('error', reject);
        req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')); });
      });
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
      const httpMod = parsed.protocol === 'https:' ? await import('https') : await import('http');
      const { buf, ct } = await new Promise<{ buf: Buffer; ct: string }>((resolve, reject) => {
        const req = (httpMod.default as typeof import('https')).get(
          imageUrl,
          { headers: { 'User-Agent': 'Mozilla/5.0' } },
          (res) => {
            const chunks: Buffer[] = [];
            const contentType = (res.headers['content-type'] as string) || 'image/jpeg';
            res.on('data', (c: Buffer) => { chunks.push(Buffer.from(c)); });
            res.on('end', () => resolve({ buf: Buffer.concat(chunks), ct: contentType }));
          },
        );
        req.on('error', reject);
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
      });
      const mime = ct.split(';')[0].trim();
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
      const https = await import('https');
      const html = await new Promise<string>((resolve, reject) => {
        const req = https.default.get(rawUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk: string) => { body += chunk; if (body.length > 120000) req.destroy(); });
          res.on('end', () => resolve(body));
        });
        req.on('error', reject);
        req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')); });
      });
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

  // ── App ───────────────────────────────────────────────────────────
  ipcMain.handle('app:get-version', () => app.getVersion());

  ipcMain.handle('app:check-update', async () => {
    try {
      const https = await import('https');
      const data = await new Promise<string>((resolve, reject) => {
        const req = https.default.get(
          'https://api.github.com/repos/codersongpro/edunote/releases/latest',
          { headers: { 'User-Agent': 'edunote-app' } },
          (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => resolve(body));
          }
        );
        req.on('error', reject);
        req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')); });
      });
      const json = JSON.parse(data);
      const latestTag: string = json.tag_name || '';
      const latestVersion = latestTag.replace(/^v/, '');
      const currentVersion = app.getVersion();
      const hasUpdate = latestVersion && latestVersion !== currentVersion;
      return { currentVersion, latestVersion, hasUpdate, releaseUrl: json.html_url || '' };
    } catch {
      return { currentVersion: app.getVersion(), latestVersion: null, hasUpdate: false, releaseUrl: '' };
    }
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

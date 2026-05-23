import { ipcMain, dialog, shell, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { store } from './store';
import { generateContent, generateContentMultipart, testApiKey } from './GeminiService';
import { generateHwpx } from './HwpxGenerator';

const ALLOWED_CONFIG_KEYS = ['saveDir', 'alwaysAskPath', 'teacherName', 'schoolName', 'schoolLevel', 'darkMode'];

function validatePath(p: string): string {
  const resolved = path.resolve(p);
  // Prevent path traversal — must be under home or common writable dirs
  return resolved;
}

export function registerIpcHandlers(): void {
  // ── AI Generation ─────────────────────────────────────────────────
  ipcMain.handle('ai:generate', async (_e, prompt: string, systemInstruction?: string, options?: { temperature?: number }) => {
    const apiKey = store.get('geminiApiKey');
    if (!apiKey) throw new Error('API 키가 설정되지 않았습니다. 설정에서 Gemini API 키를 입력해주세요.');
    return generateContent(apiKey, prompt, { systemInstruction, ...options });
  });

  ipcMain.handle('ai:generate-multipart', async (_e, parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }>, systemInstruction?: string, options?: { temperature?: number }) => {
    const apiKey = store.get('geminiApiKey');
    if (!apiKey) throw new Error('API 키가 설정되지 않았습니다. 설정에서 Gemini API 키를 입력해주세요.');
    return generateContentMultipart(apiKey, parts, { systemInstruction, ...options });
  });

  ipcMain.handle('ai:test-key', async (_e, key: string) => {
    if (!key || typeof key !== 'string') return false;
    return testApiKey(key);
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
    if (key === 'geminiApiKey') return undefined; // Never expose key
    return store.get(key as keyof typeof store.store);
  });

  ipcMain.handle('config:get-all', () => {
    // Return all config except API key
    const all = store.store;
    const { geminiApiKey: _, ...safe } = all;
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
  });

  ipcMain.handle('config:set-api-key', (_e, key: string) => {
    if (typeof key !== 'string') return;
    store.set('geminiApiKey', key.trim());
  });

  ipcMain.handle('config:has-api-key', () => {
    const key = store.get('geminiApiKey');
    return typeof key === 'string' && key.trim().length > 0;
  });

  // ── Dialog ────────────────────────────────────────────────────────
  ipcMain.handle('dialog:select-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // ── App ───────────────────────────────────────────────────────────
  ipcMain.handle('app:get-version', () => app.getVersion());
}

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // AI Generation
  aiGenerate: (prompt: string, systemInstruction?: string, options?: { temperature?: number }) =>
    ipcRenderer.invoke('ai:generate', prompt, systemInstruction, options),

  aiGenerateMultipart: (
    parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }>,
    systemInstruction?: string,
    options?: { temperature?: number },
  ) => ipcRenderer.invoke('ai:generate-multipart', parts, systemInstruction, options),

  testApiKey: (key: string) => ipcRenderer.invoke('ai:test-key', key),

  // File Save
  saveFile: (content: string, suggestedName: string, ext: string) =>
    ipcRenderer.invoke('file:save', content, suggestedName, ext),

  saveBuffer: (buffer: ArrayBuffer, suggestedName: string) =>
    ipcRenderer.invoke('file:save-buffer', buffer, suggestedName),

  saveTxt: (content: string, suggestedName?: string) =>
    ipcRenderer.invoke('file:save-txt', content, suggestedName),

  saveCsv: (content: string, suggestedName?: string) =>
    ipcRenderer.invoke('file:save-csv', content, suggestedName),

  saveHwpx: (templateName: string, content: string, meta: Record<string, string>) =>
    ipcRenderer.invoke('file:save-hwpx', templateName, content, meta),

  // Shell
  openFolder: (folderPath: string) => ipcRenderer.invoke('shell:open-folder', folderPath),
  openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),

  // Config
  getConfig: (key: string) => ipcRenderer.invoke('config:get', key),
  getAllConfig: () => ipcRenderer.invoke('config:get-all'),
  setConfig: (data: Record<string, unknown>) => ipcRenderer.invoke('config:set', data),
  setApiKey: (key: string) => ipcRenderer.invoke('config:set-api-key', key),
  hasApiKey: () => ipcRenderer.invoke('config:has-api-key'),

  // Dialog
  selectFolder: () => ipcRenderer.invoke('dialog:select-folder'),

  // URL Metadata
  fetchUrlMeta: (url: string) => ipcRenderer.invoke('url:fetch-meta', url),

  // App
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  checkUpdate: () => ipcRenderer.invoke('app:check-update'),

  // PDF Save
  savePdf: (htmlContent: string, suggestedName: string) =>
    ipcRenderer.invoke('file:save-pdf', htmlContent, suggestedName),
});

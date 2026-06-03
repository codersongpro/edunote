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

  testApiKey: (key: string, apiTier?: 'free' | 'paid') => ipcRenderer.invoke('ai:test-key', key, apiTier),
  testStoredApiKey: () => ipcRenderer.invoke('ai:test-stored-key'),

  // File Save
  saveFile: (content: string, suggestedName: string, ext: string) =>
    ipcRenderer.invoke('file:save', content, suggestedName, ext),

  saveBuffer: (buffer: ArrayBuffer, suggestedName: string) =>
    ipcRenderer.invoke('file:save-buffer', buffer, suggestedName),

  saveTxt: (content: string, suggestedName?: string) =>
    ipcRenderer.invoke('file:save-txt', content, suggestedName),

  exportHtml: (content: string, suggestedName?: string) =>
    ipcRenderer.invoke('file:export-html', content, suggestedName),

  saveCsv: (content: string, suggestedName?: string) =>
    ipcRenderer.invoke('file:save-csv', content, suggestedName),

  saveHwpx: (templateName: string, content: string, meta: Record<string, string>) =>
    ipcRenderer.invoke('file:save-hwpx', templateName, content, meta),

  openHtmlExternal: (htmlContent: string, suggestedName?: string) =>
    ipcRenderer.invoke('file:open-html-external', htmlContent, suggestedName),

  // Shell
  openFolder: (folderPath: string) => ipcRenderer.invoke('shell:open-folder', folderPath),
  openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),

  // Config
  getConfig: (key: string) => ipcRenderer.invoke('config:get', key),
  getAllConfig: () => ipcRenderer.invoke('config:get-all'),
  setConfig: (data: Record<string, unknown>) => ipcRenderer.invoke('config:set', data),
  setApiKey: (key: string, apiTier?: 'free' | 'paid') => ipcRenderer.invoke('config:set-api-key', key, apiTier),
  hasApiKey: () => ipcRenderer.invoke('config:has-api-key'),
  deleteApiKey: (apiTier?: 'free' | 'paid') => ipcRenderer.invoke('config:delete-api-key', apiTier),
  readJsonData: (name: string) => ipcRenderer.invoke('data:read-json', name),
  writeJsonData: (name: string, data: unknown) => ipcRenderer.invoke('data:write-json', name, data),
  getJsonDataPath: (name: string) => ipcRenderer.invoke('data:get-file-path', name),
  exportBackup: () => ipcRenderer.invoke('data:export-backup'),
  importBackup: () => ipcRenderer.invoke('data:import-backup'),

  // Dialog
  selectFolder: () => ipcRenderer.invoke('dialog:select-folder'),

  // URL Metadata & Resource thumbnails
  fetchUrlMeta: (url: string) => ipcRenderer.invoke('url:fetch-meta', url),
  fetchYoutubeMeta: (url: string) => ipcRenderer.invoke('resource:youtube-meta', url),
  fetchImage: (url: string) => ipcRenderer.invoke('resource:fetch-image', url),
  screenshotUrl: (url: string) => ipcRenderer.invoke('resource:screenshot', url),
  fetchSlideImage: (keyword: string) => ipcRenderer.invoke('resource:slide-image', keyword),

  // Window
  openDemoWindow: () => ipcRenderer.invoke('window:open-demo'),

  // App
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  checkUpdate: () => ipcRenderer.invoke('app:check-update'),

  // PDF Save
  savePdf: (htmlContent: string, suggestedName: string) =>
    ipcRenderer.invoke('file:save-pdf', htmlContent, suggestedName),

  // AI스킬즈
  openJsonFile: (): Promise<string | null> => ipcRenderer.invoke('file:open-json'),
  fetchMarket: (sheetId: string): Promise<string> => ipcRenderer.invoke('data:fetch-market', sheetId),
  fetchUrlJson: (url: string): Promise<string> => ipcRenderer.invoke('data:fetch-url-json', url),

  // 나라장터 물품 검색
  naramarketSearch: (keyword: string, serviceKey: string, pageNo?: number) =>
    ipcRenderer.invoke('api:naramarket-search', { keyword, serviceKey, pageNo }),
  naramarketShoppingSearch: (keyword: string, serviceKey: string, pageNo?: number) =>
    ipcRenderer.invoke('api:naramarket-shopping-search', { keyword, serviceKey, pageNo }),
});

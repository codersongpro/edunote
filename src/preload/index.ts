import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // AI Generation
  aiGenerate: (prompt: string, systemInstruction?: string, options?: { temperature?: number; maxOutputTokens?: number; responseJson?: boolean; useSearchGrounding?: boolean; requireSearchGrounding?: boolean }) =>
    ipcRenderer.invoke('ai:generate', prompt, systemInstruction, options),

  aiGenerateMultipart: (
    parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }>,
    systemInstruction?: string,
    options?: { temperature?: number; maxOutputTokens?: number; responseJson?: boolean; useSearchGrounding?: boolean; requireSearchGrounding?: boolean },
  ) => ipcRenderer.invoke('ai:generate-multipart', parts, systemInstruction, options),

  aiGenerateMultipartStream: (
    parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }>,
    systemInstruction: string | undefined,
    options: { temperature?: number; maxOutputTokens?: number; responseJson?: boolean; useSearchGrounding?: boolean; requireSearchGrounding?: boolean } | undefined,
    onEvent: (event: { type: 'start' | 'chunk'; text?: string }) => void,
  ) => {
    const requestId = `stream-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const listener = (_event: unknown, payload: { requestId?: string; type?: string; text?: string }) => {
      if (payload?.requestId !== requestId) return;
      if (payload.type === 'start' || payload.type === 'chunk') {
        onEvent({ type: payload.type, text: payload.text });
      }
    };
    ipcRenderer.on('ai:stream-event', listener as never);
    return ipcRenderer.invoke('ai:generate-multipart-stream', requestId, parts, systemInstruction, options)
      .finally(() => { ipcRenderer.removeListener('ai:stream-event', listener as never); });
  },

  getModelInfo: (forceRefresh?: boolean) => ipcRenderer.invoke('ai:model-info', forceRefresh),
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
  openCsvFile: (): Promise<{ filePath: string; content: string } | null> =>
    ipcRenderer.invoke('file:open-csv'),

  saveHwpx: (templateName: string, content: string, meta: Record<string, string>) =>
    ipcRenderer.invoke('file:save-hwpx', templateName, content, meta),

  openHtmlExternal: (htmlContent: string, suggestedName?: string) =>
    ipcRenderer.invoke('file:open-html-external', htmlContent, suggestedName),

  // Clipboard — QR 이미지를 OS 클립보드에 그림으로 넣는다(성공 여부 반환).
  copyImageToClipboard: (dataUrl: string): Promise<boolean> =>
    ipcRenderer.invoke('clipboard:write-image', dataUrl),

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
  exportBackup: (localStorageDump?: Record<string, string>) => ipcRenderer.invoke('data:export-backup', localStorageDump),
  inspectBackup: () => ipcRenderer.invoke('data:inspect-backup'),
  restoreBackup: (inspectionId: string) => ipcRenderer.invoke('data:restore-backup', inspectionId),
  commitBackupRestore: (restoreId: string) => ipcRenderer.invoke('data:commit-backup-restore', restoreId),
  rollbackBackupRestore: (restoreId: string) => ipcRenderer.invoke('data:rollback-backup-restore', restoreId),
  autoBackup: (localStorageDump?: Record<string, string>) => ipcRenderer.invoke('data:auto-backup', localStorageDump),

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
  openPriceSearchWindow: (itemName: string) => ipcRenderer.invoke('window:open-price-search', itemName),
  openEduReferenceSearchWindow: (topic: string) => ipcRenderer.invoke('window:open-edu-reference-search', topic),
  openChatWindow: (opts?: { reload?: boolean }) => ipcRenderer.invoke('window:open-chat', opts),
  isChatWindowOpen: (): Promise<boolean> => ipcRenderer.invoke('window:is-chat-open'),
  onChatWindowState: (callback: (open: boolean) => void) => {
    const listener = (_e: unknown, open: boolean) => callback(!!open);
    ipcRenderer.on('chat:window-state', listener as never);
    return () => ipcRenderer.removeListener('chat:window-state', listener as never);
  },

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

  // 나라장터 물품 검색 — 자격증명은 메인 프로세스 저장소에서 읽으므로 전달하지 않는다.
  naramarketSearch: (keyword: string, pageNo?: number) =>
    ipcRenderer.invoke('api:naramarket-search', { keyword, pageNo }),
  naramarketShoppingSearch: (keyword: string, pageNo?: number) =>
    ipcRenderer.invoke('api:naramarket-shopping-search', { keyword, pageNo }),
  hasNaramarketKey: (): Promise<boolean> => ipcRenderer.invoke('config:has-naramarket-key'),
});

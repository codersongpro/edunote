export interface ElectronAPI {
  aiGenerate(prompt: string, systemInstruction?: string, options?: { temperature?: number; maxOutputTokens?: number; responseJson?: boolean }): Promise<{ text: string; model: string }>;
  aiGenerateMultipart(
    parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }>,
    systemInstruction?: string,
    options?: { temperature?: number; maxOutputTokens?: number; responseJson?: boolean },
  ): Promise<{ text: string; model: string }>;
  aiGenerateMultipartStream(
    parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }>,
    systemInstruction: string | undefined,
    options: { temperature?: number; maxOutputTokens?: number; responseJson?: boolean } | undefined,
    onEvent: (event: { type: 'start' | 'chunk'; text?: string }) => void,
  ): Promise<{ text: string; model: string }>;
  testApiKey(key: string, apiTier?: 'free' | 'paid'): Promise<{ ok: boolean; warning?: string; error?: string; wait?: boolean }>;
  testStoredApiKey(): Promise<{ ok: boolean; warning?: string; error?: string; wait?: boolean }>;

  saveFile(content: string, suggestedName: string, ext: string): Promise<string | null>;
  saveBuffer(buffer: ArrayBuffer, suggestedName: string): Promise<string | null>;
  saveTxt(content: string, suggestedName?: string): Promise<string | null>;
  exportHtml(content: string, suggestedName?: string): Promise<string | null>;
  saveCsv(content: string, suggestedName?: string): Promise<string | null>;
  openCsvFile(): Promise<{ filePath: string; content: string } | null>;
  saveHwpx(templateName: string, content: string, meta: Record<string, string>): Promise<string | null>;
  savePdf(htmlContent: string, suggestedName: string): Promise<string | null>;
  openHtmlExternal(htmlContent: string, suggestedName?: string): Promise<string | null>;

  openFolder(folderPath: string): Promise<boolean>;
  openExternal(url: string): Promise<boolean>;

  getConfig(key: string): Promise<unknown>;
  getAllConfig(): Promise<Record<string, unknown>>;
  setConfig(data: Record<string, unknown>): Promise<void>;
  setApiKey(key: string, apiTier?: 'free' | 'paid'): Promise<{ usedPlaintext: boolean }>;
  hasApiKey(): Promise<boolean>;
  deleteApiKey(apiTier?: 'free' | 'paid'): Promise<void>;
  readJsonData(name: string): Promise<unknown>;
  writeJsonData(name: string, data: unknown): Promise<string>;
  getJsonDataPath(name: string): Promise<string>;
  exportBackup(localStorageDump?: Record<string, string>): Promise<string | null>;
  importBackup(): Promise<{ filePath: string; localStorage: Record<string, string> } | null>;
  autoBackup(localStorageDump?: Record<string, string>): Promise<string | null>;

  selectFolder(): Promise<string | null>;
  fetchUrlMeta(url: string): Promise<{ title: string; description: string; image: string; domain: string }>;
  fetchYoutubeMeta(url: string): Promise<{ title: string; description: string; thumbnail: string; videoId: string }>;
  fetchImage(url: string): Promise<string | null>;
  screenshotUrl(url: string): Promise<string | null>;
  fetchSlideImage(keyword: string): Promise<string | null>;
  openDemoWindow(): Promise<void>;
  openPriceSearchWindow(itemName: string): Promise<void>;
  openChatWindow(opts?: { reload?: boolean }): Promise<void>;
  isChatWindowOpen(): Promise<boolean>;
  onChatWindowState(callback: (open: boolean) => void): () => void;
  getVersion(): Promise<string>;
  checkUpdate(): Promise<{ currentVersion: string; latestVersion: string | null; hasUpdate: boolean; releaseUrl: string }>;

  openJsonFile(): Promise<string | null>;
  fetchMarket(sheetId: string): Promise<string>;
  fetchUrlJson(url: string): Promise<string>;
  naramarketSearch(keyword: string, pageNo?: number): Promise<unknown>;
  naramarketShoppingSearch(keyword: string, pageNo?: number): Promise<unknown>;
  naverShoppingSearch(keyword: string, pageNo?: number): Promise<unknown>;
  hasNaverShoppingSecret(): Promise<boolean>;
  hasNaramarketKey(): Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export interface ElectronAPI {
  aiGenerate(prompt: string, systemInstruction?: string, options?: { temperature?: number }): Promise<string>;
  aiGenerateMultipart(
    parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }>,
    systemInstruction?: string,
    options?: { temperature?: number },
  ): Promise<string>;
  testApiKey(key: string): Promise<boolean>;

  saveFile(content: string, suggestedName: string, ext: string): Promise<string | null>;
  saveBuffer(buffer: ArrayBuffer, suggestedName: string): Promise<string | null>;
  saveTxt(content: string, suggestedName?: string): Promise<string | null>;
  saveCsv(content: string, suggestedName?: string): Promise<string | null>;
  saveHwpx(templateName: string, content: string, meta: Record<string, string>): Promise<string | null>;
  savePdf(htmlContent: string, suggestedName: string): Promise<string | null>;

  openFolder(folderPath: string): Promise<boolean>;
  openExternal(url: string): Promise<boolean>;

  getConfig(key: string): Promise<unknown>;
  getAllConfig(): Promise<Record<string, unknown>>;
  setConfig(data: Record<string, unknown>): Promise<void>;
  setApiKey(key: string): Promise<void>;
  hasApiKey(): Promise<boolean>;

  selectFolder(): Promise<string | null>;
  fetchUrlMeta(url: string): Promise<{ title: string; description: string; image: string; domain: string }>;
  fetchImage(url: string): Promise<string | null>;
  screenshotUrl(url: string): Promise<string | null>;
  fetchSlideImage(keyword: string): Promise<string | null>;
  getVersion(): Promise<string>;
  checkUpdate(): Promise<{ currentVersion: string; latestVersion: string | null; hasUpdate: boolean; releaseUrl: string }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

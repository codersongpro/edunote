import { app, BrowserWindow, nativeImage } from 'electron';
import { join } from 'path';
import { registerIpcHandlers } from './ipcHandlers';

function getAppIcon() {
  try {
    const iconPath = join(__dirname, '../../build/icon.ico');
    return nativeImage.createFromPath(iconPath);
  } catch {
    return undefined;
  }
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'EduNote',
    icon: getAppIcon(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools();
  }

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

registerIpcHandlers();

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

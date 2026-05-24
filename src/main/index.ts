import { app, BrowserWindow, nativeImage, Menu, shell, dialog } from 'electron';
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

function buildAppMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '파일',
      submenu: [{ role: 'quit', label: '종료' }],
    },
    {
      label: '편집',
      submenu: [
        { role: 'undo', label: '실행 취소' },
        { role: 'redo', label: '다시 실행' },
        { type: 'separator' },
        { role: 'cut', label: '잘라내기' },
        { role: 'copy', label: '복사' },
        { role: 'paste', label: '붙여넣기' },
        { role: 'selectAll', label: '모두 선택' },
      ],
    },
    {
      label: '도움말',
      submenu: [
        { label: `EduNote v${app.getVersion()}`, enabled: false },
        { type: 'separator' },
        { label: '개발자: 송동석 (교사)', enabled: false },
        {
          label: '이메일 문의: dungst.me@gmail.com',
          click: () => shell.openExternal('mailto:dungst.me@gmail.com?subject=EduNote 문의'),
        },
        { type: 'separator' },
        {
          label: '사용 주의사항',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: '사용 주의사항',
              message: 'EduNote 사용 시 주의사항',
              detail: [
                '1. AI 생성 결과는 반드시 검토 후 활용하세요.',
                '2. 학생 개인정보(이름 등)는 프롬프트에 최소한으로 입력하세요.',
                '3. 생기부 기재 시 최신 기재요령을 직접 확인하세요.',
                '4. API 키는 타인과 공유하지 마세요.',
                '5. 생성된 문서는 교사가 최종 책임자로서 검수하세요.',
                '',
                '* 무료 Gemini API 키는 분당 15회 요청 제한이 있습니다.',
              ].join('\n'),
              buttons: ['확인'],
            });
          },
        },
        {
          label: '협업·피드백 환영합니다',
          click: () => shell.openExternal('mailto:dungst.me@gmail.com?subject=EduNote 피드백'),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  buildAppMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

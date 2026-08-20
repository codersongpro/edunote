import { app, BrowserWindow, nativeImage, Menu, shell, dialog } from 'electron';
import { existsSync } from 'fs';
import { join } from 'path';
import { registerIpcHandlers, cleanupSessionTmpDir, migrateApiKeysToSafeStorage } from './ipcHandlers';

// 예기치 못한 메인 프로세스 오류를 조용히 흘려보내지 않고 로그로 남겨 진단을 돕는다(동작 변경 없음).
process.on('uncaughtException', (err) => {
  console.error('[main] uncaughtException:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[main] unhandledRejection:', reason);
});

function getAppIcon() {
  try {
    const iconPath = [
      join(process.resourcesPath || '', 'build', 'icon.ico'),
      join(app.getAppPath(), 'build', 'icon.ico'),
      join(__dirname, '../../build/icon.ico'),
      join(__dirname, '../../../build/icon.ico'),
    ].find(path => path && existsSync(path));
    if (!iconPath) return undefined;
    return nativeImage.createFromPath(iconPath);
  } catch {
    return undefined;
  }
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1000,
    minHeight: 600,
    title: 'EduNote',
    icon: getAppIcon(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: true,
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
        { label: '개발자: Dustin', enabled: false },
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
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// 데스크톱 앱에서 Web Audio API 즉시 재생 허용 (사용자 제스처 없이도 소리 재생)
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// 모든 웹 콘텐츠(메인 창·webview 게스트)에 공통 보안 정책을 적용한다.
app.on('web-contents-created', (_event, contents) => {
  // 카메라·마이크·위치·알림 등 모든 권한 요청을 기본 거부한다. EduNote는 이런 권한이
  // 필요 없고, 자료실 webview로 여는 임의 사이트가 사용자 개입 없이 권한을 얻지 못하게 한다.
  contents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  contents.session.setPermissionCheckHandler(() => false);

  // 자료실 webview가 임의의 preload·nodeIntegration을 갖지 못하게 하고,
  // http(s) 외 주소(file: 등)는 webview에 붙이지 않는다.
  contents.on('will-attach-webview', (event, webPreferences, params) => {
    delete (webPreferences as { preload?: string }).preload;
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    const src = String(params.src || '');
    if (src && src !== 'about:blank' && !/^https?:\/\//i.test(src)) {
      event.preventDefault();
    }
  });

  // 앱 본 창(webview 게스트 제외)이 외부 오리진으로 이동하면 preload가 다시 붙어
  // electronAPI가 외부 콘텐츠에 노출된다. 앱 자신(file: 또는 개발 서버) 외 이동을 막고
  // http(s) 주소는 기본 브라우저로 넘긴다. (자료실 webview는 임의 사이트 탐색이 목적이므로 제외)
  if (contents.getType() === 'window') {
    // 창 내용이 그려지지 않는 문제(하얀 빈 화면 등)를 조용히 묻어두지 않고 원인을 알린다.
    // 렌더러 프로세스가 죽거나(보안 소프트웨어의 프로세스 차단 등), 페이지 로드 자체가
    // 실패하면 사용자에게 안내하고 콘솔에 상세를 남겨 다음 진단에 활용한다.
    contents.on('render-process-gone', (_event, details) => {
      console.error('[main] render-process-gone:', details);
      if (details.reason !== 'clean-exit') {
        dialog.showErrorBox(
          '화면을 표시할 수 없습니다',
          `창의 렌더링 프로세스가 예기치 않게 종료되었습니다 (원인: ${details.reason}).\n` +
            '보안 소프트웨어(백신)나 그룹 정책이 앱 실행을 제한하고 있을 수 있습니다.\n' +
            '문제가 계속되면 이 메시지와 함께 문의해 주세요.',
        );
      }
    });
    contents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      if (errorCode === -3) return; // ERR_ABORTED — 정상적인 취소/리다이렉트
      console.error('[main] did-fail-load:', errorCode, errorDescription, validatedURL);
    });
    contents.on('unresponsive', () => {
      console.error('[main] webContents unresponsive:', contents.getTitle());
    });

    contents.on('will-navigate', (event, url) => {
      const devUrl = process.env['ELECTRON_RENDERER_URL'];
      let isAppOrigin = false;
      try {
        const target = new URL(url);
        if (target.protocol === 'file:') {
          isAppOrigin = true;
        } else if (devUrl) {
          isAppOrigin = target.origin === new URL(devUrl).origin;
        }
      } catch {
        // 파싱 실패 시 앱 오리진이 아닌 것으로 간주한다.
      }
      if (isAppOrigin) return;
      event.preventDefault();
      try {
        if (['http:', 'https:'].includes(new URL(url).protocol)) shell.openExternal(url);
      } catch {
        // 잘못된 URL은 무시한다.
      }
    });
  }

  // webview 안에서 새 창을 띄우려 하면 https 주소만 기본 브라우저로 연다.
  contents.setWindowOpenHandler(({ url }) => {
    try {
      if (new URL(url).protocol === 'https:') shell.openExternal(url);
    } catch {
      // 잘못된 URL은 무시한다.
    }
    return { action: 'deny' };
  });
});

app.whenReady().then(() => {
  // safeStorage는 app ready 이후에만 쓸 수 있으므로 여기서 평문 키를 암호화 저장으로 이관한다.
  migrateApiKeysToSafeStorage();
  buildAppMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  cleanupSessionTmpDir();
});

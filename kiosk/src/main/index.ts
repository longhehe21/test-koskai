import { app, BrowserWindow, shell, session } from 'electron';
import { join } from 'path';
import { registerTtsHandlers } from './ipc/tts.handler';
import { registerSttHandlers } from './ipc/stt.handler';
import { registerLlmHandlers } from './ipc/llm.handler';

const isKioskMode = process.env.KIOSK_MODE !== 'false';
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    kiosk: isKioskMode && !isDev,
    fullscreen: isKioskMode && !isDev,
    frame: !isKioskMode,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media');
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'] ?? 'http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return win;
}

app.whenReady().then(() => {
  if (!isDev) {
    // C3: CSP dùng env var, không hardcode IP
    const musetalkUrl = process.env.RENDERER_VITE_MUSETALK_URL ?? '';
    const musetalkOrigin = musetalkUrl.replace(/^ws/, 'http').replace('/avatar', '');
    const musetalkWsOrigin = musetalkUrl.replace('/avatar', '');

    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            [
              "default-src 'self'",
              "script-src 'self'",
              "style-src 'self' 'unsafe-inline'",
              `connect-src 'self' ${musetalkWsOrigin} ${musetalkOrigin}`,
              "img-src 'self' blob: data:",
              "media-src 'self' blob:",
              "font-src 'self' data:",
            ].join('; '),
          ],
        },
      });
    });
  } else {
    // Dev: override CSP với policy thoáng, cho phép WebSocket MuseTalk
    // Dùng override thay vì delete vì Electron nhận headers dưới dạng lowercase array —
    // delete không đáng tin cậy khi Vite dev server đã gắn CSP vào response.
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const headers = { ...details.responseHeaders };
      // Xoá cả hai variant trước khi set lại (phòng trường hợp casing khác nhau)
      delete headers['content-security-policy'];
      delete headers['Content-Security-Policy'];
      headers['Content-Security-Policy'] = [
        [
          "default-src * 'unsafe-inline' 'unsafe-eval'",
          'connect-src * ws: wss:',
          'img-src * blob: data:',
          'media-src * blob:',
          'font-src * data:',
        ].join('; '),
      ];
      callback({ responseHeaders: headers });
    });
  }

  registerTtsHandlers();
  registerSttHandlers();
  registerLlmHandlers();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

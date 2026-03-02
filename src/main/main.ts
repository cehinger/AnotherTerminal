import { app, BrowserWindow, globalShortcut } from 'electron';
import * as path from 'path';
import { registerIPC } from './ipc';
import { disconnectAll } from './ssh';

// Separate userData for dev vs prod to avoid data contamination
if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
  app.setPath('userData', path.join(app.getPath('userData'), '..', 'another-terminal-dev'));
}

let mainWindow: BrowserWindow | null = null;

function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

function createWindow(): void {
  const isMac = process.platform === 'darwin';
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'AnotherTerminal',
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    trafficLightPosition: isMac ? { x: 12, y: 14 } : undefined,
    frame: isMac,
    backgroundColor: '#1a1b1f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),  // same dir as main.js
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    show: false,
  });

  // Load the app
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    mainWindow.loadURL('http://localhost:6173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'renderer', 'index.html'));
  }

  // Debug: Check if preload loaded
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Window loaded');
    mainWindow?.webContents.executeJavaScript('console.log("electronAPI available:", !!window.electronAPI)')
      .then(result => console.log('electronAPI check:', result))
      .catch(err => console.error('electronAPI check error:', err));
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Register IPC handlers once for the entire app lifetime
  registerIPC(getMainWindow);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  disconnectAll();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  disconnectAll();
});

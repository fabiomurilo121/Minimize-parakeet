/* Redutor de Imagens - Electron main process (stub)
   Janela principal + janela de configuracoes + IPC basico. */

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');

let mainWindow = null;
let settingsWindow = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#F9FAFB',
    title: 'Redutor de Imagens',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

function createSettingsWindow() {
  if (settingsWindow) { settingsWindow.focus(); return; }
  settingsWindow = new BrowserWindow({
    width: 820,
    height: 720,
    minWidth: 640,
    parent: mainWindow,
    backgroundColor: '#F9FAFB',
    title: 'Configuracoes - Redutor de Imagens',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  settingsWindow.loadFile(path.join(__dirname, 'renderer', 'settings.html'));
  settingsWindow.on('closed', () => { settingsWindow = null; });
}

/* Single-instance lock */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      mainWindow.webContents.send('files:from-argv', parseFilesFromArgv(argv));
    }
  });
}

function parseFilesFromArgv(argv) {
  const imageExts = new Set(['.jpg', '.jpeg', '.png', '.webp']);
  return argv.slice(1)
    .filter(a => imageExts.has(path.extname(a).toLowerCase()))
    .map((p, i) => ({
      id: 'a' + i,
      name: path.basename(p),
      ext: path.extname(p).slice(1).toLowerCase(),
      w: 0, h: 0, size: 0,
      status: 'pending',
      path: p,
    }));
}

/* IPC Handlers */
ipcMain.handle('files:open-dialog', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    title: 'Selecionar imagens',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Imagens', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
  });
  if (r.canceled) return [];
  return r.filePaths.map((p, i) => ({
    id: 'd' + i,
    name: path.basename(p),
    ext: path.extname(p).slice(1).toLowerCase(),
    w: 0, h: 0, size: 0,
    status: 'pending',
    path: p,
  }));
});

ipcMain.handle('folder:pick', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    title: 'Escolher pasta de destino',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (r.canceled) return null;
  return r.filePaths[0];
});

ipcMain.handle('folder:open-output', () => {
  shell.openPath(app.getPath('downloads'));
  return true;
});

ipcMain.handle('settings:save', async (_e, settings) => {
  const fs = require('fs').promises;
  const file = path.join(app.getPath('userData'), 'settings.json');
  await fs.writeFile(file, JSON.stringify(settings, null, 2));
  return true;
});

ipcMain.on('window:open-settings', () => createSettingsWindow());

app.whenReady().then(createMainWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});
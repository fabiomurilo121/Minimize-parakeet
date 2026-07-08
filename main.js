/**
 * Redutor de Imagens — Electron Main Process
 *
 * Responsabilidades:
 *  - Criar e gerenciar janelas (main, settings, quick action)
 *  - IPC handler para filesystem, processamento de imagens, dialogs
 *  - Detectar arquivos passados via CLI (menu de contexto / drag-onto-icon)
 *  - Registrar protocolo custom (opcional) e Single Instance Lock
 */

const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const { Worker } = require('worker_threads');

// ── Single Instance Lock ──────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

let mainWindow = null;
let settingsWindow = null;
let quickActionWindow = null;
let pendingFiles = [];          // arquivos passados via CLI
const activeWorkers = new Map(); // jobId → Worker

// ── Argumentos de linha de comando ────────────────────────────────────
function extractCliFiles(argv) {
  // Pega tudo depois de flags conhecidas, ignora o electron e o .js path
  const skip = new Set(['.', '--dev', '--enable-logging']);
  return argv.slice(1).filter(a => {
    if (skip.has(a)) return false;
    if (a.startsWith('--')) return false;
    if (a.startsWith('-')) return false;
    // só considera caminhos que existem
    try {
      return fs.existsSync(a) && fs.statSync(a).isFile();
    } catch { return false; }
  });
}

// ── Criação de janelas ────────────────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'Redutor de Imagens',
    backgroundColor: '#fafafa',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 880,
    height: 760,
    minWidth: 720,
    minHeight: 600,
    title: 'Configurações — Redutor de Imagens',
    backgroundColor: '#fafafa',
    autoHideMenuBar: true,
    parent: mainWindow,
    modal: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  settingsWindow.loadFile(path.join(__dirname, 'renderer', 'settings.html'));
  settingsWindow.on('closed', () => { settingsWindow = null; });
}

function createQuickActionWindow(files = []) {
  if (quickActionWindow && !quickActionWindow.isDestroyed()) {
    quickActionWindow.focus();
    quickActionWindow.webContents.send('quick-action:set-files', files);
    return;
  }
  quickActionWindow = new BrowserWindow({
    width: 540,
    height: 720,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: 'Reduzir Imagens',
    backgroundColor: '#1a1d29',
    autoHideMenuBar: true,
    parent: mainWindow,
    modal: false,
    alwaysOnTop: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  quickActionWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'), {
    hash: 'quick-action',
  });

  quickActionWindow.webContents.once('did-finish-load', () => {
    quickActionWindow.webContents.send('quick-action:set-files', files);
  });

  quickActionWindow.on('closed', () => { quickActionWindow = null; });
}

// ── Lifecycle ─────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // Suprime menu nativo (vamos usar nossa top bar)
  Menu.setApplicationMenu(null);

  pendingFiles = extractCliFiles(process.argv);

  createMainWindow();

  // Se veio com arquivos e tem quick-action mode, abre modal
  const quickMode = process.argv.includes('--quick');
  if (pendingFiles.length > 0 && quickMode) {
    createQuickActionWindow(pendingFiles);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('second-instance', (_event, argv) => {
  const files = extractCliFiles(argv);
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    if (files.length > 0) {
      mainWindow.webContents.send('main:incoming-files', files);
    }
  }
});

app.on('window-all-closed', () => {
  // Mata workers ainda ativos
  for (const w of activeWorkers.values()) {
    try { w.terminate(); } catch {}
  }
  if (process.platform !== 'darwin') app.quit();
});

// ── IPC: Filesystem ───────────────────────────────────────────────────
ipcMain.handle('fs:open-dialog', async (event, options = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, {
    title: 'Selecionar imagens',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Imagens', extensions: ['jpg', 'jpeg', 'png', 'webp'] },
      { name: 'Todos os arquivos', extensions: ['*'] },
    ],
    ...options,
  });
  if (result.canceled) return [];
  return result.filePaths.map(p => ({
    path: p,
    name: path.basename(p),
  }));
});

ipcMain.handle('fs:open-folder-dialog', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, {
    title: 'Escolher pasta de saída',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('fs:read-image-info', async (_event, filePath) => {
  try {
    const stat = await fsp.stat(filePath);
    const sharp = require('sharp');
    const meta = await sharp(filePath).metadata();
    return {
      ok: true,
      path: filePath,
      name: path.basename(filePath),
      size: stat.size,
      width: meta.width,
      height: meta.height,
      format: meta.format,
      mtime: stat.mtimeMs,
    };
  } catch (err) {
    return { ok: false, error: err.message, path: filePath, name: path.basename(filePath) };
  }
});

ipcMain.handle('fs:open-in-explorer', async (_event, filePath) => {
  try {
    const stat = await fsp.stat(filePath);
    if (stat.isDirectory()) {
      shell.openPath(filePath);
    } else {
      shell.showItemInFolder(filePath);
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('fs:read-thumbnail', async (_event, filePath, maxSize = 96) => {
  try {
    const sharp = require('sharp');
    const buffer = await sharp(filePath)
      .resize(maxSize, maxSize, { fit: 'cover' })
      .jpeg({ quality: 70 })
      .toBuffer();
    return { ok: true, dataUrl: `data:image/jpeg;base64,${buffer.toString('base64')}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ── IPC: Processamento ────────────────────────────────────────────────
ipcMain.handle('process:start', async (event, job) => {
  return runProcessingJob(event.sender, job);
});

// Quick action chama isso — encaminha pro main window automaticamente
ipcMain.handle('process:start-from-quick', async (event, job) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    // Sem main window aberta: processa direto no sender (quick window)
    return runProcessingJob(event.sender, job);
  }

  // Traz a main window pra frente e sincroniza a fila dela
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();

  // Envia os arquivos pro main window pra ele mostrar na fila
  mainWindow.webContents.send('main:sync-queue-and-start', {
    files: job.files,
    options: job.options,
    jobId: job.jobId,
  });

  return runProcessingJob(mainWindow.webContents, job);
});

async function runProcessingJob(senderWebContents, job) {
  const { jobId, files, options } = job;

  // Pre-flight: checa dimensões alvo vs originais (edge case)
  const warnings = [];
  if (options.width || options.height) {
    const sharp = require('sharp');
    for (const f of files) {
      try {
        const meta = await sharp(f.path).metadata();
        const w = options.width || meta.width;
        const h = options.height || meta.height;
        if ((w > meta.width || h > meta.height) && !options.upscale) {
          warnings.push({
            file: f.path,
            message: `${meta.width}×${meta.height} → ${w}×${h} (ampliação)`,
          });
        }
      } catch {}
    }
  }

  return new Promise((resolve) => {
    const workerPath = path.join(__dirname, 'workers', 'image-worker.js');
    const worker = new Worker(workerPath, {
      workerData: { jobId, files, options },
    });
    activeWorkers.set(jobId, worker);

    worker.on('message', (msg) => {
      senderWebContents.send('process:progress', msg);
    });

    worker.on('error', (err) => {
      senderWebContents.send('process:progress', {
        jobId,
        type: 'error',
        message: err.message,
      });
    });

    worker.on('exit', (code) => {
      activeWorkers.delete(jobId);
      senderWebContents.send('process:progress', {
        jobId,
        type: 'done',
        exitCode: code,
      });
      resolve({ ok: code === 0, exitCode: code, warnings });
    });
  });
}

ipcMain.handle('process:cancel', async (_event, jobId) => {
  const w = activeWorkers.get(jobId);
  if (w) {
    await w.terminate();
    activeWorkers.delete(jobId);
    return { ok: true };
  }
  return { ok: false };
});

// ── IPC: Settings (persistência local) ────────────────────────────────
const settingsPath = path.join(app.getPath('userData'), 'settings.json');
const presetsPath = path.join(app.getPath('userData'), 'presets.json');

const DEFAULT_SETTINGS = {
  contextMenuEnabled: false,
  desktopShortcutEnabled: false,
  runAsAdmin: false,
  threads: 0,                       // 0 = auto detect
  afterProcessAction: 'open-folder', // open-folder | notify | nothing
  autoCheckUpdates: true,
  windowBounds: null,
};

const DEFAULT_PRESETS = [
  { id: 'hd',          name: 'HD (1920×1080)',  type: 'pixels', width: 1920, height: 1080, keepRatio: true },
  { id: 'sd',          name: 'SD (1280×720)',   type: 'pixels', width: 1280, height: 720,  keepRatio: true },
  { id: 'tablet',      name: 'Tablet (1024×768)', type: 'pixels', width: 1024, height: 768, keepRatio: true },
  { id: 'web',         name: 'Web (800×600)',   type: 'pixels', width: 800,  height: 600,  keepRatio: true },
  { id: 'thumb',       name: 'Thumbnail (400×300)', type: 'pixels', width: 400, height: 300, keepRatio: true },
  { id: 'half',        name: 'Reduzir 50%',     type: 'percent', percent: 50, keepRatio: true },
  { id: 'quarter',     name: 'Reduzir 75%',     type: 'percent', percent: 75, keepRatio: true },
];

async function readJson(filePath, fallback) {
  try {
    const raw = await fsp.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
async function writeJson(filePath, data) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

ipcMain.handle('settings:get', async () => readJson(settingsPath, DEFAULT_SETTINGS));
ipcMain.handle('settings:set', async (_event, partial) => {
  const current = await readJson(settingsPath, DEFAULT_SETTINGS);
  const updated = { ...current, ...partial };
  await writeJson(settingsPath, updated);
  return updated;
});

ipcMain.handle('presets:get', async () => readJson(presetsPath, DEFAULT_PRESETS));
ipcMain.handle('presets:set', async (_event, presets) => {
  await writeJson(presetsPath, presets);
  return presets;
});

// ── IPC: Window Management ────────────────────────────────────────────
ipcMain.handle('window:open-settings', () => {
  createSettingsWindow();
  return { ok: true };
});

ipcMain.handle('window:open-quick-action', (_event, files) => {
  createQuickActionWindow(files || []);
  return { ok: true };
});

ipcMain.handle('window:close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.close();
});

// ── IPC: System Info ──────────────────────────────────────────────────
ipcMain.handle('system:info', () => ({
  platform: process.platform,
  arch: process.arch,
  cpus: os.cpus().length,
  totalMemory: os.totalmem(),
  freeMemory: os.freemem(),
  appVersion: app.getVersion(),
  userData: app.getPath('userData'),
}));

// ── IPC: Context Menu Install ─────────────────────────────────────────
ipcMain.handle('integrate:context-menu', async (_event, enable) => {
  // Delega pra um script Node separado — não editamos registry em runtime
  // a partir do renderer. O script roda em ELECTRON_RUN_AS_NODE.
  const { spawn } = require('child_process');
  const script = path.join(__dirname, 'scripts', enable ? 'install-context-menu.js' : 'uninstall-context-menu.js');
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: 'pipe',
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => stdout += d.toString());
    child.stderr.on('data', d => stderr += d.toString());
    child.on('close', async (code) => {
      try {
        const current = await readJson(settingsPath, DEFAULT_SETTINGS);
        current.contextMenuEnabled = enable;
        await writeJson(settingsPath, current);
      } catch (err) {
        stderr += `\nFalha ao salvar settings: ${err.message}`;
      }
      resolve({ ok: code === 0, stdout, stderr });
    });
  });
});
/* Parakeet Minimizer - Electron main process
   - Janela principal + janela de configuracoes
   - IPC: dialog de arquivos, metadados via sharp, pool de workers, persistencia
   - Single-instance lock
   - Drag & drop + argumentos de segunda instancia */

const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const { Worker } = require('worker_threads');

let mainWindow = null;
let settingsWindow = null;
let workerPool = [];
let activeTasks = 0;

const SUPPORTED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

/* ============================================================
   Janelas
   ============================================================ */

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#F9FAFB',
    title: 'Parakeet Minimizer',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

/* ============================================================
   Util: parsing de argumentos
   ============================================================ */

function parseFilesFromArgv(argv) {
  return argv.slice(1)
    .filter(a => !a.startsWith('-') && SUPPORTED_EXT.has(path.extname(a).toLowerCase()))
    .map((p, i) => ({
      id: 'a' + Date.now() + '_' + i,
      name: path.basename(p),
      ext: path.extname(p).slice(1).toLowerCase(),
      path: p,
    }));
}

/* ============================================================
   Sharp metadata
   ============================================================ */

let sharp = null;
function loadSharp() {
  if (!sharp) sharp = require('sharp');
  return sharp;
}

async function readImageMetadata(filePath) {
  try {
    const s = loadSharp();
    const stats = await fsp.stat(filePath);
    const meta = await s(filePath).metadata();
    return {
      width: meta.width || 0,
      height: meta.height || 0,
      size: stats.size,
    };
  } catch (err) {
    return { width: 0, height: 0, size: 0, error: err.message };
  }
}

/* ============================================================
   Worker pool
   ============================================================ */

function getWorkerCount() {
  const cpu = os.cpus()?.length || 4;
  return Math.max(1, Math.min(cpu, 8));
}

function ensureWorkerPool() {
  if (workerPool.length > 0) return workerPool;
  const count = getWorkerCount();
  const workerPath = path.join(__dirname, 'workers', 'image-worker.js');
  for (let i = 0; i < count; i++) {
    const w = new Worker(workerPath);
    w.busy = false;
    w.on('error', (err) => console.error('[worker error]', err));
    w.on('exit', (code) => {
      workerPool = workerPool.filter(x => x !== w);
      console.log('[worker exit]', code);
    });
    workerPool.push(w);
  }
  return workerPool;
}

function getIdleWorker() {
  ensureWorkerPool();
  return workerPool.find(w => !w.busy) || null;
}

function processWithWorker(task) {
  return new Promise((resolve) => {
    const tryDispatch = () => {
      const w = getIdleWorker();
      if (!w) {
        setTimeout(tryDispatch, 50);
        return;
      }
      w.busy = true;
      activeTasks++;

      const onMessage = (msg) => {
        if (msg.taskId !== task.taskId) return;
        w.off('message', onMessage);
        w.busy = false;
        activeTasks--;
        resolve(msg);
      };
      w.on('message', onMessage);
      w.postMessage({ type: 'process', ...task });
    };
    tryDispatch();
  });
}

/* ============================================================
   Processamento em lote (paralelo limitado pelo pool)
   ============================================================ */

async function runBatch(files, options, onProgress) {
  ensureWorkerPool();
  const tasks = files.map((f, i) => ({
    taskId: `${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`,
    file: f,
    options,
  }));

  const queue = tasks.slice();
  const results = [];
  let processed = 0;

  const workers = workerPool;
  const total = tasks.length;
  const startTime = Date.now();

  async function workerLoop(worker) {
    while (queue.length > 0) {
      const task = queue.shift();
      if (!task) break;
      worker.busy = true;
      const result = await new Promise((resolve) => {
        const onMessage = (msg) => {
          if (msg.taskId !== task.taskId) return;
          worker.off('message', onMessage);
          resolve(msg);
        };
        worker.on('message', onMessage);
        worker.postMessage({ type: 'process', ...task });
      });
      worker.busy = false;
      processed++;
      results.push(result);
      if (onProgress) {
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = processed / elapsed;
        const eta = (total - processed) / Math.max(speed, 0.01);
        onProgress({
          taskId: task.taskId,
          file: task.file,
          result,
          processed,
          total,
          speed,
          eta,
          elapsed,
        });
      }
    }
  }

  await Promise.all(workers.map(workerLoop));
  return { results, total };
}

/* ============================================================
   Persistencia em userData
   ============================================================ */

function userFile(name) {
  return path.join(app.getPath('userData'), name);
}

async function readJSON(name, fallback) {
  try {
    const raw = await fsp.readFile(userFile(name), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJSON(name, data) {
  try {
    await fsp.writeFile(userFile(name), JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error('[writeJSON]', err);
    return false;
  }
}

/* ============================================================
   IPC handlers
   ============================================================ */

ipcMain.handle('files:open-dialog', async () => {
  if (!mainWindow) return [];
  const r = await dialog.showOpenDialog(mainWindow, {
    title: 'Selecionar imagens',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Imagens', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
  });
  if (r.canceled || !r.filePaths.length) return [];
  const out = [];
  for (let i = 0; i < r.filePaths.length; i++) {
    const p = r.filePaths[i];
    const meta = await readImageMetadata(p);
    out.push({
      id: 'd' + Date.now() + '_' + i,
      name: path.basename(p),
      ext: path.extname(p).slice(1).toLowerCase(),
      path: p,
      ...meta,
      status: 'pending',
    });
  }
  return out;
});

ipcMain.handle('files:from-paths', async (_e, paths) => {
  const out = [];
  for (let i = 0; i < (paths || []).length; i++) {
    const p = paths[i];
    if (!SUPPORTED_EXT.has(path.extname(p).toLowerCase())) continue;
    const meta = await readImageMetadata(p);
    out.push({
      id: 'p' + Date.now() + '_' + i,
      name: path.basename(p),
      ext: path.extname(p).slice(1).toLowerCase(),
      path: p,
      ...meta,
      status: 'pending',
    });
  }
  return out;
});

ipcMain.handle('folder:pick', async (_e, defaultPath) => {
  if (!mainWindow) return null;
  const r = await dialog.showOpenDialog(mainWindow, {
    title: 'Escolher pasta de destino',
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: defaultPath || undefined,
  });
  if (r.canceled || !r.filePaths.length) return null;
  return r.filePaths[0];
});

ipcMain.handle('folder:open', async (_e, folderPath) => {
  const target = folderPath || app.getPath('downloads');
  await shell.openPath(target);
  return true;
});

ipcMain.handle('shell:show-in-folder', async (_e, p) => {
  if (!p) return false;
  shell.showItemInFolder(p);
  return true;
});

ipcMain.handle('process:batch', async (e, { files, options }) => {
  const sender = e.sender;
  try {
    const { results } = await runBatch(files, options, (progress) => {
      try { sender.send('process:progress', progress); } catch {}
    });
    return { ok: true, results };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('settings:get', async () => {
  return await readJSON('settings.json', {
    contextMenu: true,
    desktopShortcut: false,
    runAsAdmin: false,
    threads: getWorkerCount(),
    afterAction: 'open-output',
  });
});

ipcMain.handle('settings:save', async (_e, settings) => {
  return await writeJSON('settings.json', settings);
});

ipcMain.handle('presets:get', async () => {
  return await readJSON('presets.json', { builtIn: defaultBuiltInPresets(), custom: [] });
});

ipcMain.handle('presets:save', async (_e, data) => {
  return await writeJSON('presets.json', data);
});

function defaultBuiltInPresets() {
  return [
    { id: 'hd',     label: 'HD (1920x1080)',     mode: 'pixels',  w: 1920, h: 1080, builtIn: true },
    { id: 'sd',     label: 'SD (1280x720)',      mode: 'pixels',  w: 1280, h: 720,  builtIn: true },
    { id: 'tablet', label: 'Tablet (1024x768)',  mode: 'pixels',  w: 1024, h: 768,  builtIn: true },
    { id: 'web',    label: 'Web (800x600)',      mode: 'pixels',  w: 800,  h: 600,  builtIn: true },
    { id: 'thumb',  label: 'Thumbnail (400x300)',mode: 'pixels',  w: 400,  h: 300,  builtIn: true },
    { id: 'half',   label: 'Reduzir 50%',        mode: 'percent', percent: 50,         builtIn: true },
    { id: 'qtr',    label: 'Reduzir 75%',        mode: 'percent', percent: 75,         builtIn: true },
  ];
}

ipcMain.handle('context-menu:install', async () => {
  try {
    const { execFile } = require('child_process');
    const script = path.join(__dirname, 'scripts', 'install-context-menu.js');
    await new Promise((resolve, reject) => {
      execFile(process.execPath, [script], (err, stdout, stderr) => {
        if (err) reject(err); else { console.log(stdout); resolve(); }
      });
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('context-menu:uninstall', async () => {
  try {
    const { execFile } = require('child_process');
    const script = path.join(__dirname, 'scripts', 'uninstall-context-menu.js');
    await new Promise((resolve, reject) => {
      execFile(process.execPath, [script], (err, stdout, stderr) => {
        if (err) reject(err); else { console.log(stdout); resolve(); }
      });
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.on('window:open-settings', () => {
  // Settings agora eh uma view dentro da main window (sem flash)
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    mainWindow.webContents.send('navigate:settings');
  }
});

/* ============================================================
   Single-instance lock
   ============================================================ */

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      const files = parseFilesFromArgv(argv);
      if (files.length) mainWindow.webContents.send('files:from-argv', files);
    }
  });

  app.whenReady().then(() => {
    createMainWindow();

    // Se veio com arquivos no argv inicial, envia pro renderer depois que carregar
    const initial = parseFilesFromArgv(process.argv);
    if (initial.length && mainWindow) {
      mainWindow.webContents.once('did-finish-load', () => {
        mainWindow.webContents.send('files:from-argv', initial);
      });
    }
  });
}

app.on('window-all-closed', () => {
  // Encerra workers
  workerPool.forEach(w => w.postMessage({ type: 'shutdown' }));
  setTimeout(() => process.exit(0), 200);
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});
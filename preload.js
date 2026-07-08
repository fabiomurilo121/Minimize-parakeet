/**
 * Preload Script — Bridge IPC seguro entre main e renderer
 *
 * Expõe apenas uma API controlada via contextBridge. Renderer
 * não tem acesso direto a Node.js / filesystem.
 */

const { contextBridge, ipcRenderer } = require('electron');

const api = {
  // ── Filesystem ───────────────────────────────────────
  openFileDialog: (options) => ipcRenderer.invoke('fs:open-dialog', options),
  openFolderDialog: () => ipcRenderer.invoke('fs:open-folder-dialog'),
  readImageInfo: (filePath) => ipcRenderer.invoke('fs:read-image-info', filePath),
  readThumbnail: (filePath, maxSize) => ipcRenderer.invoke('fs:read-thumbnail', filePath, maxSize),
  openInExplorer: (filePath) => ipcRenderer.invoke('fs:open-in-explorer', filePath),

  // ── Processamento ────────────────────────────────────
  startProcess: (job) => ipcRenderer.invoke('process:start', job),
  startProcessFromQuick: (job) => ipcRenderer.invoke('process:start-from-quick', job),
  cancelProcess: (jobId) => ipcRenderer.invoke('process:cancel', jobId),
  onProcessProgress: (cb) => {
    const handler = (_e, msg) => cb(msg);
    ipcRenderer.on('process:progress', handler);
    return () => ipcRenderer.off('process:progress', handler);
  },

  // ── Settings / Presets ────────────────────────────────
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (partial) => ipcRenderer.invoke('settings:set', partial),
  getPresets: () => ipcRenderer.invoke('presets:get'),
  setPresets: (presets) => ipcRenderer.invoke('presets:set', presets),

  // ── Janelas ──────────────────────────────────────────
  openSettings: () => ipcRenderer.invoke('window:open-settings'),
  openQuickAction: (files) => ipcRenderer.invoke('window:open-quick-action', files),
  closeWindow: () => ipcRenderer.invoke('window:close'),

  // ── Integração ───────────────────────────────────────
  integrateContextMenu: (enable) => ipcRenderer.invoke('integrate:context-menu', enable),

  // ── Sistema ──────────────────────────────────────────
  systemInfo: () => ipcRenderer.invoke('system:info'),

  // ── Eventos do main → renderer ───────────────────────
  onIncomingFiles: (cb) => {
    const handler = (_e, files) => cb(files);
    ipcRenderer.on('main:incoming-files', handler);
    return () => ipcRenderer.off('main:incoming-files', handler);
  },
  onQuickActionSetFiles: (cb) => {
    const handler = (_e, files) => cb(files);
    ipcRenderer.on('quick-action:set-files', handler);
    return () => ipcRenderer.off('quick-action:set-files', handler);
  },
  onSyncQueueAndStart: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('main:sync-queue-and-start', handler);
    return () => ipcRenderer.off('main:sync-queue-and-start', handler);
  },

  // ── Helper: detectar modo quick action pela hash ─────
  isQuickActionMode: () => window.location.hash === '#quick-action',
};

contextBridge.exposeInMainWorld('api', api);
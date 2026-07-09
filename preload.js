/* Redutor de Imagens - Preload (bridge IPC seguro) */
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /* Arquivos */
  openFilesDialog:  () => ipcRenderer.invoke('files:open-dialog'),
  filesFromPaths:   (paths) => ipcRenderer.invoke('files:from-paths', paths),
  onFilesFromArgv:  (cb) => ipcRenderer.on('files:from-argv', (_e, files) => cb(files)),

  /* Drag & drop helper (obtem path real a partir do File) */
  getDroppedPath:   (file) => {
    try { return webUtils.getPathForFile(file); } catch { return file?.path || null; }
  },

  /* Pastas */
  pickFolder:       (defaultPath) => ipcRenderer.invoke('folder:pick', defaultPath),
  openFolder:       (folderPath) => ipcRenderer.invoke('folder:open', folderPath),
  showInFolder:     (filePath) => ipcRenderer.invoke('shell:show-in-folder', filePath),

  /* Processamento */
  processBatch:     (payload) => ipcRenderer.invoke('process:batch', payload),
  onProcessProgress: (cb) => ipcRenderer.on('process:progress', (_e, p) => cb(p)),

  /* Settings */
  getSettings:      () => ipcRenderer.invoke('settings:get'),
  saveSettings:     (settings) => ipcRenderer.invoke('settings:save', settings),

  /* Presets */
  getPresets:       () => ipcRenderer.invoke('presets:get'),
  savePresets:      (data) => ipcRenderer.invoke('presets:save', data),

  /* Context menu (Explorer) */
  installContextMenu:   () => ipcRenderer.invoke('context-menu:install'),
  uninstallContextMenu: () => ipcRenderer.invoke('context-menu:uninstall'),

  /* Janela */
  openSettings:     () => ipcRenderer.send('window:open-settings'),
  onNavigateSettings: (cb) => ipcRenderer.on('navigate:settings', () => cb()),
});
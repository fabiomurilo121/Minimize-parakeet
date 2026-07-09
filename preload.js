/* Redutor de Imagens - Preload (bridge IPC seguro) */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFilesDialog:     () => ipcRenderer.invoke('files:open-dialog'),
  pickFolder:          () => ipcRenderer.invoke('folder:pick'),
  openOutputFolder:    () => ipcRenderer.invoke('folder:open-output'),
  saveSettings:        (settings) => ipcRenderer.invoke('settings:save', settings),
  openSettings:        () => ipcRenderer.send('window:open-settings'),
  onFilesFromArgv:     (cb) => ipcRenderer.on('files:from-argv', (_e, files) => cb(files)),
});
const { contextBridge, ipcRenderer } = require('electron');

// Expose specific IPC functions needed ONLY by the settings window
contextBridge.exposeInMainWorld('settingsAPI', {
  saveApiKey: (key) => ipcRenderer.send('settings:save-api-key', key),
  openExternalLink: (url) => ipcRenderer.send('app:open-external-link', url)
}); 
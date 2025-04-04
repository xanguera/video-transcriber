const { contextBridge, ipcRenderer } = require('electron');

// API for the main application window
contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  processVideo: (filePath) => ipcRenderer.invoke('process-video', filePath),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_event, value) => callback(value)),
  // API Key related handlers
  getApiKey: () => ipcRenderer.invoke('app:get-api-key'), 
  promptApiKey: () => ipcRenderer.invoke('app:prompt-api-key')
});

// API specifically for the settings window
contextBridge.exposeInMainWorld('settingsAPI', {
  saveApiKey: (key) => ipcRenderer.send('settings:save-api-key', key), // Use send for one-way communication
  openExternalLink: (url) => ipcRenderer.send('app:open-external-link', url)
});

console.log('Preload script loaded.'); 
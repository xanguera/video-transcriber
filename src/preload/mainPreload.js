const { contextBridge, ipcRenderer } = require('electron');

// Expose specific IPC functions needed by the main renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  processVideo: (filePath) => ipcRenderer.invoke('process-video', filePath),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_event, value) => callback(value)),
  // API Key related functions for the main window (if needed, e.g., display status)
  getApiKey: () => ipcRenderer.invoke('app:get-api-key'), 
  promptApiKey: () => ipcRenderer.invoke('app:prompt-api-key') 
});

// We don't expose settingsAPI here anymore

console.log('Preload script loaded.'); 
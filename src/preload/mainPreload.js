const { contextBridge, ipcRenderer } = require('electron');

// Expose specific IPC functions needed by the main renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  processVideo: (filePath) => ipcRenderer.invoke('process-video', filePath),
  recomputeTranscript: (filePath) => ipcRenderer.invoke('recompute-transcript', filePath),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_event, value) => callback(value)),
  // API Key related functions for the main window (if needed, e.g., display status)
  getApiKey: () => ipcRenderer.invoke('app:get-api-key'), 
  promptApiKey: () => ipcRenderer.invoke('app:prompt-api-key'),
  
  // New download functions
  downloadYouTubeVideo: (url) => ipcRenderer.invoke('download-youtube-video', url),
  downloadGDriveVideo: (url) => ipcRenderer.invoke('download-gdrive-video', url),
  openDownloadsFolder: () => ipcRenderer.invoke('open-downloads-folder'),
  getDownloadHistory: () => ipcRenderer.invoke('get-download-history'),
  validateYouTubeUrl: (url) => ipcRenderer.invoke('validate-youtube-url', url),
  validateGDriveUrl: (url) => ipcRenderer.invoke('validate-gdrive-url', url),
  promptUrl: (type) => ipcRenderer.invoke('dialog:prompt-url', type),
  testYtDlpSetup: () => ipcRenderer.invoke('test-ytdlp-setup'),
  testSystemYtDlp: () => ipcRenderer.invoke('test-system-ytdlp'),
  getDebugInfo: () => ipcRenderer.invoke('get-debug-info')
});

// We don't expose settingsAPI here anymore

console.log('Preload script loaded.'); 
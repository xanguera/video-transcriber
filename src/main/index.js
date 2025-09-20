const { app, BrowserWindow } = require('electron');
const path = require('path');
// fs, ffmpeg, ffmpegStatic are now managed by videoProcessor
// const fs = require('fs'); 
// const ffmpeg = require('fluent-ffmpeg');
// const ffmpegStatic = require('ffmpeg-static');

// Import the new modules
const windowManager = require('./windowManager');
const configManager = require('./configManager');
const videoProcessor = require('./videoProcessor'); // Import video processor
const ipcHandlers = require('./ipcHandlers'); // Import IPC handlers module
const downloadManager = require('./downloadManager'); // Import download manager

// Initialize config manager
configManager.initializeClientFromStore();

// Setup ffmpeg path via videoProcessor
videoProcessor.setupFfmpeg();

// Initialize download directories
downloadManager.ensureDownloadsDirectoryExists();

// Setup IPC handlers
ipcHandlers.setupIpcHandlers();

// --- App Lifecycle Handlers --- 

app.whenReady().then(() => {
  // Create main window
  windowManager.createMainWindow(() => {
    if (!configManager.getOpenAIClient()) { 
      console.log('OpenAI client not initialized on startup, prompting...');
      windowManager.promptForApiKey(); 
    }
  });
  
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
        windowManager.createMainWindow(() => {
            if (!configManager.getOpenAIClient()) {
                console.log('OpenAI client not initialized on activate, prompting...');
                windowManager.promptForApiKey();
            }
        });
    }
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC Handlers Removed --- 
// All ipcMain.handle and ipcMain.on calls are now in src/main/ipcHandlers.js 
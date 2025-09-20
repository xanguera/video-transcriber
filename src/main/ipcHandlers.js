const { ipcMain, dialog, shell } = require('electron');

// Import modules containing the logic
const windowManager = require('./windowManager');
const configManager = require('./configManager');
const videoProcessor = require('./videoProcessor');
const downloadManager = require('./downloadManager');
const videoDownloader = require('./videoDownloader');

function setupIpcHandlers() {
    console.log('Setting up IPC handlers...');

    // --- Main Application Handlers --- 

    ipcMain.handle('app:get-api-key', () => {
        return configManager.getApiKey();
    });

    ipcMain.handle('app:prompt-api-key', async () => {
        windowManager.promptForApiKey(); 
    });

    ipcMain.handle('dialog:openFile', async () => {
      const mainWindow = windowManager.getMainWindow(); 
      if (!mainWindow) {
        console.error('Cannot open file dialog: main window not available.');
        return null;
      }
      try {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, { 
            properties: ['openFile'],
            filters: [
            { name: 'Videos', extensions: ['mkv', 'avi', 'mp4', 'mov', 'wmv', 'flv', 'webm'] }
            ]
        });
        if (canceled || filePaths.length === 0) {
            return null;
        } else {
            return filePaths[0];
        }
      } catch (error) {
          console.error('Error showing open file dialog:', error);
          return null;
      }
    });

    // --- New Download Handlers ---

    ipcMain.handle('dialog:prompt-url', async (event, type) => {
        const mainWindow = windowManager.getMainWindow();
        if (!mainWindow) {
            console.error('Cannot show URL dialog: main window not available.');
            return null;
        }

        const typeText = type === 'youtube' ? 'YouTube' : 'Google Drive';
        const placeholder = type === 'youtube' ? 
            'https://www.youtube.com/watch?v=...' : 
            'https://drive.google.com/file/d/.../view';

        try {
            const result = await dialog.showMessageBox(mainWindow, {
                type: 'question',
                title: `Enter ${typeText} URL`,
                message: `Please enter the ${typeText} URL:`,
                detail: `Example: ${placeholder}`,
                buttons: ['Cancel', 'Download'],
                defaultId: 1,
                cancelId: 0
            });

            if (result.response === 0) {
                return null; // User cancelled
            }

            // For now, we'll use a simple prompt. In a real app, you'd want a proper input dialog
            // This is a limitation of Electron's dialog - we'll handle this in the renderer
            return { needsInput: true, type: type };

        } catch (error) {
            console.error('Error showing URL dialog:', error);
            return null;
        }
    });

    ipcMain.handle('download-youtube-video', async (event, youtubeUrl) => {
        const openaiClient = configManager.getOpenAIClient();
        if (!openaiClient) {
            event.sender.send('update-status', 'Error: OpenAI API Key not configured or invalid.');
            windowManager.promptForApiKey();
            throw new Error('OpenAI client not initialized.');
        }

        const sendStatusUpdate = (message) => {
            if (event.sender && !event.sender.isDestroyed()) {
                event.sender.send('update-status', message);
            }
        };

        try {
            // Download the video
            const downloadResult = await videoDownloader.downloadYouTubeVideo(youtubeUrl, sendStatusUpdate);
            
            if (!downloadResult.metadata.alreadyExisted) {
                sendStatusUpdate(`Download completed. Processing video...`);
            }

            // Process the downloaded video
            const result = await videoProcessor.processVideo(downloadResult.filePath, openaiClient, sendStatusUpdate);
            
            return {
                ...result,
                downloadInfo: {
                    filePath: downloadResult.filePath,
                    source: 'youtube',
                    title: downloadResult.metadata.title
                }
            };

        } catch (error) {
            console.error('YouTube download/processing error:', error);
            throw error;
        }
    });

    ipcMain.handle('download-gdrive-video', async (event, gdriveUrl) => {
        const openaiClient = configManager.getOpenAIClient();
        if (!openaiClient) {
            event.sender.send('update-status', 'Error: OpenAI API Key not configured or invalid.');
            windowManager.promptForApiKey();
            throw new Error('OpenAI client not initialized.');
        }

        const sendStatusUpdate = (message) => {
            if (event.sender && !event.sender.isDestroyed()) {
                event.sender.send('update-status', message);
            }
        };

        try {
            // Download the video
            const downloadResult = await videoDownloader.downloadGoogleDriveVideo(gdriveUrl, sendStatusUpdate);
            
            if (!downloadResult.metadata.alreadyExisted) {
                sendStatusUpdate(`Download completed. Processing video...`);
            }

            // Process the downloaded video
            const result = await videoProcessor.processVideo(downloadResult.filePath, openaiClient, sendStatusUpdate);
            
            return {
                ...result,
                downloadInfo: {
                    filePath: downloadResult.filePath,
                    source: 'gdrive',
                    title: downloadResult.metadata.title
                }
            };

        } catch (error) {
            console.error('Google Drive download/processing error:', error);
            throw error;
        }
    });

    ipcMain.handle('open-downloads-folder', async () => {
        try {
            const success = await downloadManager.openDownloadsFolder();
            return success;
        } catch (error) {
            console.error('Error opening downloads folder:', error);
            return false;
        }
    });

    ipcMain.handle('get-download-history', async () => {
        try {
            const history = downloadManager.getDownloadHistory();
            const storageInfo = downloadManager.getStorageInfo();
            return {
                downloads: history.downloads,
                storageInfo: storageInfo
            };
        } catch (error) {
            console.error('Error getting download history:', error);
            return { downloads: [], storageInfo: { totalFiles: 0, totalSize: 0, totalSizeFormatted: '0 B' } };
        }
    });

    ipcMain.handle('validate-youtube-url', async (event, url) => {
        return videoDownloader.validateYouTubeUrl(url);
    });

    ipcMain.handle('validate-gdrive-url', async (event, url) => {
        return videoDownloader.validateGoogleDriveUrl(url);
    });

    ipcMain.handle('test-ytdlp-setup', async () => {
        try {
            const result = await videoDownloader.testYtDlpSetup();
            return result;
        } catch (error) {
            console.error('yt-dlp setup test failed:', error);
            throw error;
        }
    });

    ipcMain.handle('test-system-ytdlp', async () => {
        try {
            // Test system yt-dlp (from PATH)
            const { spawn } = require('child_process');
            
            return new Promise((resolve, reject) => {
                const ytDlp = spawn('yt-dlp', ['--version']);
                let output = '';
                let errorOutput = '';
                
                ytDlp.stdout.on('data', (data) => {
                    output += data.toString();
                });
                
                ytDlp.stderr.on('data', (data) => {
                    errorOutput += data.toString();
                });
                
                ytDlp.on('close', (code) => {
                    if (code === 0) {
                        resolve({
                            success: true,
                            version: output.trim(),
                            path: 'system yt-dlp (from PATH)',
                            isSystemInstall: true
                        });
                    } else {
                        reject(new Error(`System yt-dlp test failed with code ${code}: ${errorOutput}`));
                    }
                });
                
                ytDlp.on('error', (error) => {
                    if (error.code === 'ENOENT') {
                        reject(new Error('System yt-dlp not found. Install with: brew install yt-dlp'));
                    } else {
                        reject(new Error(`Failed to start system yt-dlp: ${error.message}`));
                    }
                });
            });
        } catch (error) {
            console.error('System yt-dlp test failed:', error);
            throw error;
        }
    });

    ipcMain.handle('get-debug-info', async () => {
        const { app } = require('electron');
        const path = require('path');
        const fs = require('fs');
        
        const debugInfo = {
            isPackaged: app.isPackaged,
            appPath: app.getAppPath(),
            resourcesPath: process.resourcesPath,
            platform: process.platform,
            __dirname: __dirname,
            ytDlpPath: null,
            ytDlpExists: false,
            ytDlpSize: null
        };
        
        // Get the actual yt-dlp path that would be used
        const extension = process.platform === 'win32' ? '.exe' : '';
        
        if (app.isPackaged) {
            // Packaged app - use extraResources location
            debugInfo.ytDlpPath = path.join(process.resourcesPath, `yt-dlp${extension}`);
        } else {
            // Development - use bundled binary
            const platformName = process.platform;
            debugInfo.ytDlpPath = path.join(__dirname, '..', '..', 'binaries', `${platformName}-yt-dlp${extension}`);
        }
        
        // Check if the binary exists
        debugInfo.ytDlpExists = fs.existsSync(debugInfo.ytDlpPath);
        if (debugInfo.ytDlpExists) {
            debugInfo.ytDlpSize = fs.statSync(debugInfo.ytDlpPath).size;
        }
        
        return debugInfo;
    });

    // --- Existing Handlers ---

    ipcMain.handle('process-video', async (event, videoPath, forceRecompute = false) => {
      const openaiClient = configManager.getOpenAIClient();
      if (!openaiClient) {
        event.sender.send('update-status', 'Error: OpenAI API Key not configured or invalid.');
        windowManager.promptForApiKey();
        throw new Error('OpenAI client not initialized.');
      }

      const sendStatusUpdate = (message) => {
          if (event.sender && !event.sender.isDestroyed()) {
              event.sender.send('update-status', message);
          }
      };

      try {
        const result = await videoProcessor.processVideo(videoPath, openaiClient, sendStatusUpdate, forceRecompute);
        return result; 
      } catch (error) {
        if (error.status === 401) {
            const errorMessage = 'Invalid OpenAI API Key. Please re-enter your key.';
            sendStatusUpdate(`Error: ${errorMessage}`);
            configManager.deleteApiKey();
            windowManager.promptForApiKey();
            throw new Error(errorMessage); 
        } else {
            console.error('Caught error from videoProcessor in IPC handler:', error);
            // Status update should have been sent by videoProcessor
            throw error; 
        }
      }
    });

    ipcMain.handle('recompute-transcript', async (event, videoPath) => {
      const openaiClient = configManager.getOpenAIClient();
      if (!openaiClient) {
        event.sender.send('update-status', 'Error: OpenAI API Key not configured or invalid.');
        windowManager.promptForApiKey();
        throw new Error('OpenAI client not initialized.');
      }

      const sendStatusUpdate = (message) => {
          if (event.sender && !event.sender.isDestroyed()) {
              event.sender.send('update-status', message);
          }
      };

      try {
        sendStatusUpdate('Recomputing transcript...');
        const result = await videoProcessor.processVideo(videoPath, openaiClient, sendStatusUpdate, true);
        return result; 
      } catch (error) {
        if (error.status === 401) {
            const errorMessage = 'Invalid OpenAI API Key. Please re-enter your key.';
            sendStatusUpdate(`Error: ${errorMessage}`);
            configManager.deleteApiKey();
            windowManager.promptForApiKey();
            throw new Error(errorMessage); 
        } else {
            console.error('Caught error from recompute transcript:', error);
            throw error; 
        }
      }
    });

    // --- Settings Window Handlers --- 

    ipcMain.on('settings:save-api-key', (event, apiKey) => {
        if (configManager.initializeOpenAI(apiKey)) { 
            configManager.setApiKey(apiKey); 
            console.log('API Key saved successfully.');
            const settingsWin = windowManager.getSettingsWindow();
            if (settingsWin && !settingsWin.isDestroyed()) {
                settingsWin.close();
            }
        } else {
            console.error('Attempted to save an invalid API Key (initialization failed).');
            // Consider sending a message back to the settings window to display the error
            // event.sender.send('save-key-error', 'Invalid API Key format or initialization failed.');
            dialog.showErrorBox('Invalid Key', 'The provided API Key could not be used to initialize the OpenAI client. Please check the key and try again.');
        }
    });

    ipcMain.on('app:open-external-link', (event, url) => {
        if (url && typeof url === 'string') { // Basic validation
            shell.openExternal(url);
        } else {
            console.warn('Attempted to open invalid external link:', url);
        }
    });
    
    console.log('IPC handlers set up complete.');
}

module.exports = { setupIpcHandlers }; 
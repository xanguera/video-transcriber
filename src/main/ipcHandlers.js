const { ipcMain, dialog, shell } = require('electron');

// Import modules containing the logic
const windowManager = require('./windowManager');
const configManager = require('./configManager');
const videoProcessor = require('./videoProcessor');

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
            { name: 'Videos', extensions: ['mkv', 'avi', 'mp4', 'mov', 'wmv', 'flv'] }
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

    ipcMain.handle('process-video', async (event, videoPath) => {
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
        const result = await videoProcessor.processVideo(videoPath, openaiClient, sendStatusUpdate);
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
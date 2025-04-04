const { BrowserWindow } = require('electron');
const path = require('path');

let mainWindow = null;
let settingsWindow = null;

function createMainWindow(promptForApiKeyIfNeeded) {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, '../preload/mainPreload.js'), // Updated path
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html')); // Updated path

  // Open the DevTools (optional)
  // mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    promptForApiKeyIfNeeded(); // Call the check passed from index.js
  });
  
  return mainWindow; // Return the window object if needed
}

function promptForApiKey() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 500,
    height: 300,
    title: 'API Key Setup',
    parent: mainWindow, // Make it a modal window relative to the main window
    modal: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    webPreferences: {
        preload: path.join(__dirname, '../preload/settingsPreload.js'), // Updated path (will create this file later)
        contextIsolation: true,
        nodeIntegration: false
    }
  });

  settingsWindow.loadFile(path.join(__dirname, '../renderer/settings.html')); // Updated path

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
  
  // Optional: remove menu bar for settings window
  settingsWindow.setMenuBarVisibility(false);
}

function getMainWindow() {
    return mainWindow;
}

function getSettingsWindow() {
    return settingsWindow;
}

module.exports = {
  createMainWindow,
  promptForApiKey,
  getMainWindow, // Export getter if needed elsewhere
  getSettingsWindow // Export getter if needed elsewhere
}; 
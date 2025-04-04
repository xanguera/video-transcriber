const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs'); // Needed for file system operations
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const OpenAI = require('openai'); // Import OpenAI
const Store = require('electron-store'); // Import electron-store

// Initialize Store
const store = new Store();

// Determine ffmpeg path (packaged vs development)
const ffmpegPath = app.isPackaged
  ? path.join(process.resourcesPath, 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
  : require('ffmpeg-static');

// Set the path for fluent-ffmpeg
if (fs.existsSync(ffmpegPath)) { // Check if the path exists
    ffmpeg.setFfmpegPath(ffmpegPath);
    console.log(`ffmpeg path set to: ${ffmpegPath}`);
} else {
    console.error(`ffmpeg binary not found at expected path: ${ffmpegPath}`);
    // Show error dialog to user
    dialog.showErrorBox('ffmpeg Error', `Could not find the required ffmpeg component at ${ffmpegPath}. The app might not function correctly.`);
    // Depending on criticality, you might app.quit() here.
}

// Initialize OpenAI client - will be done after checking/getting the key
let openai = null; // Initialize as null
let settingsWindow = null; // Keep track of the settings window

// Function to initialize OpenAI client (or re-initialize if key changes)
function initializeOpenAI(apiKey) {
  if (!apiKey) {
    openai = null;
    console.warn('OpenAI API key is not set.');
    return false;
  }
  try {
    openai = new OpenAI({ apiKey });
    console.log('OpenAI client initialized successfully.');
    return true;
  } catch (error) {
    openai = null;
    console.error('Failed to initialize OpenAI client:', error);
    dialog.showErrorBox('OpenAI Init Error', `Failed to initialize OpenAI: ${error.message}`);
    return false;
  }
}

// Function to prompt user for API key
async function promptForApiKey(parentWindow) {
    // If settings window already open, focus it
    if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.focus();
        return;
    }

    settingsWindow = new BrowserWindow({
        width: 500,
        height: 350,
        title: 'API Key Setup',
        parent: parentWindow, // Make it a modal window
        modal: true,
        resizable: false,
        minimizable: false,
        maximizable: false,
        show: false, // Don't show immediately
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'), // Reuse the same preload
            contextIsolation: true,
            nodeIntegration: false, 
            enableRemoteModule: false
        }
    });

    settingsWindow.loadFile(path.join(__dirname, 'settings.html'));
    // settingsWindow.webContents.openDevTools(); // Optional: for debugging settings window

    settingsWindow.once('ready-to-show', () => {
        settingsWindow.show();
    });

    settingsWindow.on('closed', () => {
        settingsWindow = null; // Dereference window object
    });
}

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, // Protect against prototype pollution
      enableRemoteModule: false // Deprecated and insecure
    }
  });

  // Check for API Key on startup *before* loading the window
  // This is a basic check; a loading screen or settings page is better UX.
  let apiKey = store.get('openai_api_key');
  if (!apiKey) {
      // If no key, prompt the user (needs mainWindow to be passed correctly)
      // We have a chicken-and-egg problem: need window for prompt, but want key before load.
      // Solution: Load HTML, then check/prompt from renderer via IPC, or check here and potentially show prompt *after* window loads.
      console.log("API Key not found in store.");
      // We will defer the prompt until the window is ready or handle via IPC later.
  }

  // Initialize OpenAI if key exists
  initializeOpenAI(apiKey);

  mainWindow.loadFile('index.html');

  // Open DevTools - useful for debugging
  // mainWindow.webContents.openDevTools();

  mainWindow.on('ready-to-show', () => {
      // Now the window is ready, check again if needed
      if (!openai) { // Check if client failed to initialize or key was missing
          promptForApiKey(mainWindow); // Now we have a window to parent the dialog
      }
  });

  mainWindow.on('closed', function () {
    // Dereference the window object
    mainWindow = null;
    // Quit app if main window closes and settings is open? Or let settings close independently.
    if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.close();
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  // Quit when all windows are closed, except on macOS. There, it's common
  // for applications and their menu bar to stay active until the user quits
  // explicitly with Cmd + Q.
  if (process.platform !== 'darwin') app.quit();
});

// IPC handler for renderer to request API key check/prompt
ipcMain.handle('app:get-api-key', () => {
    return store.get('openai_api_key');
});

ipcMain.handle('app:prompt-api-key', async () => {
    promptForApiKey(mainWindow);
});

// Handle the 'open-file-dialog' message from the renderer process
ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, { // Ensure dialog is parented
    properties: ['openFile'],
    filters: [
      { name: 'Videos', extensions: ['mkv', 'avi', 'mp4', 'mov', 'wmv', 'flv'] }
      // Add more formats as needed
    ]
  });
  if (canceled || filePaths.length === 0) {
    return null; // Or handle cancellation appropriately
  } else {
    return filePaths[0];
  }
});

// Handle video processing: extraction and transcription
ipcMain.handle('process-video', async (event, videoPath) => {
  // Check if OpenAI client is initialized
  if (!openai) {
      event.sender.send('update-status', 'Error: OpenAI API Key not configured or invalid.');
      // Optionally trigger the prompt again
      // await promptForApiKey(BrowserWindow.fromWebContents(event.sender));
      throw new Error('OpenAI client not initialized. Please configure your API key.');
  }

  console.log(`Processing video: ${videoPath}`);
  const tempDir = app.getPath('temp');
  const audioFileName = `audio_${Date.now()}.mp3`; // Use mp3, widely supported
  const audioOutputPath = path.join(tempDir, audioFileName);
  let extractedAudioPath = null;
  let whisperResponse = null; // Store the whole response

  try {
    // --- 1. Extract Audio --- 
    event.sender.send('update-status', 'Extracting audio...');
    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .noVideo() // Don't process video
        .audioCodec('libmp3lame') // Specify mp3 codec
        .audioBitrate('192k') // Standard bitrate
        .save(audioOutputPath)
        .on('end', () => {
          console.log('Audio extraction finished.');
          extractedAudioPath = audioOutputPath;
          resolve();
        })
        .on('error', (err) => {
          console.error('Error extracting audio:', err);
          reject(new Error(`ffmpeg error: ${err.message}`));
        });
    });

    if (!extractedAudioPath) {
        throw new Error("Audio extraction failed, output path not set.");
    }

    // --- 2. Transcribe and Translate Audio with Whisper --- 
    event.sender.send('update-status', 'Uploading and translating audio (this may take a while)...');
    console.log(`Transcribing audio file: ${extractedAudioPath}`);

    try {
      whisperResponse = await openai.audio.translations.create({
        model: "whisper-1",
        file: fs.createReadStream(extractedAudioPath),
        response_format: "verbose_json", // Request timestamps and segments
        // task: 'translate', // This endpoint is specifically for translation
      });

      console.log('Whisper API response received.');
      // console.log(JSON.stringify(whisperResponse, null, 2)); // Optional: Log full response for debugging

      if (!whisperResponse || !whisperResponse.segments) {
        console.warn("Whisper response did not contain segments.");
        // Fallback or throw error if segments are essential
      }

    } catch (apiError) {
      console.error('OpenAI API Error:', apiError);
      let errorMessage = 'OpenAI API request failed.';
      if (apiError.status === 401) { // Unauthorized
          errorMessage = 'Invalid OpenAI API Key. Please re-enter your key.';
          store.delete('openai_api_key'); // Clear potentially bad key
          openai = null; 
          promptForApiKey(BrowserWindow.fromWebContents(event.sender)); // Prompt again
      } else if (apiError.response) {
          errorMessage += ` Status: ${apiError.response.status}, Data: ${JSON.stringify(apiError.response.data)}`;
      } else if (apiError.message) {
          errorMessage += ` Message: ${apiError.message}`;
      }
      // Clean up audio file before throwing
      if (extractedAudioPath && fs.existsSync(extractedAudioPath)) {
            try { fs.unlinkSync(extractedAudioPath); } catch (e) { /* ignore */ }
      }
      throw new Error(errorMessage);
    }

    // --- 3. Cleanup and Return --- 
    event.sender.send('update-status', 'Processing complete.');
    
    // Clean up the temporary audio file immediately after API call is done
    if (extractedAudioPath) {
      try {
        fs.unlinkSync(extractedAudioPath);
        console.log(`Deleted temporary audio file: ${extractedAudioPath}`);
      } catch (cleanupErr) {
        console.error('Error deleting temporary audio file:', cleanupErr);
        // Non-fatal, just log it
      }
      extractedAudioPath = null; // Mark as deleted
    }

    // Return the full text and the segments array
    return {
        text: whisperResponse?.text || "(No transcript text received)",
        segments: whisperResponse?.segments || [] // Return empty array if segments missing
    };

  } catch (error) {
    console.error('Error in process-video handler:', error);
    event.sender.send('update-status', `Error: ${error.message}`);
    
    // Ensure cleanup even if error happens after extraction but before API call finishes
    if (extractedAudioPath && fs.existsSync(extractedAudioPath)) {
      try { 
          fs.unlinkSync(extractedAudioPath); 
          console.log(`Cleaned up temp audio file after error: ${extractedAudioPath}`);
      } catch (e) { 
          console.error('Error during cleanup after error:', e);
      }
    }
    throw error; // Re-throw to notify renderer of failure
  }
});

// Settings Window IPC 
ipcMain.on('settings:save-api-key', (event, key) => {
    if (key && typeof key === 'string' && key.startsWith('sk-')) {
        console.log('Received API key from settings window.');
        store.set('openai_api_key', key);
        const initialized = initializeOpenAI(key);

        // Close the settings window only if initialization looks okay
        if (initialized && settingsWindow && !settingsWindow.isDestroyed()) {
            settingsWindow.close();
        } else if (!initialized) {
             // Optionally send message back to settings window if save failed/init failed
             dialog.showErrorBox("Initialization Failed", "Failed to initialize OpenAI with the provided key. Please check the key and try again.");
        }
    } else {
        console.warn('Invalid API key received from settings window.');
        // Optionally send message back to settings window
    }
});

ipcMain.on('app:open-external-link', (event, url) => {
    if (url && typeof url === 'string') {
        shell.openExternal(url);
    }
}); 
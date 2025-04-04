const Store = require('electron-store');
const OpenAI = require('openai');
const { dialog } = require('electron'); // For showing errors

// Initialize electron-store
const store = new Store();

// Singleton instance of the OpenAI client
let openaiClient = null;

/**
 * Initializes the OpenAI client with the provided API key.
 * @param {string} apiKey - The OpenAI API key.
 * @returns {boolean} - True if initialization was successful, false otherwise.
 */
function initializeOpenAI(apiKey) {
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.startsWith('sk-')) {
    openaiClient = null;
    console.warn('Attempted to initialize OpenAI with an invalid key format.');
    return false;
  }
  
  try {
    openaiClient = new OpenAI({ apiKey });
    console.log('OpenAI client initialized successfully.');
    // Optionally, perform a quick test request here to truly validate the key
    return true;
  } catch (error) {
    openaiClient = null;
    console.error('Failed to initialize OpenAI client:', error);
    // Optionally show dialog, but maybe better handled where it's called
    // dialog.showErrorBox('OpenAI Init Error', `Failed to initialize OpenAI: ${error.message}`);
    return false;
  }
}

/**
 * Retrieves the stored OpenAI API key.
 * @returns {string | undefined} - The stored API key or undefined if not set.
 */
function getApiKey() {
  return store.get('openai_api_key');
}

/**
 * Saves the OpenAI API key to the store.
 * @param {string} apiKey - The API key to save.
 */
function setApiKey(apiKey) {
  store.set('openai_api_key', apiKey);
}

/**
 * Deletes the OpenAI API key from the store and resets the client.
 */
function deleteApiKey() {
  store.delete('openai_api_key');
  openaiClient = null; // Reset the client instance
  console.log('OpenAI API Key deleted.');
}

/**
 * Returns the singleton OpenAI client instance.
 * @returns {OpenAI | null} - The initialized OpenAI client or null.
 */
function getOpenAIClient() {
  return openaiClient;
}

/**
 * Attempts to initialize the OpenAI client using the stored API key.
 * Should be called on app startup.
 */
function initializeClientFromStore() {
    const storedKey = getApiKey();
    if (storedKey) {
        initializeOpenAI(storedKey);
    } else {
        console.log('No API key found in store for initial client setup.');
    }
}

module.exports = {
  initializeOpenAI,
  initializeClientFromStore,
  getApiKey,
  setApiKey,
  deleteApiKey,
  getOpenAIClient,
}; 
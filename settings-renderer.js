// settings-renderer.js

const apiKeyInput = document.getElementById('api-key');
const saveBtn = document.getElementById('save-btn');
const errorMessage = document.getElementById('error-message');
const openaiLink = document.getElementById('openai-link');

saveBtn.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    
    if (apiKey && apiKey.startsWith('sk-')) {
        errorMessage.textContent = ''; // Clear error message
        // Send the key back to the main process
        window.settingsAPI.saveApiKey(apiKey);
    } else {
        errorMessage.textContent = 'Please enter a valid OpenAI API key (it should start with \'sk-\').';
    }
});

// Open OpenAI link in the default browser
openaiLink.addEventListener('click', (e) => {
    e.preventDefault(); // Prevent default link behavior
    window.settingsAPI.openExternalLink('https://platform.openai.com/account/api-keys');
}); 
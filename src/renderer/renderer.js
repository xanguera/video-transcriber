const loadVideoBtn = document.getElementById('load-video-btn');
const dropdownToggle = document.getElementById('dropdown-toggle');
const dropdownMenu = document.getElementById('dropdown-menu');
const loadLocalBtn = document.getElementById('load-local-btn');
const downloadYoutubeBtn = document.getElementById('download-youtube-btn');
const downloadGdriveBtn = document.getElementById('download-gdrive-btn');
const browseDownloadsBtn = document.getElementById('browse-downloads-btn');

const videoPlayer = document.getElementById('video-player');
const videoPlaceholder = document.getElementById('video-placeholder');
const transcriptContent = document.getElementById('transcript-content');
const statusUpdates = document.getElementById('status-updates');

// Progress indicator elements
const downloadProgress = document.getElementById('download-progress');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');

// Recompute button
const recomputeTranscriptBtn = document.getElementById('recompute-transcript-btn');

// Modal elements
const urlInputModal = document.getElementById('url-input-modal');
const modalTitle = document.getElementById('modal-title');
const modalDescription = document.getElementById('modal-description');
const urlInput = document.getElementById('url-input');
const urlValidation = document.getElementById('url-validation');
const cancelUrlBtn = document.getElementById('cancel-url-btn');
const downloadUrlBtn = document.getElementById('download-url-btn');
const closeModal = document.getElementById('close-modal');

const historyModal = document.getElementById('history-modal');
const closeHistoryModal = document.getElementById('close-history-modal');
const storageInfo = document.getElementById('storage-info');
const downloadList = document.getElementById('download-list');

// Console elements
const consoleToggle = document.getElementById('console-toggle');
const consolePanel = document.getElementById('console-panel');
const consoleClose = document.getElementById('console-close');
const consoleContent = document.getElementById('console-content');

// Application state
let currentVideoPath = null;
let transcriptSegments = [];
let currentHighlightSpan = null;
let currentDownloadType = null;

// Console setup
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;

function addLogToConsole(message, type = 'log') {
    const timestamp = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = `console-entry ${type}`;
    entry.innerHTML = `<span class="console-timestamp">[${timestamp}]</span>${message}`;
    consoleContent.appendChild(entry);
    consoleContent.scrollTop = consoleContent.scrollHeight;
}

// Override console methods
console.log = function(...args) {
    originalConsoleLog.apply(console, args);
    args.forEach(arg => addLogToConsole(arg, 'log'));
};

console.error = function(...args) {
    originalConsoleError.apply(console, args);
    args.forEach(arg => addLogToConsole(arg, 'error'));
};

console.warn = function(...args) {
    originalConsoleWarn.apply(console, args);
    args.forEach(arg => addLogToConsole(arg, 'warn'));
};

console.info = function(...args) {
    originalConsoleInfo.apply(console, args);
    args.forEach(arg => addLogToConsole(arg, 'info'));
};

// Utility functions
function addStatusUpdate(message) {
    const timestamp = new Date().toLocaleTimeString();
    const statusDiv = document.createElement('div');
    statusDiv.innerHTML = `[${timestamp}] ${message}`;
    statusUpdates.appendChild(statusDiv);
    statusUpdates.scrollTop = statusUpdates.scrollHeight;
}

function clearTranscript() {
    transcriptContent.innerHTML = '';
    transcriptSegments = [];
    currentHighlightSpan = null;
}

function displayTranscriptWithTimestamps(segments) {
    if (!segments || segments.length === 0) {
        transcriptContent.innerHTML = '<p>No transcript segments available.</p>';
        return;
    }

    let html = '';
    segments.forEach((segment, index) => {
        if (segment.words && segment.words.length > 0) {
            segment.words.forEach(word => {
                html += `<span class="transcript-segment" 
                              data-start="${word.start}" 
                              data-end="${word.end}">${word.word} </span>`;
            });
        } else {
            html += `<span class="transcript-segment" 
                          data-start="${segment.start}" 
                          data-end="${segment.end}">${segment.text} </span>`;
        }
    });
    
    transcriptContent.innerHTML = html;
}

async function loadVideoFromPath(filePath, source = 'local', title = null) {
    try {
        currentVideoPath = filePath;
        
        // Revoke previous object URL if exists to prevent memory leaks
        if (videoPlayer.src && videoPlayer.src.startsWith('blob:')) {
            URL.revokeObjectURL(videoPlayer.src);
        }
        
        // Create a new Blob URL for local files
        if (source === 'local') {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`Failed to fetch video file: ${response.statusText}`);
            }
            const videoBlob = await response.blob();
            const videoURL = URL.createObjectURL(videoBlob);
            videoPlayer.src = videoURL;
        } else {
            // For downloaded files, use file:// protocol
            videoPlayer.src = `file://${filePath}`;
        }

        videoPlayer.style.display = 'block';
        videoPlaceholder.style.display = 'none';
        clearTranscript();
        statusUpdates.innerHTML = '';

        const displayTitle = title || (source === 'local' ? 'Local video' : 'Downloaded video');
        addStatusUpdate(`${displayTitle} loaded. Starting processing...`);

        // Process video
        const result = await window.electronAPI.processVideo(filePath);
        
        if (result && result.segments && result.segments.length > 0) {
            transcriptSegments = result.segments;
            displayTranscriptWithTimestamps(transcriptSegments);
        } else {
            transcriptContent.innerHTML = `<p>${result?.text || '(No transcript received)'}</p>`;
            transcriptSegments = [];
        }

        // Show recompute button when video is loaded successfully
        recomputeTranscriptBtn.style.display = 'flex';

        // Add cached indicator if transcript was from cache
        if (result.cached) {
            addStatusUpdate(`Processing completed using cached transcript (generated: ${new Date(result.generatedAt).toLocaleString()})`);
        } else {
            addStatusUpdate(`Processing completed. Transcript saved for future use.`);
        }

        if (result.downloadInfo) {
            addStatusUpdate(`Video saved to: ${result.downloadInfo.filePath}`);
        }

    } catch (error) {
        console.error('Error loading/processing video:', error);
        handleVideoError(error);
        // Hide recompute button on error
        recomputeTranscriptBtn.style.display = 'none';
    }
}

function handleVideoError(error) {
    let errorMessage = error.message || 'Unknown error';
    let detailedMessage = '';
    
    if (errorMessage.includes('API key')) {
        detailedMessage = 'Please check your OpenAI API key configuration.';
    } else if (errorMessage.includes('network') || errorMessage.includes('connect')) {
        detailedMessage = 'Check your internet connection.';
    } else if (errorMessage.includes('ffmpeg')) {
        detailedMessage = 'Issue with FFmpeg component for audio extraction.';
    } else if (errorMessage.includes('yt-dlp')) {
        detailedMessage = 'Please ensure yt-dlp is installed and accessible.';
    } else if (errorMessage.includes('403') || errorMessage.includes('401')) {
        detailedMessage = 'API authentication failed.';
    } else if (errorMessage.includes('429')) {
        detailedMessage = 'API rate limit exceeded. Please try again later.';
    }
    
    addStatusUpdate(`Error: ${errorMessage}`);
    
    transcriptContent.innerHTML = `
        <div style="color: red; padding: 15px; border: 1px solid #f88; background-color: #fee; border-radius: 5px;">
            <h3>Failed to process video</h3>
            <p>${errorMessage}</p>
            ${detailedMessage ? `<p>${detailedMessage}</p>` : ''}
            <p><small>See the console for more detailed error information.</small></p>
        </div>`;
    
    transcriptSegments = [];
    consolePanel.classList.add('open');
}

// URL validation functions
async function validateUrl(url, type) {
    try {
        if (type === 'youtube') {
            return await window.electronAPI.validateYouTubeUrl(url);
        } else if (type === 'gdrive') {
            return await window.electronAPI.validateGDriveUrl(url);
        }
        return false;
    } catch (error) {
        console.error('URL validation error:', error);
        return false;
    }
}

function showUrlValidation(message, isValid) {
    urlValidation.textContent = message;
    urlValidation.className = `url-validation ${isValid ? 'valid' : 'invalid'}`;
    downloadUrlBtn.disabled = !isValid;
}

// Modal functions
function showUrlModal(type) {
    console.log('showUrlModal called with type:', type);
    currentDownloadType = type;
    console.log('currentDownloadType set to:', currentDownloadType);
    
    const typeText = type === 'youtube' ? 'YouTube' : 'Google Drive';
    const placeholder = type === 'youtube' ? 
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ' : 
        'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view';

    modalTitle.textContent = `Download from ${typeText}`;
    modalDescription.textContent = `Enter the ${typeText} URL:`;
    urlInput.placeholder = placeholder;
    urlInput.value = '';
    urlValidation.textContent = '';
    downloadUrlBtn.disabled = true;
    
    urlInputModal.style.display = 'block';
    urlInput.focus();
}

function hideUrlModal() {
    console.log('hideUrlModal called, currentDownloadType was:', currentDownloadType);
    urlInputModal.style.display = 'none';
    currentDownloadType = null;
    console.log('currentDownloadType reset to:', currentDownloadType);
}

async function showDownloadHistory() {
    try {
        const historyData = await window.electronAPI.getDownloadHistory();
        
        // Update storage info
        const { storageInfo: storage, downloads } = historyData;
        storageInfo.innerHTML = `
            <strong>Storage Used:</strong> ${storage.totalSizeFormatted} 
            (${storage.totalFiles} files)
        `;
        
        // Update download list
        if (downloads.length === 0) {
            downloadList.innerHTML = '<p style="text-align: center; color: #666;">No downloaded videos yet.</p>';
        } else {
            downloadList.innerHTML = downloads.map((download, index) => {
                const icon = download.source === 'youtube' ? '🎥' : '☁️';
                const date = new Date(download.downloadedAt).toLocaleDateString();
                const size = download.fileSize ? formatBytes(download.fileSize) : 'Unknown size';
                const transcriptIcon = download.hasTranscript ? '📝' : '';
                const transcriptText = download.hasTranscript ? ' • Transcript cached' : '';
                
                return `
                    <div class="download-item" data-filepath="${download.filePath}" data-title="${download.title}" data-index="${index}">
                        <div class="download-icon">${icon}</div>
                        <div class="download-info">
                            <div class="download-title">${download.title} ${transcriptIcon}</div>
                            <div class="download-meta">
                                ${download.source.toUpperCase()} • ${date} • ${size}${transcriptText}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            // Add click event listeners to download items
            const downloadItems = downloadList.querySelectorAll('.download-item');
            downloadItems.forEach(item => {
                item.addEventListener('click', async () => {
                    const filePath = item.dataset.filepath;
                    const title = item.dataset.title;
                    
                    // Check if file still exists before trying to load
                    try {
                        await loadDownloadedVideo(filePath, title);
                    } catch (error) {
                        if (error.message.includes('fetch') || error.message.includes('not found')) {
                            addStatusUpdate('Error: Video file not found. It may have been moved or deleted.');
                            // Refresh the download list to reflect current state
                            setTimeout(() => {
                                showDownloadHistory();
                            }, 1000);
                        } else {
                            console.error('Error loading downloaded video:', error);
                            addStatusUpdate(`Error loading video: ${error.message}`);
                        }
                    }
                });
            });
        }
        
        historyModal.style.display = 'block';
        
    } catch (error) {
        console.error('Error loading download history:', error);
        addStatusUpdate('Error loading download history');
    }
}

function hideDownloadHistory() {
    historyModal.style.display = 'none';
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Global function for loading downloaded videos (called from HTML)
window.loadDownloadedVideo = async function(filePath, title) {
    hideDownloadHistory();
    await loadVideoFromPath(filePath, 'downloaded', title);
};

// Event listeners
dropdownToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownMenu.classList.toggle('show');
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!dropdownMenu.contains(e.target) && !dropdownToggle.contains(e.target)) {
        dropdownMenu.classList.remove('show');
    }
});

// Main load button (local file)
loadVideoBtn.addEventListener('click', async () => {
    dropdownMenu.classList.remove('show');
    const filePath = await window.electronAPI.openFileDialog();
    if (filePath) {
        await loadVideoFromPath(filePath, 'local');
    }
});

// Dropdown menu items
loadLocalBtn.addEventListener('click', async () => {
    dropdownMenu.classList.remove('show');
    const filePath = await window.electronAPI.openFileDialog();
    if (filePath) {
        await loadVideoFromPath(filePath, 'local');
    }
});

downloadYoutubeBtn.addEventListener('click', () => {
    dropdownMenu.classList.remove('show');
    showUrlModal('youtube');
});

downloadGdriveBtn.addEventListener('click', () => {
    dropdownMenu.classList.remove('show');
    showUrlModal('gdrive');
});

browseDownloadsBtn.addEventListener('click', () => {
    dropdownMenu.classList.remove('show');
    showDownloadHistory();
});

// URL input modal events
urlInput.addEventListener('input', async (e) => {
    const url = e.target.value.trim();
    
    if (!url) {
        showUrlValidation('', false);
        return;
    }
    
    if (currentDownloadType === 'youtube') {
        const isValid = await validateUrl(url, 'youtube');
        showUrlValidation(
            isValid ? '✓ Valid YouTube URL' : '✗ Invalid YouTube URL format',
            isValid
        );
    } else if (currentDownloadType === 'gdrive') {
        const validation = await validateUrl(url, 'gdrive');
        showUrlValidation(
            validation.valid ? '✓ Valid Google Drive URL' : '✗ Invalid Google Drive URL format',
            validation.valid
        );
    }
});

downloadUrlBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    console.log('Download button clicked:', { url, currentDownloadType });
    
    if (!url) {
        console.error('No URL provided');
        addStatusUpdate('Error: No URL provided');
        return;
    }
    
    if (!currentDownloadType) {
        console.error('No download type set');
        addStatusUpdate('Error: Download type not set');
        return;
    }
    
    // Save the download type before hiding the modal (which resets it to null)
    const downloadType = currentDownloadType;
    hideUrlModal();
    
    try {
        // Show progress indicator
        showProgress(`Starting ${downloadType} download...`);
        addStatusUpdate(`Starting ${downloadType} download...`);
        console.log(`Starting ${downloadType} download for URL:`, url);
        
        let result;
        if (downloadType === 'youtube') {
            result = await window.electronAPI.downloadYouTubeVideo(url);
        } else if (downloadType === 'gdrive') {
            result = await window.electronAPI.downloadGDriveVideo(url);
        } else {
            throw new Error(`Unknown download type: ${downloadType}`);
        }
        
        // Hide progress indicator on completion
        hideProgress();
        
        if (result) {
            // Load the downloaded video
            currentVideoPath = result.downloadInfo.filePath;
            
            // Update video player
            videoPlayer.src = `file://${result.downloadInfo.filePath}`;
            videoPlayer.style.display = 'block';
            videoPlaceholder.style.display = 'none';
            
            // Display transcript
            if (result.segments && result.segments.length > 0) {
                transcriptSegments = result.segments;
                displayTranscriptWithTimestamps(transcriptSegments);
            } else {
                transcriptContent.innerHTML = `<p>${result.text || '(No transcript received)'}</p>`;
                transcriptSegments = [];
            }
            
            addStatusUpdate(`Download and processing completed: ${result.downloadInfo.title}`);
        }
        
    } catch (error) {
        // Hide progress indicator on error
        hideProgress();
        console.error(`${downloadType} download error:`, error);
        handleVideoError(error);
    }
});

cancelUrlBtn.addEventListener('click', hideUrlModal);
closeModal.addEventListener('click', hideUrlModal);
closeHistoryModal.addEventListener('click', hideDownloadHistory);

// Close modals when clicking outside
urlInputModal.addEventListener('click', (e) => {
    if (e.target === urlInputModal) {
        hideUrlModal();
    }
});

historyModal.addEventListener('click', (e) => {
    if (e.target === historyModal) {
        hideDownloadHistory();
    }
});

// Console panel events
consoleToggle.addEventListener('click', () => {
    consolePanel.classList.toggle('open');
});

consoleClose.addEventListener('click', () => {
    consolePanel.classList.remove('open');
});

// Test yt-dlp setup button
const testYtdlpBtn = document.getElementById('test-ytdlp-btn');
testYtdlpBtn.addEventListener('click', async () => {
    console.log('Testing yt-dlp setup...');
    try {
        const result = await window.electronAPI.testYtDlpSetup();
        console.log('yt-dlp test successful:', result);
        addStatusUpdate(`yt-dlp test successful: ${result.version} at ${result.path}`);
    } catch (error) {
        console.error('yt-dlp test failed:', error);
        addStatusUpdate(`yt-dlp test failed: ${error.message}`);
    }
});

// Test system yt-dlp button
const testSystemYtdlpBtn = document.getElementById('test-system-ytdlp-btn');
testSystemYtdlpBtn.addEventListener('click', async () => {
    console.log('Testing system yt-dlp...');
    try {
        const result = await window.electronAPI.testSystemYtDlp();
        console.log('System yt-dlp test successful:', result);
        addStatusUpdate(`System yt-dlp test successful: ${result.version}`);
        if (result.isSystemInstall) {
            addStatusUpdate('✅ System yt-dlp can be used as fallback for downloads');
        }
    } catch (error) {
        console.error('System yt-dlp test failed:', error);
        addStatusUpdate(`System yt-dlp test failed: ${error.message}`);
        if (error.message.includes('not found')) {
            addStatusUpdate('💡 Install system yt-dlp with: brew install yt-dlp');
        }
    }
});

// Debug info button
const debugInfoBtn = document.getElementById('debug-info-btn');
debugInfoBtn.addEventListener('click', async () => {
    console.log('Getting debug information...');
    try {
        const debugInfo = await window.electronAPI.getDebugInfo();
        console.log('Debug Info:', debugInfo);
        
        // Display in console
        console.log(`App packaged: ${debugInfo.isPackaged}`);
        console.log(`Platform: ${debugInfo.platform}`);
        console.log(`App path: ${debugInfo.appPath}`);
        console.log(`Resources path: ${debugInfo.resourcesPath}`);
        console.log(`yt-dlp path: ${debugInfo.ytDlpPath}`);
        
        const status = debugInfo.ytDlpExists ? 
            `✅ EXISTS (${(debugInfo.ytDlpSize / 1024 / 1024).toFixed(1)}MB)` : 
            '❌ NOT FOUND';
        console.log(`yt-dlp status: ${status}`);
        
        addStatusUpdate(`Debug info logged. yt-dlp: ${debugInfo.ytDlpExists ? 'Found' : 'Missing'}`);
    } catch (error) {
        console.error('Failed to get debug info:', error);
        addStatusUpdate(`Failed to get debug info: ${error.message}`);
    }
});

// Video player events
videoPlayer.addEventListener('timeupdate', () => {
    if (!transcriptSegments || transcriptSegments.length === 0) {
        return;
    }

    const currentTime = videoPlayer.currentTime;
    let activeSpan = null;

    const spans = transcriptContent.querySelectorAll('.transcript-segment');
    for (const span of spans) {
        const start = parseFloat(span.dataset.start);
        const end = parseFloat(span.dataset.end);

        if (currentTime >= start && currentTime < end) {
            activeSpan = span;
            break;
        }
    }

    if (activeSpan) {
        if (activeSpan !== currentHighlightSpan) {
            if (currentHighlightSpan) {
                currentHighlightSpan.classList.remove('highlight');
            }
            activeSpan.classList.add('highlight');
            currentHighlightSpan = activeSpan;
            currentHighlightSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    } else {
        if (currentHighlightSpan) {
            currentHighlightSpan.classList.remove('highlight');
            currentHighlightSpan = null;
        }
    }
});

// Enhanced status update listener with progress parsing
window.electronAPI.onUpdateStatus((status) => {
    addStatusUpdate(status);
    
    // Parse progress information from status messages
    if (downloadProgress.style.display !== 'none') {
        // Look for percentage in the status message
        const percentageMatch = status.match(/(\d+\.?\d*)%/);
        if (percentageMatch) {
            const percentage = parseFloat(percentageMatch[1]);
            updateProgress(status, percentage);
        } else if (status.includes('Starting') || status.includes('Preparing')) {
            updateProgress(status);
        } else if (status.includes('completed') || status.includes('Processing complete')) {
            // Keep progress visible for a moment before hiding it
            setTimeout(() => {
                hideProgress();
            }, 1000);
        } else {
            updateProgress(status);
        }
    }
});

// Progress indicator functions
function showProgress(text = 'Preparing download...', percentage = null) {
    downloadProgress.style.display = 'block';
    progressText.textContent = text;
    
    if (percentage !== null) {
        // Determinate progress
        progressFill.classList.remove('indeterminate');
        progressFill.style.width = `${percentage}%`;
    } else {
        // Indeterminate progress
        progressFill.classList.add('indeterminate');
        progressFill.style.width = '100%';
    }
}

function updateProgress(text, percentage = null) {
    if (downloadProgress.style.display === 'none') return;
    
    progressText.textContent = text;
    
    if (percentage !== null) {
        progressFill.classList.remove('indeterminate');
        progressFill.style.width = `${percentage}%`;
    }
}

function hideProgress() {
    downloadProgress.style.display = 'none';
    progressFill.classList.remove('indeterminate');
    progressFill.style.width = '0%';
}

// Recompute transcript functionality
recomputeTranscriptBtn.addEventListener('click', async () => {
    if (!currentVideoPath) {
        addStatusUpdate('Error: No video loaded');
        return;
    }
    
    try {
        recomputeTranscriptBtn.disabled = true;
        clearTranscript();
        addStatusUpdate('Recomputing transcript from audio...');
        
        const result = await window.electronAPI.recomputeTranscript(currentVideoPath);
        
        if (result && result.segments && result.segments.length > 0) {
            transcriptSegments = result.segments;
            displayTranscriptWithTimestamps(transcriptSegments);
        } else {
            transcriptContent.innerHTML = `<p>${result?.text || '(No transcript received)'}</p>`;
            transcriptSegments = [];
        }
        
        addStatusUpdate('Transcript recomputed successfully.');
        
    } catch (error) {
        console.error('Error recomputing transcript:', error);
        handleVideoError(error);
    } finally {
        recomputeTranscriptBtn.disabled = false;
    }
});

// Initialize
console.log('Video Transcriber renderer loaded');
addStatusUpdate('Application ready. Please load a video to begin.'); 
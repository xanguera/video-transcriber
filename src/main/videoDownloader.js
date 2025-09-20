const { spawn } = require('child_process');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const downloadManager = require('./downloadManager');

/**
 * Validates YouTube URL format
 * @param {string} url - YouTube URL to validate
 * @returns {boolean} True if valid YouTube URL
 */
function validateYouTubeUrl(url) {
    const patterns = [
        /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)/,
        /^https?:\/\/(www\.)?youtube\.com\/watch\?.*v=/
    ];
    
    return patterns.some(pattern => pattern.test(url));
}

/**
 * Validates Google Drive URL format and extracts file ID
 * @param {string} url - Google Drive URL to validate
 * @returns {Object|null} {valid: boolean, fileId: string} or null
 */
function validateGoogleDriveUrl(url) {
    const patterns = [
        /\/file\/d\/([a-zA-Z0-9-_]+)/,  // /file/d/FILE_ID
        /id=([a-zA-Z0-9-_]+)/,         // ?id=FILE_ID  
        /\/d\/([a-zA-Z0-9-_]+)/        // /d/FILE_ID
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            return { valid: true, fileId: match[1] };
        }
    }
    
    return { valid: false, fileId: null };
}

/**
 * Extracts video ID from YouTube URL
 * @param {string} url - YouTube URL
 * @returns {string|null} Video ID or null
 */
function extractYouTubeVideoId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
        /youtube\.com\/watch\?.*v=([^&\n?#]+)/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            return match[1];
        }
    }
    
    return null;
}

/**
 * Gets yt-dlp binary path with fallback options
 * @param {boolean} useSystemFallback - Whether to try system yt-dlp if bundled fails
 * @returns {string} Path to yt-dlp binary
 */
function getYtDlpPath(useSystemFallback = false) {
    const extension = process.platform === 'win32' ? '.exe' : '';
    
    // If explicitly requesting system fallback, use system yt-dlp
    if (useSystemFallback) {
        console.log('Using system yt-dlp as fallback');
        return `yt-dlp${extension}`;
    }
    
    // For production (packaged app), use extraResources location
    if (app.isPackaged) {
        const extraResourcesPath = path.join(process.resourcesPath, `yt-dlp${extension}`);
        console.log(`Using packaged yt-dlp: ${extraResourcesPath}`);
        return extraResourcesPath;
    } else {
        // For development, use bundled binary
        const platformName = process.platform;
        const bundledPath = path.join(__dirname, '..', '..', 'binaries', `${platformName}-yt-dlp${extension}`);
        
        console.log(`Checking for bundled yt-dlp at: ${bundledPath}`);
        console.log(`Platform: ${platformName}, Extension: ${extension}`);
        console.log(`__dirname: ${__dirname}`);
        
        if (fs.existsSync(bundledPath)) {
            console.log(`Using bundled yt-dlp: ${bundledPath}`);
            return bundledPath;
        } else {
            // Fallback to PATH (for developers who have it installed)
            console.log(`Bundled yt-dlp not found, using system yt-dlp from PATH`);
            return `yt-dlp${extension}`;
        }
    }
}

/**
 * Downloads a video from YouTube using yt-dlp
 * @param {string} url - YouTube URL
 * @param {function} sendStatusUpdate - Status update callback
 * @returns {Promise<Object>} Download result with file path and metadata
 */
async function downloadYouTubeVideo(url, sendStatusUpdate) {
    return new Promise((resolve, reject) => {
        // Validate URL
        if (!validateYouTubeUrl(url)) {
            reject(new Error('Invalid YouTube URL format'));
            return;
        }
        
        const videoId = extractYouTubeVideoId(url);
        if (!videoId) {
            reject(new Error('Could not extract video ID from YouTube URL'));
            return;
        }
        
        // Check if video already exists
        const existing = downloadManager.checkIfVideoExists(url, 'youtube');
        if (existing) {
            sendStatusUpdate(`Video already downloaded: ${existing.title}`);
            resolve({
                filePath: existing.filePath,
                metadata: {
                    source: 'youtube',
                    title: existing.title,
                    videoId: existing.videoId,
                    alreadyExisted: true
                }
            });
            return;
        }
        
        // Ensure download directory exists
        downloadManager.ensureDownloadsDirectoryExists();
        const downloadDir = downloadManager.getDownloadsPath('youtube');
        
        // Prepare yt-dlp command
        const ytDlpPath = getYtDlpPath();
        const outputTemplate = path.join(downloadDir, 'youtube_%(id)s_%(title)s.%(ext)s');
        
        // Verify yt-dlp binary exists and is accessible
        if (!fs.existsSync(ytDlpPath)) {
            reject(new Error(`yt-dlp binary not found at: ${ytDlpPath}`));
            return;
        }
        
        // Check if binary is executable (on Unix systems)
        if (process.platform !== 'win32') {
            try {
                const stats = fs.statSync(ytDlpPath);
                if (!(stats.mode & parseInt('111', 8))) {
                    console.log(`Making yt-dlp executable: ${ytDlpPath}`);
                    fs.chmodSync(ytDlpPath, '755');
                }
            } catch (chmodError) {
                console.warn('Could not check/set yt-dlp permissions:', chmodError.message);
            }
        }
        
        const args = [
            '--format', 'best[height<=720]/best',  // Prefer 720p or best available
            '--output', outputTemplate,
            '--no-playlist',
            '--print', 'after_move:filepath',  // Print final file path
            '--print', 'title',                // Print video title
            '--print', 'duration',             // Print duration
            '--restrict-filenames',            // Use safer filenames
            '--no-check-certificate',         // Skip SSL certificate verification
            '--user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            url
        ];
        
        sendStatusUpdate('Starting YouTube download...');
        console.log(`Executing: ${ytDlpPath} ${args.join(' ')}`);
        
        const ytDlp = spawn(ytDlpPath, args);
        let outputLines = [];
        let errorOutput = '';
        
        ytDlp.stdout.on('data', (data) => {
            const output = data.toString();
            outputLines.push(output.trim());
            console.log('yt-dlp stdout:', output.trim());
            
            // Parse progress if possible
            if (output.includes('%')) {
                const match = output.match(/(\d+\.?\d*)%/);
                if (match) {
                    sendStatusUpdate(`Downloading: ${match[1]}%`);
                }
            }
        });
        
        ytDlp.stderr.on('data', (data) => {
            const error = data.toString();
            errorOutput += error;
            console.log('yt-dlp stderr:', error.trim());
            
            // Some yt-dlp output goes to stderr even on success
            if (error.includes('Downloading') || error.includes('%')) {
                const match = error.match(/(\d+\.?\d*)%/);
                if (match) {
                    sendStatusUpdate(`Downloading: ${match[1]}%`);
                }
            }
        });
        
        ytDlp.on('close', (code) => {
            if (code === 0) {
                try {
                    // Parse output to get file info
                    const validLines = outputLines.filter(line => line.trim() !== '');
                    
                    let filePath = null;
                    let title = 'Unknown Title';
                    let duration = null;
                    
                    // Find the file path (should be last line with full path)
                    for (const line of validLines.reverse()) {
                        if (line.includes(downloadDir) && (line.endsWith('.mp4') || line.endsWith('.webm') || line.endsWith('.mkv'))) {
                            filePath = line;
                            break;
                        }
                    }
                    
                    // Try to find title and duration in output
                    for (const line of validLines) {
                        if (line && !line.includes('/') && !line.includes('\\') && line.length > 0 && line.length < 200) {
                            // Likely the title
                            title = line;
                            break;
                        }
                    }
                    
                    if (!filePath) {
                        // Fallback: try to find the newest file in the YouTube directory
                        const files = fs.readdirSync(downloadDir)
                            .filter(file => file.startsWith('youtube_') && file.includes(videoId))
                            .map(file => ({
                                file,
                                path: path.join(downloadDir, file),
                                mtime: fs.statSync(path.join(downloadDir, file)).mtime
                            }))
                            .sort((a, b) => b.mtime - a.mtime);
                        
                        if (files.length > 0) {
                            filePath = files[0].path;
                        }
                    }
                    
                    if (!filePath || !fs.existsSync(filePath)) {
                        throw new Error('Downloaded file not found');
                    }
                    
                    // Get file stats
                    const stats = fs.statSync(filePath);
                    
                    const metadata = {
                        source: 'youtube',
                        title: title,
                        videoId: videoId,
                        fileSize: stats.size,
                        duration: duration
                    };
                    
                    // Add to download history
                    downloadManager.addToDownloadHistory(url, filePath, metadata);
                    
                    sendStatusUpdate(`YouTube download completed: ${title}`);
                    
                    resolve({
                        filePath: filePath,
                        metadata: metadata
                    });
                    
                } catch (parseError) {
                    console.error('Error parsing yt-dlp output:', parseError);
                    console.error('yt-dlp stdout lines:', outputLines);
                    reject(new Error(`Download completed but failed to process result: ${parseError.message}`));
                }
            } else {
                console.error('yt-dlp failed with code:', code);
                console.error('Error output:', errorOutput);
                console.error('yt-dlp stdout lines:', outputLines);
                console.error('yt-dlp command was:', `${ytDlpPath} ${args.join(' ')}`);
                
                let errorMessage = 'YouTube download failed';
                if (errorOutput.includes('Video unavailable') || errorOutput.includes('Private video')) {
                    errorMessage = 'Video is unavailable or private';
                } else if (errorOutput.includes('SSL: CERTIFICATE_VERIFY_FAILED') || errorOutput.includes('certificate verify failed')) {
                    errorMessage = 'SSL certificate verification failed. This may be due to network restrictions or outdated certificates.';
                } else if (errorOutput.includes('ssl.c:1006') || errorOutput.includes('unable to get local issuer certificate')) {
                    errorMessage = 'SSL certificate error: Unable to verify certificate. This may be due to network security settings.';
                } else if (errorOutput.includes('not found') || errorOutput.includes('command not found')) {
                    errorMessage = 'yt-dlp not found. Please install yt-dlp.';
                } else if (errorOutput.includes('network') || errorOutput.includes('HTTP Error') || errorOutput.includes('URLError')) {
                    errorMessage = 'Network error during download';
                } else if (errorOutput.includes('Sign in to confirm')) {
                    errorMessage = 'Video requires sign-in to download';
                } else if (errorOutput.includes('This video is not available')) {
                    errorMessage = 'Video is not available in your region or has been removed';
                } else if (errorOutput.includes('age-restricted')) {
                    errorMessage = 'Video is age-restricted and cannot be downloaded';
                } else if (errorOutput.includes('Permission denied') || errorOutput.includes('EACCES')) {
                    errorMessage = 'Permission denied - check file/directory permissions';
                } else if (code === 127) {
                    errorMessage = 'yt-dlp command not found - please ensure it is installed';
                } else if (code === 1) {
                    // Generic error - try to extract more specific info from stderr
                    if (errorOutput.trim()) {
                        errorMessage = `YouTube download failed: ${errorOutput.split('\n')[0]}`;
                    } else {
                        errorMessage = 'YouTube download failed - check console for details';
                    }
                }
                
                reject(new Error(errorMessage));
            }
        });
        
        ytDlp.on('error', (error) => {
            console.error('Failed to start yt-dlp:', error);
            console.error('yt-dlp path was:', ytDlpPath);
            console.error('yt-dlp exists:', fs.existsSync(ytDlpPath));
            
            let errorMessage = 'Failed to start yt-dlp. Please ensure it is installed and accessible.';
            if (error.code === 'ENOENT') {
                errorMessage = `yt-dlp binary not found at: ${ytDlpPath}`;
            } else if (error.code === 'EACCES') {
                errorMessage = `Permission denied accessing yt-dlp at: ${ytDlpPath}`;
            } else if (error.code === 'EPERM') {
                errorMessage = `Operation not permitted for yt-dlp at: ${ytDlpPath}`;
            }
            
            reject(new Error(errorMessage));
        });
    });
}

/**
 * Downloads a video from Google Drive using yt-dlp
 * @param {string} url - Google Drive URL
 * @param {function} sendStatusUpdate - Status update callback
 * @returns {Promise<Object>} Download result with file path and metadata
 */
async function downloadGoogleDriveVideo(url, sendStatusUpdate) {
    return new Promise((resolve, reject) => {
        // Validate URL
        const validation = validateGoogleDriveUrl(url);
        if (!validation.valid) {
            reject(new Error('Invalid Google Drive URL format'));
            return;
        }
        
        const fileId = validation.fileId;
        
        // Check if video already exists
        const existing = downloadManager.checkIfVideoExists(url, 'gdrive');
        if (existing) {
            sendStatusUpdate(`Video already downloaded: ${existing.title}`);
            resolve({
                filePath: existing.filePath,
                metadata: {
                    source: 'gdrive',
                    title: existing.title,
                    fileId: existing.fileId,
                    alreadyExisted: true
                }
            });
            return;
        }
        
        // Ensure download directory exists
        downloadManager.ensureDownloadsDirectoryExists();
        const downloadDir = downloadManager.getDownloadsPath('gdrive');
        
        // Prepare yt-dlp command for Google Drive
        const ytDlpPath = getYtDlpPath();
        const outputTemplate = path.join(downloadDir, 'gdrive_%(id)s_%(title)s.%(ext)s');
        
        // Verify yt-dlp binary exists and is accessible
        if (!fs.existsSync(ytDlpPath)) {
            reject(new Error(`yt-dlp binary not found at: ${ytDlpPath}`));
            return;
        }
        
        // Check if binary is executable (on Unix systems)
        if (process.platform !== 'win32') {
            try {
                const stats = fs.statSync(ytDlpPath);
                if (!(stats.mode & parseInt('111', 8))) {
                    console.log(`Making yt-dlp executable: ${ytDlpPath}`);
                    fs.chmodSync(ytDlpPath, '755');
                }
            } catch (chmodError) {
                console.warn('Could not check/set yt-dlp permissions:', chmodError.message);
            }
        }
        
        const args = [
            '--format', 'best[height<=720]/best',  // Prefer 720p or best available
            '--output', outputTemplate,
            '--no-playlist',
            '--print', 'after_move:filepath',  // Print final file path
            '--print', 'title',                // Print video title
            '--print', 'duration',             // Print duration
            '--restrict-filenames',            // Use safer filenames
            '--no-check-certificate',         // Skip SSL certificate verification
            '--user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            url
        ];
        
        sendStatusUpdate('Starting Google Drive download with yt-dlp...');
        console.log(`Executing: ${ytDlpPath} ${args.join(' ')}`);
        
        const ytDlp = spawn(ytDlpPath, args);
        let outputLines = [];
        let errorOutput = '';
        
        ytDlp.stdout.on('data', (data) => {
            const output = data.toString();
            outputLines.push(output.trim());
            console.log('yt-dlp stdout:', output.trim());
            
            // Parse progress if possible
            if (output.includes('%')) {
                const match = output.match(/(\d+\.?\d*)%/);
                if (match) {
                    sendStatusUpdate(`Downloading: ${match[1]}%`);
                }
            }
        });
        
        ytDlp.stderr.on('data', (data) => {
            const error = data.toString();
            errorOutput += error;
            console.log('yt-dlp stderr:', error.trim());
            
            // Some yt-dlp output goes to stderr even on success
            if (error.includes('Downloading') || error.includes('%')) {
                const match = error.match(/(\d+\.?\d*)%/);
                if (match) {
                    sendStatusUpdate(`Downloading: ${match[1]}%`);
                }
            }
        });
        
        ytDlp.on('close', (code) => {
            if (code === 0) {
                try {
                    // Parse output to get file info
                    const validLines = outputLines.filter(line => line.trim() !== '');
                    
                    let filePath = null;
                    let title = 'Unknown Title';
                    let duration = null;
                    
                    // Find the file path (should be last line with full path)
                    for (const line of validLines.reverse()) {
                        if (line.includes(downloadDir) && (line.endsWith('.mp4') || line.endsWith('.webm') || line.endsWith('.mkv'))) {
                            filePath = line;
                            break;
                        }
                    }
                    
                    // Try to find title and duration in output
                    for (const line of validLines) {
                        if (line && !line.includes('/') && !line.includes('\\') && line.length > 0 && line.length < 200) {
                            // Likely the title
                            title = line;
                            break;
                        }
                    }
                    
                    if (!filePath) {
                        // Fallback: try to find the newest file in the Google Drive directory
                        const files = fs.readdirSync(downloadDir)
                            .filter(file => file.startsWith('gdrive_') && file.includes(fileId))
                            .map(file => ({
                                file,
                                path: path.join(downloadDir, file),
                                mtime: fs.statSync(path.join(downloadDir, file)).mtime
                            }))
                            .sort((a, b) => b.mtime - a.mtime);
                        
                        if (files.length > 0) {
                            filePath = files[0].path;
                        }
                    }
                    
                    if (!filePath || !fs.existsSync(filePath)) {
                        throw new Error('Downloaded file not found');
                    }
                    
                    // Get file stats
                    const stats = fs.statSync(filePath);
                    
                    const metadata = {
                        source: 'gdrive',
                        title: title,
                        fileId: fileId,
                        fileSize: stats.size,
                        duration: duration
                    };
                    
                    // Add to download history
                    downloadManager.addToDownloadHistory(url, filePath, metadata);
                    
                    sendStatusUpdate(`Google Drive download completed: ${title}`);
                    
                    resolve({
                        filePath: filePath,
                        metadata: metadata
                    });
                    
                } catch (parseError) {
                    console.error('Error parsing yt-dlp output:', parseError);
                    reject(new Error(`Download completed but failed to process result: ${parseError.message}`));
                }
            } else {
                console.error('yt-dlp failed with code:', code);
                console.error('Error output:', errorOutput);
                
                let errorMessage = 'Google Drive download failed';
                if (errorOutput.includes('Private video') || errorOutput.includes('not available')) {
                    errorMessage = 'Video is private or not available';
                } else if (errorOutput.includes('not found')) {
                    errorMessage = 'yt-dlp not found. Please install yt-dlp.';
                } else if (errorOutput.includes('network') || errorOutput.includes('HTTP Error')) {
                    errorMessage = 'Network error during download';
                } else if (errorOutput.includes('Unsupported URL')) {
                    errorMessage = 'Google Drive URL not supported or file is private';
                } else if (errorOutput.includes('Sign in to confirm')) {
                    errorMessage = 'File requires sign-in to download - please make it publicly accessible';
                }
                
                reject(new Error(errorMessage));
            }
        });
        
        ytDlp.on('error', (error) => {
            console.error('Failed to start yt-dlp:', error);
            console.error('yt-dlp path was:', ytDlpPath);
            console.error('yt-dlp exists:', fs.existsSync(ytDlpPath));
            
            let errorMessage = 'Failed to start yt-dlp. Please ensure it is installed and accessible.';
            if (error.code === 'ENOENT') {
                errorMessage = `yt-dlp binary not found at: ${ytDlpPath}`;
            } else if (error.code === 'EACCES') {
                errorMessage = `Permission denied accessing yt-dlp at: ${ytDlpPath}`;
            } else if (error.code === 'EPERM') {
                errorMessage = `Operation not permitted for yt-dlp at: ${ytDlpPath}`;
            }
            
            reject(new Error(errorMessage));
        });
    });
}

/**
 * Tests if yt-dlp is working correctly
 * @returns {Promise<Object>} Test result
 */
async function testYtDlpSetup() {
    return new Promise((resolve, reject) => {
        const ytDlpPath = getYtDlpPath();
        
        console.log(`Testing yt-dlp at: ${ytDlpPath}`);
        
        if (!fs.existsSync(ytDlpPath)) {
            reject(new Error(`yt-dlp binary not found at: ${ytDlpPath}`));
            return;
        }
        
        // Test with --version command
        const ytDlp = spawn(ytDlpPath, ['--version']);
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
                    path: ytDlpPath
                });
            } else {
                console.error(`yt-dlp test failed with code ${code}`);
                console.error(`Error output: ${errorOutput}`);
                
                let errorMessage = `yt-dlp test failed with code ${code}`;
                
                // Check for specific macOS code signing issues
                if (errorOutput.includes('Team IDs') || errorOutput.includes('code signature')) {
                    errorMessage = `Code signing issue detected. The yt-dlp binary cannot run due to macOS security restrictions. This is common with downloaded binaries. Try: 1) Remove quarantine: 'xattr -d com.apple.quarantine "${ytDlpPath}"' 2) Or install yt-dlp via Homebrew: 'brew install yt-dlp'`;
                } else if (errorOutput.includes('Python') && errorOutput.includes('dlopen')) {
                    errorMessage = `Python framework loading failed. This is likely a code signing issue with the bundled yt-dlp binary. Consider installing yt-dlp via Homebrew as an alternative.`;
                } else if (code === 126) {
                    errorMessage = `Permission denied. The yt-dlp binary is not executable or blocked by macOS security.`;
                } else if (code === 127) {
                    errorMessage = `yt-dlp command not found.`;
                } else if (errorOutput.trim()) {
                    errorMessage = `yt-dlp test failed: ${errorOutput.split('\n')[0]}`;
                }
                
                reject(new Error(errorMessage));
            }
        });
        
        ytDlp.on('error', (error) => {
            console.error(`Failed to start yt-dlp: ${error}`);
            
            let errorMessage = `Failed to start yt-dlp: ${error.message}`;
            if (error.code === 'ENOENT') {
                errorMessage = `yt-dlp binary not found at: ${ytDlpPath}`;
            } else if (error.code === 'EACCES') {
                errorMessage = `Permission denied accessing yt-dlp. Try: chmod +x "${ytDlpPath}"`;
            } else if (error.code === 'EPERM') {
                errorMessage = `Operation not permitted. macOS may be blocking the yt-dlp binary due to security restrictions.`;
            }
            
            reject(new Error(errorMessage));
        });
    });
}

module.exports = {
    validateYouTubeUrl,
    validateGoogleDriveUrl,
    extractYouTubeVideoId,
    downloadYouTubeVideo,
    downloadGoogleDriveVideo,
    testYtDlpSetup
}; 
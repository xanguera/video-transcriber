const os = require('os');
const path = require('path');
const fs = require('fs');
const { shell } = require('electron');

// Directory constants
const DOWNLOADS_BASE = path.join(os.homedir(), 'VideoTranscriber', 'Downloads');
const YOUTUBE_DIR = path.join(DOWNLOADS_BASE, 'YouTube');
const GDRIVE_DIR = path.join(DOWNLOADS_BASE, 'GoogleDrive');

// Video file extensions to look for
const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm'];

/**
 * Ensures all necessary download directories exist
 */
function ensureDownloadsDirectoryExists() {
    try {
        const baseDir = path.join(os.homedir(), 'VideoTranscriber');
        if (!fs.existsSync(baseDir)) {
            fs.mkdirSync(baseDir, { recursive: true });
            console.log(`Created VideoTranscriber directory: ${baseDir}`);
        }
        
        if (!fs.existsSync(DOWNLOADS_BASE)) {
            fs.mkdirSync(DOWNLOADS_BASE, { recursive: true });
            console.log(`Created Downloads directory: ${DOWNLOADS_BASE}`);
        }
        
        if (!fs.existsSync(YOUTUBE_DIR)) {
            fs.mkdirSync(YOUTUBE_DIR, { recursive: true });
            console.log(`Created YouTube directory: ${YOUTUBE_DIR}`);
        }
        
        if (!fs.existsSync(GDRIVE_DIR)) {
            fs.mkdirSync(GDRIVE_DIR, { recursive: true });
            console.log(`Created Google Drive directory: ${GDRIVE_DIR}`);
        }
        
        return true;
    } catch (error) {
        console.error('Error creating download directories:', error);
        return false;
    }
}

/**
 * Gets the appropriate download directory for a source
 * @param {string} source - 'youtube' or 'gdrive'
 * @returns {string} Directory path
 */
function getDownloadsPath(source) {
    switch (source.toLowerCase()) {
        case 'youtube':
            return YOUTUBE_DIR;
        case 'gdrive':
            return GDRIVE_DIR;
        default:
            throw new Error(`Unknown download source: ${source}`);
    }
}

/**
 * Generates a safe filename for downloaded videos
 * @param {string} title - Video title
 * @param {string} id - Video ID
 * @param {string} source - Source type
 * @param {string} extension - File extension
 * @returns {string} Safe filename
 */
function generateSafeFilename(title, id, source, extension = 'mp4') {
    // Remove or replace unsafe characters
    const safeTitle = title
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/\s+/g, '_')
        .substring(0, 50); // Limit title length
    
    return `${source}_${id}_${safeTitle}.${extension}`;
}

/**
 * Scans a directory for video files and their metadata
 * @param {string} dirPath - Directory path to scan
 * @param {string} source - Source type ('youtube' or 'gdrive')
 * @returns {Array} Array of video file objects
 */
function scanDirectoryForVideos(dirPath, source) {
    const videos = [];
    
    try {
        if (!fs.existsSync(dirPath)) {
            return videos;
        }
        
        const files = fs.readdirSync(dirPath);
        
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const fileExt = path.extname(file).toLowerCase();
            
            // Skip if not a video file
            if (!VIDEO_EXTENSIONS.includes(fileExt)) {
                continue;
            }
            
            try {
                const stats = fs.statSync(filePath);
                const transcriptPath = filePath.replace(/\.[^/.]+$/, '.transcript.json');
                
                let videoData = {
                    filePath: filePath,
                    source: source,
                    title: path.basename(file, fileExt), // Default title from filename
                    fileSize: stats.size,
                    downloadedAt: stats.birthtime.toISOString(),
                    hasTranscript: fs.existsSync(transcriptPath)
                };
                
                // Try to load additional metadata from transcript file
                if (fs.existsSync(transcriptPath)) {
                    try {
                        const transcriptData = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));
                        if (transcriptData.generatedAt) {
                            // Use original download time if available, otherwise use transcript generation time
                            videoData.downloadedAt = transcriptData.generatedAt;
                        }
                        // Keep the filename-based title as it's more reliable
                    } catch (transcriptError) {
                        // Silently handle corrupted transcript files - they'll be regenerated when needed
                        console.log(`Note: Transcript file exists but is unreadable for ${file} (will be regenerated if needed)`);
                    }
                }
                
                // Extract title from filename pattern (source_id_title.ext)
                const filenameParts = path.basename(file, fileExt).split('_');
                if (filenameParts.length >= 3) {
                    // Remove source and ID, join the rest as title
                    const titleParts = filenameParts.slice(2);
                    videoData.title = titleParts.join('_').replace(/_/g, ' ');
                }
                
                videos.push(videoData);
                
            } catch (fileError) {
                console.warn(`Error processing file ${file}:`, fileError);
            }
        }
        
        // Sort by download date (newest first)
        videos.sort((a, b) => new Date(b.downloadedAt) - new Date(a.downloadedAt));
        
    } catch (error) {
        console.error(`Error scanning directory ${dirPath}:`, error);
    }
    
    return videos;
}

/**
 * Checks if a video already exists locally by scanning directories
 * @param {string} url - Original URL
 * @param {string} source - Source type
 * @returns {Object|null} Existing file info or null
 */
function checkIfVideoExists(url, source) {
    try {
        // This is more complex now since we don't have URL tracking
        // For now, we'll rely on the filename patterns and return null
        // The download process will handle duplicates by checking filenames
        return null;
    } catch (error) {
        console.error('Error checking existing video:', error);
        return null;
    }
}

/**
 * Gets the download history by scanning download directories
 * @returns {Object} Download history object
 */
function getDownloadHistory() {
    try {
        ensureDownloadsDirectoryExists();
        
        const youtubeVideos = scanDirectoryForVideos(YOUTUBE_DIR, 'youtube');
        const gdriveVideos = scanDirectoryForVideos(GDRIVE_DIR, 'gdrive');
        
        const allVideos = [...youtubeVideos, ...gdriveVideos];
        
        // Sort all videos by download date (newest first)
        allVideos.sort((a, b) => new Date(b.downloadedAt) - new Date(a.downloadedAt));
        
        return {
            version: "2.0.0", // Updated version to indicate new scanning approach
            downloads: allVideos
        };
    } catch (error) {
        console.error('Error getting download history:', error);
        return { version: "2.0.0", downloads: [] };
    }
}

/**
 * Opens the downloads folder in the system file manager
 */
async function openDownloadsFolder() {
    try {
        ensureDownloadsDirectoryExists();
        await shell.openPath(DOWNLOADS_BASE);
        return true;
    } catch (error) {
        console.error('Error opening downloads folder:', error);
        return false;
    }
}

/**
 * Gets storage information about downloads by scanning directories
 * @returns {Object} Storage info
 */
function getStorageInfo() {
    try {
        ensureDownloadsDirectoryExists();
        
        const youtubeVideos = scanDirectoryForVideos(YOUTUBE_DIR, 'youtube');
        const gdriveVideos = scanDirectoryForVideos(GDRIVE_DIR, 'gdrive');
        
        const allVideos = [...youtubeVideos, ...gdriveVideos];
        
        let totalSize = 0;
        let validFiles = 0;
        
        allVideos.forEach(video => {
            if (fs.existsSync(video.filePath)) {
                totalSize += video.fileSize;
                validFiles++;
            }
        });
        
        return {
            totalFiles: validFiles,
            totalSize: totalSize,
            totalSizeFormatted: formatBytes(totalSize)
        };
    } catch (error) {
        console.error('Error getting storage info:', error);
        return { totalFiles: 0, totalSize: 0, totalSizeFormatted: '0 B' };
    }
}

/**
 * Formats bytes to human readable format
 * @param {number} bytes - Bytes
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Legacy functions for compatibility (now simplified or deprecated)

/**
 * @deprecated This function is no longer needed with directory scanning approach
 * @param {string} url - Original URL  
 * @param {string} filePath - Local file path
 * @param {Object} metadata - Additional metadata
 */
function addToDownloadHistory(url, filePath, metadata) {
    // No longer needed - we scan directories on the fly
    console.log(`Legacy addToDownloadHistory call - file will be discovered automatically: ${filePath}`);
}

/**
 * @deprecated This function is no longer needed with directory scanning approach
 * @param {string} url - Original URL
 * @param {string} source - Source type
 */
function removeFromDownloadHistory(url, source) {
    // No longer needed - we scan directories on the fly
    console.log(`Legacy removeFromDownloadHistory call - file removal will be detected automatically`);
}

module.exports = {
    ensureDownloadsDirectoryExists,
    getDownloadsPath,
    generateSafeFilename,
    checkIfVideoExists,
    addToDownloadHistory, // Keep for compatibility but it's now a no-op
    removeFromDownloadHistory, // Keep for compatibility but it's now a no-op
    getDownloadHistory,
    openDownloadsFolder,
    getStorageInfo,
    scanDirectoryForVideos,
    DOWNLOADS_BASE,
    YOUTUBE_DIR,
    GDRIVE_DIR
}; 
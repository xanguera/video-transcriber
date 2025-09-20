const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Directory constants
const DOWNLOADS_BASE = path.join(os.homedir(), 'VideoTranscriber', 'Downloads');
const LOCAL_FILES_DIR = path.join(os.homedir(), 'VideoTranscriber', 'Downloads', 'local_files');
const LOCAL_METADATA_FILE = path.join(LOCAL_FILES_DIR, 'metadata.json');

/**
 * Ensures the local files directory exists
 */
function ensureLocalFilesDirectoryExists() {
    try {
        const baseDir = path.join(os.homedir(), 'VideoTranscriber');
        if (!fs.existsSync(baseDir)) {
            fs.mkdirSync(baseDir, { recursive: true });
        }
        
        if (!fs.existsSync(DOWNLOADS_BASE)) {
            fs.mkdirSync(DOWNLOADS_BASE, { recursive: true });
        }
        
        if (!fs.existsSync(LOCAL_FILES_DIR)) {
            fs.mkdirSync(LOCAL_FILES_DIR, { recursive: true });
            console.log(`Created local files directory: ${LOCAL_FILES_DIR}`);
        }
        
        return true;
    } catch (error) {
        console.error('Error creating local files directory:', error);
        return false;
    }
}

/**
 * Computes MD5 hash of a file
 * @param {string} filePath - Path to the video file
 * @returns {Promise<string>} MD5 hash of the file
 */
function computeFileMD5(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('md5');
        const stream = fs.createReadStream(filePath);
        
        stream.on('data', (data) => {
            hash.update(data);
        });
        
        stream.on('end', () => {
            resolve(hash.digest('hex'));
        });
        
        stream.on('error', (error) => {
            reject(error);
        });
    });
}

/**
 * Saves transcript for a downloaded video (next to the video file)
 * @param {string} videoPath - Path to the video file
 * @param {Object} transcriptData - Transcript data with text and segments
 * @returns {string|null} Path to saved transcript file or null if failed
 */
function saveDownloadedVideoTranscript(videoPath, transcriptData) {
    try {
        const transcriptPath = videoPath.replace(/\.[^/.]+$/, '.transcript.json');
        const transcriptToSave = {
            generatedAt: new Date().toISOString(),
            videoPath: videoPath,
            text: transcriptData.text,
            segments: transcriptData.segments
        };
        
        fs.writeFileSync(transcriptPath, JSON.stringify(transcriptToSave, null, 2));
        console.log(`Transcript saved for downloaded video: ${transcriptPath}`);
        return transcriptPath;
    } catch (error) {
        console.error('Error saving downloaded video transcript:', error);
        return null;
    }
}

/**
 * Loads transcript for a downloaded video
 * @param {string} videoPath - Path to the video file
 * @returns {Object|null} Transcript data or null if not found
 */
function loadDownloadedVideoTranscript(videoPath) {
    try {
        const transcriptPath = videoPath.replace(/\.[^/.]+$/, '.transcript.json');
        if (!fs.existsSync(transcriptPath)) {
            return null;
        }
        
        const data = fs.readFileSync(transcriptPath, 'utf8');
        const transcript = JSON.parse(data);
        console.log(`Loaded cached transcript for downloaded video: ${transcriptPath}`);
        return {
            text: transcript.text,
            segments: transcript.segments,
            generatedAt: transcript.generatedAt
        };
    } catch (error) {
        console.error('Error loading downloaded video transcript:', error);
        return null;
    }
}

/**
 * Saves transcript for a local video file using MD5 hash
 * @param {string} videoPath - Path to the video file
 * @param {Object} transcriptData - Transcript data with text and segments
 * @returns {Promise<string|null>} Path to saved transcript file or null if failed
 */
async function saveLocalVideoTranscript(videoPath, transcriptData) {
    try {
        ensureLocalFilesDirectoryExists();
        
        // Compute MD5 hash of the video file
        const md5Hash = await computeFileMD5(videoPath);
        const transcriptFileName = `transcript_${md5Hash}.json`;
        const transcriptPath = path.join(LOCAL_FILES_DIR, transcriptFileName);
        
        // Save transcript
        const transcriptToSave = {
            generatedAt: new Date().toISOString(),
            videoPath: videoPath,
            md5Hash: md5Hash,
            text: transcriptData.text,
            segments: transcriptData.segments
        };
        
        fs.writeFileSync(transcriptPath, JSON.stringify(transcriptToSave, null, 2));
        
        // Update metadata file
        const metadata = getLocalFilesMetadata();
        metadata.files[md5Hash] = {
            originalPath: videoPath,
            transcriptPath: transcriptPath,
            lastAccessed: new Date().toISOString(),
            generatedAt: transcriptToSave.generatedAt
        };
        
        fs.writeFileSync(LOCAL_METADATA_FILE, JSON.stringify(metadata, null, 2));
        console.log(`Transcript saved for local video: ${transcriptPath}`);
        return transcriptPath;
    } catch (error) {
        console.error('Error saving local video transcript:', error);
        return null;
    }
}

/**
 * Loads transcript for a local video file using MD5 hash
 * @param {string} videoPath - Path to the video file
 * @returns {Promise<Object|null>} Transcript data or null if not found
 */
async function loadLocalVideoTranscript(videoPath) {
    try {
        // Compute MD5 hash of the video file
        const md5Hash = await computeFileMD5(videoPath);
        const transcriptFileName = `transcript_${md5Hash}.json`;
        const transcriptPath = path.join(LOCAL_FILES_DIR, transcriptFileName);
        
        if (!fs.existsSync(transcriptPath)) {
            return null;
        }
        
        const data = fs.readFileSync(transcriptPath, 'utf8');
        const transcript = JSON.parse(data);
        
        // Update last accessed time in metadata
        const metadata = getLocalFilesMetadata();
        if (metadata.files[md5Hash]) {
            metadata.files[md5Hash].lastAccessed = new Date().toISOString();
            metadata.files[md5Hash].originalPath = videoPath; // Update path in case file was moved
            fs.writeFileSync(LOCAL_METADATA_FILE, JSON.stringify(metadata, null, 2));
        }
        
        console.log(`Loaded cached transcript for local video: ${transcriptPath}`);
        return {
            text: transcript.text,
            segments: transcript.segments,
            generatedAt: transcript.generatedAt
        };
    } catch (error) {
        console.error('Error loading local video transcript:', error);
        return null;
    }
}

/**
 * Gets local files metadata
 * @returns {Object} Metadata object
 */
function getLocalFilesMetadata() {
    try {
        if (!fs.existsSync(LOCAL_METADATA_FILE)) {
            const defaultMetadata = {
                version: "1.0.0",
                files: {}
            };
            ensureLocalFilesDirectoryExists();
            fs.writeFileSync(LOCAL_METADATA_FILE, JSON.stringify(defaultMetadata, null, 2));
            return defaultMetadata;
        }
        
        const data = fs.readFileSync(LOCAL_METADATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading local files metadata:', error);
        return { version: "1.0.0", files: {} };
    }
}

/**
 * Checks if a transcript exists for a video file
 * @param {string} videoPath - Path to the video file
 * @param {string} source - 'local' or 'downloaded'
 * @returns {Promise<boolean>} True if transcript exists
 */
async function hasTranscript(videoPath, source = 'local') {
    try {
        if (source === 'local') {
            const transcript = await loadLocalVideoTranscript(videoPath);
            return transcript !== null;
        } else {
            const transcript = loadDownloadedVideoTranscript(videoPath);
            return transcript !== null;
        }
    } catch (error) {
        console.error('Error checking transcript existence:', error);
        return false;
    }
}

/**
 * Deletes transcript for a video file
 * @param {string} videoPath - Path to the video file
 * @param {string} source - 'local' or 'downloaded'
 * @returns {Promise<boolean>} True if deleted successfully
 */
async function deleteTranscript(videoPath, source = 'local') {
    try {
        if (source === 'local') {
            const md5Hash = await computeFileMD5(videoPath);
            const transcriptPath = path.join(LOCAL_FILES_DIR, `transcript_${md5Hash}.json`);
            
            if (fs.existsSync(transcriptPath)) {
                fs.unlinkSync(transcriptPath);
            }
            
            // Remove from metadata
            const metadata = getLocalFilesMetadata();
            delete metadata.files[md5Hash];
            fs.writeFileSync(LOCAL_METADATA_FILE, JSON.stringify(metadata, null, 2));
            
            console.log(`Deleted transcript for local video: ${transcriptPath}`);
            return true;
        } else {
            const transcriptPath = videoPath.replace(/\.[^/.]+$/, '.transcript.json');
            if (fs.existsSync(transcriptPath)) {
                fs.unlinkSync(transcriptPath);
                console.log(`Deleted transcript for downloaded video: ${transcriptPath}`);
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error('Error deleting transcript:', error);
        return false;
    }
}

module.exports = {
    ensureLocalFilesDirectoryExists,
    computeFileMD5,
    saveDownloadedVideoTranscript,
    loadDownloadedVideoTranscript,
    saveLocalVideoTranscript,
    loadLocalVideoTranscript,
    getLocalFilesMetadata,
    hasTranscript,
    deleteTranscript,
    LOCAL_FILES_DIR
}; 
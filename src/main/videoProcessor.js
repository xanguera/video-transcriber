const path = require('path');
const fs = require('fs');
const { app, dialog } = require('electron'); // Need app for path, dialog for errors
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');

// Determine ffmpeg path (packaged vs development)
const ffmpegPath = app.isPackaged
  ? path.join(process.resourcesPath, 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
  : require('ffmpeg-static');

// Set the path for fluent-ffmpeg, handling potential errors
function setupFfmpeg() {
    if (fs.existsSync(ffmpegPath)) { 
        ffmpeg.setFfmpegPath(ffmpegPath);
        console.log(`ffmpeg path set to: ${ffmpegPath}`);
        return true;
    } else {
        console.error(`ffmpeg binary not found at expected path: ${ffmpegPath}`);
        dialog.showErrorBox('ffmpeg Error', `Could not find the required ffmpeg component at ${ffmpegPath}. The app might not function correctly.`);
        return false;
    }
}

/**
 * Processes the video file: extracts audio and sends it to OpenAI for translation.
 * @param {string} videoPath - The path to the video file.
 * @param {object} openaiClient - The initialized OpenAI client instance.
 * @param {function(string): void} sendStatusUpdate - Callback function to send status messages to the renderer.
 * @returns {Promise<{text: string, segments: Array}>} - Promise resolving with transcription text and segments.
 */
async function processVideo(videoPath, openaiClient, sendStatusUpdate) {
    if (!openaiClient) {
        sendStatusUpdate('Error: OpenAI client is not available in video processor.');
        throw new Error('OpenAI client not provided to video processor.');
    }

    console.log(`Processing video: ${videoPath}`);
    const tempDir = app.getPath('temp');
    const audioFileName = `audio_${Date.now()}.mp3`;
    const audioOutputPath = path.join(tempDir, audioFileName);
    let extractedAudioPath = null;
    let whisperResponse = null;

    try {
        // Extract Audio 
        sendStatusUpdate('Extracting audio...');
        await new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .noVideo()
                .audioCodec('libmp3lame')
                .audioBitrate('192k')
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

        // Transcribe and Translate
        sendStatusUpdate('Uploading and translating audio (this may take a while)...');
        console.log(`Transcribing audio file: ${extractedAudioPath}`);

        try {
            whisperResponse = await openaiClient.audio.translations.create({
                model: "whisper-1",
                file: fs.createReadStream(extractedAudioPath),
                response_format: "verbose_json",
            });
            console.log('Whisper API response received.');
            if (!whisperResponse || !whisperResponse.segments) {
                console.warn("Whisper response did not contain segments.");
            }
        } catch (apiError) {
            // Re-throw API errors to be handled by the caller (ipc handler)
            console.error('OpenAI API Error during processing:', apiError);
            throw apiError; // Let the IPC handler deal with 401 etc.
        } finally {
            // Clean up audio file regardless of API success/failure
            if (extractedAudioPath) {
                fs.unlink(extractedAudioPath, (err) => {
                    if (err) console.error(`Failed to delete temp audio file: ${extractedAudioPath}`, err);
                    else console.log(`Deleted temp audio file: ${extractedAudioPath}`);
                });
            }
        }

        sendStatusUpdate('Processing complete.');
        return {
            text: whisperResponse?.text || '',
            segments: whisperResponse?.segments || []
        };

    } catch (error) {
        // Catch errors from ffmpeg or other issues before API call
        console.error('Error during video processing stages:', error);
        sendStatusUpdate(`Error: ${error.message}`);
        // Ensure cleanup if audio was extracted before this error occurred
        if (extractedAudioPath && fs.existsSync(extractedAudioPath)) {
            fs.unlink(extractedAudioPath, (err) => {
              if (err) console.error(`Failed to delete temp audio file after error: ${extractedAudioPath}`, err);
              else console.log(`Cleaned up temp audio file after error: ${extractedAudioPath}`);
            });
        }
        throw error; // Re-throw the error
    }
}

module.exports = {
    setupFfmpeg,
    processVideo
}; 
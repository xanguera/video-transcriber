const loadVideoBtn = document.getElementById('load-video-btn');
const videoPlayer = document.getElementById('video-player');
const videoPlaceholder = document.getElementById('video-placeholder');
const transcriptContent = document.getElementById('transcript-content');
const statusUpdates = document.getElementById('status-updates');

let currentVideoPath = null;
let transcriptSegments = []; // Store segments with timestamps
let currentHighlightSpan = null; // Keep track of the currently highlighted span

loadVideoBtn.addEventListener('click', async () => {
  const filePath = await window.electronAPI.openFileDialog();
  if (filePath) {
    console.log('Video selected:', filePath);
    currentVideoPath = filePath;
    
    // Revoke previous object URL if exists to prevent memory leaks
    if (videoPlayer.src && videoPlayer.src.startsWith('blob:')) {
      URL.revokeObjectURL(videoPlayer.src);
    }
    
    // Create a new Blob URL. Using file path directly can have security implications.
    // Fetching and creating a Blob ensures we're only loading the intended local file.
    try {
      // Fetch the file content as a blob first
      const response = await fetch(filePath); // Note: Direct fetch might be restricted by CSP in future Electron versions. Consider reading via main process if issues arise.
      if (!response.ok) {
        throw new Error(`Failed to fetch video file: ${response.statusText}`);
      }
      const videoBlob = await response.blob();
      const videoURL = URL.createObjectURL(videoBlob);
      videoPlayer.src = videoURL;
    } catch(err) {
       console.error("Error loading video file:", err);
       addStatusUpdate(`Error loading video: ${err.message}`);
       transcriptContent.innerHTML = '<p style="color: red;">Could not load video file.</p>';
       videoPlayer.style.display = 'none';
       videoPlaceholder.style.display = 'block'; 
       return; // Stop processing
    }

    videoPlayer.style.display = 'block';
    videoPlaceholder.style.display = 'none';
    transcriptContent.innerHTML = ''; // Clear previous transcript
    statusUpdates.innerHTML = ''; // Clear previous status
    transcriptSegments = []; // Clear previous segments
    currentHighlightSpan = null;
    addStatusUpdate('Video loaded. Starting processing...');

    try {
      // Process video returns { text, segments }
      const result = await window.electronAPI.processVideo(filePath);
      
      if (result && result.segments && result.segments.length > 0) {
        transcriptSegments = result.segments;
        displayTranscriptWithTimestamps(transcriptSegments);
      } else {
        // Fallback if no segments are available
        transcriptContent.innerHTML = `<p>${result?.text || '(No transcript received)'}</p>`;
        transcriptSegments = []; // Ensure it's empty
      }

    } catch (error) {
      console.error('Error processing video:', error);
      addStatusUpdate(`Error: ${error.message}`);
      transcriptContent.innerHTML = '<p style="color: red;">Failed to process video.</p>';
      transcriptSegments = []; // Clear segments on error
    }
  }
});

// Listen for status updates from the main process
window.electronAPI.onUpdateStatus((message) => {
  console.log('Status Update:', message);
  addStatusUpdate(message);
});

function addStatusUpdate(message) {
    const statusElement = document.createElement('p');
    // Basic XSS prevention: display message as text content
    statusElement.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    // Append the new status at the end
    statusUpdates.appendChild(statusElement);
}

function displayTranscriptWithTimestamps(segments) {
    transcriptContent.innerHTML = ''; // Clear previous content
    segments.forEach(segment => {
        const span = document.createElement('span');
        // Add a space after each segment for readability
        span.textContent = segment.text + ' '; 
        span.dataset.start = segment.start; // Store start time
        span.dataset.end = segment.end;     // Store end time
        span.classList.add('transcript-segment'); // Add class for easier selection
        // Optional: Add unique ID if needed later
        // span.id = `segment-${segment.id}`; 
        transcriptContent.appendChild(span);
    });
}

// Highlight transcript segment based on video time
videoPlayer.addEventListener('timeupdate', () => {
    if (!transcriptSegments || transcriptSegments.length === 0) {
        return; // No segments to highlight
    }

    const currentTime = videoPlayer.currentTime;
    let activeSpan = null;

    // Find the segment that contains the current time
    const spans = transcriptContent.querySelectorAll('.transcript-segment');
    for (const span of spans) {
        const start = parseFloat(span.dataset.start);
        const end = parseFloat(span.dataset.end);

        if (currentTime >= start && currentTime < end) {
            activeSpan = span;
            break; // Found the current segment
        }
    }

    // Update highlighting
    if (activeSpan) {
        if (activeSpan !== currentHighlightSpan) {
            // Remove highlight from the previous span (if any)
            if (currentHighlightSpan) {
                currentHighlightSpan.classList.remove('highlight');
            }
            // Add highlight to the new current span
            activeSpan.classList.add('highlight');
            currentHighlightSpan = activeSpan;
            
            // Optional: Scroll the transcript view to keep the highlighted word visible
            currentHighlightSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    } else {
        // If no segment matches (e.g., beginning, end, or gap), remove highlight
        if (currentHighlightSpan) {
            currentHighlightSpan.classList.remove('highlight');
            currentHighlightSpan = null;
        }
    }
}); 
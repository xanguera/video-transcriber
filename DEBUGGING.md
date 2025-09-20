# Debugging YouTube Download Issues

## Quick Diagnosis

If you're getting "YouTube download failed" errors, follow these steps:

### 1. Open Console Panel
- Click the console icon (⚡) in the bottom-right corner of the app
- This will show detailed error messages

### 2. Test yt-dlp Setup
- Click the "Test yt-dlp" button in the console panel
- This verifies the yt-dlp binary is working correctly

### 3. Check Debug Info
- Click the "Debug Info" button to see:
  - Whether the app is packaged
  - Platform information
  - yt-dlp binary locations and status

### 4. Try Download Again
- Attempt the YouTube download
- Watch the console for specific error messages

## Common Issues & Solutions

### "yt-dlp binary not found"
- **Cause**: Binary not included in package or wrong path
- **Solution**: Rebuild the app with `npm run build`

### "Video is unavailable or private"
- **Cause**: The YouTube video is private, deleted, or region-restricted
- **Solution**: Try a different public video

### "Network error during download"
- **Cause**: Internet connectivity or YouTube blocking
- **Solution**: Check internet connection, try again later

### "Video requires sign-in to download"
- **Cause**: Age-restricted or premium content
- **Solution**: Use a different video

### "Permission denied"
- **Cause**: macOS Gatekeeper blocking unsigned binary
- **Solution**: 
  1. Go to System Preferences > Security & Privacy
  2. Allow the app to run
  3. Or try: `xattr -cr "/path/to/Video Transcriber.app"`

### "Code signing issue detected" / "Team IDs"
- **Cause**: yt-dlp binary has different code signature than the app
- **Solution**: 
  1. **Remove quarantine**: `xattr -d com.apple.quarantine "/path/to/yt-dlp"`
  2. **Install system yt-dlp**: `brew install yt-dlp` (recommended)
  3. **Test system yt-dlp**: Use "Test System yt-dlp" button in console

### "Python framework loading failed"
- **Cause**: PyInstaller-packaged yt-dlp conflicts with app's code signature
- **Solution**: Install system yt-dlp via Homebrew: `brew install yt-dlp`

## Developer Tools

### Verify Build
```bash
npm run verify-build
```
Checks if yt-dlp binaries are included in the built app.

### Test Packaged yt-dlp
```bash
npm run test-packaged-ytdlp
```
Tests yt-dlp path resolution in packaged app context.

### Manual Binary Test
```bash
# Test the binary directly
./binaries/darwin-yt-dlp --version
./binaries/darwin-yt-dlp --print title "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

## Reporting Issues

When reporting issues, please include:

1. **Console output** from the app's console panel
2. **Debug info** from the Debug Info button
3. **Operating system** version
4. **YouTube URL** that's failing (if not private)
5. **Error message** from the status area

## Build Configuration

The app includes yt-dlp binaries via:

- **Development**: `binaries/darwin-yt-dlp` (or platform equivalent)
- **Packaged**: `Contents/Resources/yt-dlp` (via extraResources)

The path resolution logic is simplified:
1. **Packaged apps**: Always use `Resources/yt-dlp`
2. **Development**: Use `binaries/{platform}-yt-dlp`
3. **Fallback**: System PATH (development only)

### Clean Packaging Approach

Each platform only includes its own binaries:
- **macOS**: `darwin-yt-dlp` → `Resources/yt-dlp`
- **Windows**: `win32-yt-dlp.exe` → `Resources/yt-dlp.exe`  
- **Linux**: `linux-yt-dlp` → `Resources/yt-dlp`

No unnecessary cross-platform binaries are included. 
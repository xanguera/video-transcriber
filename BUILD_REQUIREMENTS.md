# Build Requirements

This project builds yt-dlp from source to ensure proper code signing and avoid macOS security issues.

## Prerequisites

### macOS (Required for signing)

1. **Python 3.8+**
   ```bash
   # Check if installed
   python3 --version
   
   # Install if needed (via Homebrew)
   brew install python3
   
   # Or download from https://python.org
   ```

2. **pip3**
   ```bash
   # Usually comes with Python 3, verify:
   pip3 --version
   ```

3. **Code Signing Certificate**
   - Must have "ELSA, Corp. (DQ47627WZ6)" certificate in Keychain
   - Certificate must be valid for code signing

4. **Xcode Command Line Tools** (for code signing)
   ```bash
   xcode-select --install
   ```

## Build Process

### Automatic (Recommended)
```bash
npm install        # Builds yt-dlp automatically via postinstall
npm run build      # Builds app with signed yt-dlp
```

### Manual
```bash
npm run build-ytdlp    # Build yt-dlp from source only
npm run verify-build   # Verify the built app includes signed binary
```

## What Happens During Build

1. **Download**: yt-dlp source code from GitHub (version 2024.12.13)
2. **Extract**: Source code to temporary build directory
3. **Install**: PyInstaller and dependencies via pip3
4. **Compile**: yt-dlp using PyInstaller with code signing
5. **Verify**: Binary works and is properly signed
6. **Clean**: Remove temporary build files

## Output

- **Location**: `binaries/darwin-yt-dlp`
- **Size**: ~30-40MB (similar to downloaded version)
- **Signature**: Signed with "ELSA, Corp. (DQ47627WZ6)"
- **No quarantine issues**: Runs without macOS security warnings

## Troubleshooting

### "Python3 not found"
Install Python 3.8+ from https://python.org or via Homebrew

### "pip3 not found"
Usually comes with Python 3. Try reinstalling Python.

### "Code signing failed"
Ensure the certificate "ELSA, Corp. (DQ47627WZ6)" is in your Keychain and valid.

### "PyInstaller failed"
Try installing dependencies manually:
```bash
pip3 install --user pyinstaller setuptools wheel
```

### Build takes too long
The first build downloads and compiles everything (~2-3 minutes). Subsequent builds are faster if dependencies are cached.

## Benefits

- ✅ **No quarantine issues**: Properly signed with your certificate
- ✅ **Same Team ID**: No macOS security conflicts
- ✅ **Predictable**: Same yt-dlp version every time
- ✅ **Professional**: No user setup required
- ✅ **Secure**: Full control over the binary 
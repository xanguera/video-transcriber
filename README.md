# Video Transcriber

**IMPORTANT: yt-dlp keeps being updated to fight against Youtube anti-download tactics. Whenever it stops working we will need to download again**

A simple Electron application to transcribe and translate video files using OpenAI's Whisper API.

## Features

*   Load local video files.
*   **Download videos from YouTube URLs** using yt-dlp (bundled with app).
*   **Download videos from Google Drive** (public files).
*   **Persistent storage** - downloaded videos are saved to `~/VideoTranscriber/Downloads/` for reuse.
*   **Download history** - browse and reload previously downloaded videos.
*   Extract audio using ffmpeg.
*   Transcribe audio using OpenAI Whisper.
*   Display transcript synchronized with video playback.
*   Highlight words in the transcript as they are spoken.
*   Prompts for OpenAI API key on first run and stores it securely.

## Prerequisites

*   Node.js and npm (or yarn)
*   An OpenAI API Key

**Note:** yt-dlp and ffmpeg are bundled with the application - no additional software installation required!

## Installation

1.  Clone the repository (or download the source code).
2.  Navigate to the project directory in your terminal.
3.  Install dependencies:
    ```bash
    npm install
    ```

The yt-dlp binaries will be automatically downloaded during installation.

## Usage

### Loading Videos

The application provides three ways to load videos:

1. **Local Files**: Click "Load Local Video" to select a file from your computer
2. **YouTube URLs**: Select "Download from YouTube" and enter a YouTube URL
3. **Google Drive URLs**: Select "Download from Google Drive" and enter a public Google Drive video URL

### Managing Downloads

- **Downloads Folder**: Click the folder icon (📁) to open your downloads directory
- **Browse Downloads**: Access previously downloaded videos through "Browse Downloaded Videos"
- **Download Location**: Videos are saved to `~/VideoTranscriber/Downloads/`
  - YouTube videos: `~/VideoTranscriber/Downloads/YouTube/`
  - Google Drive videos: `~/VideoTranscriber/Downloads/GoogleDrive/`

## Custom Application Icons

Replace the default Electron icon with your custom logo for a branded application experience.

### Quick Setup

1. **Place Your Logo**: Put your logo file as `elsa_logo.png` in the project root directory
   - For best results: square aspect ratio (1:1), at least 512x512 pixels
   - Transparent background recommended

2. **Run Icon Setup Script**:
   ```bash
   npm run setup-icons
   ```
   This copies your PNG for Linux/window icons and shows conversion instructions.

### Converting to Platform-Specific Formats

#### Method 1: Icon Kitchen (Recommended - Easiest)
1. Visit [Icon Kitchen](https://icon.kitchen/)
2. Upload your `elsa_logo.png`
3. Download the generated icons pack
4. Extract and copy:
   - `icon.icns` → `build/icons/icon.icns` (macOS)
   - `icon.ico` → `build/icons/icon.ico` (Windows)

#### Method 2: Online Converters
- **macOS (.icns)**: [PNG to ICNS converter](https://convertio.co/png-icns/)
- **Windows (.ico)**: [PNG to ICO converter](https://convertio.co/png-ico/)

#### Method 3: macOS Command Line (Advanced)
If you're on macOS, use built-in tools:

```bash
# Create iconset with multiple sizes
mkdir icon.iconset
sips -z 16 16     elsa_logo.png --out icon.iconset/icon_16x16.png
sips -z 32 32     elsa_logo.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     elsa_logo.png --out icon.iconset/icon_32x32.png
sips -z 64 64     elsa_logo.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   elsa_logo.png --out icon.iconset/icon_128x128.png
sips -z 256 256   elsa_logo.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   elsa_logo.png --out icon.iconset/icon_256x256.png
sips -z 512 512   elsa_logo.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   elsa_logo.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 elsa_logo.png --out icon.iconset/icon_512x512@2x.png

# Convert to .icns format
iconutil -c icns icon.iconset
mv icon.icns build/icons/
rm -rf icon.iconset
```

### Required File Structure
After setup, you should have:
```
build/icons/
├── icon.png     # Auto-generated (Linux & window icons)
├── icon.icns    # Manual (macOS builds)
└── icon.ico     # Manual (Windows builds)
```

### Testing Icons
- **Development**: `npm start` - see icons in window title bar and dock
- **Production**: `npm run build` - creates apps with custom icons

*For detailed troubleshooting and additional options, see `SETUP_ICONS.md`.*

## PAckaging and shipping (Xavi)

first compile it
`npm run build`

then run this command
`pkgbuild --root "dist/mac-arm64/" --component-plist "component.plist" --install-location "/Applications" --scripts "scripts" --version "1.0.0" --identifier "com.elsa.videotranscriber.pkg" dist/VideoTranscriberInstaller-1.0.0.pkg`


## Running in Development Mode

To run the application locally for development:

```bash
npm start
```

The application will launch, and you may be prompted for your OpenAI API key if it's the first time or the key is invalid.

## Building the Application

To build the application package (e.g., for macOS, Windows, Linux):

```bash
npm run build
```

This command uses `electron-builder` to create distributable files in the `dist/` directory based on the configuration in `package.json`.

*   **Icons:** For custom branding, see the "Custom Application Icons" section above. Ensure all icon formats (`icon.png`, `icon.icns`, `icon.ico`) are in the `build/icons/` directory before building.
*   **Output:** For macOS, this command (as currently configured) creates a `.zip` file and a directory containing the `.app` bundle (e.g., `dist/mac-arm64/`).

## Creating a macOS PKG Installer 

### Method 1: Using pkgbuild with a successful electron-builder build

To create a user-friendly `.pkg` installer for macOS that handles permissions correctly:

1.  **Ensure the app is built:** Run `npm run build` first to generate the `.app` bundle (e.g., in `dist/mac-arm64/`).
2.  **Ensure the postinstall script exists:** Make sure `scripts/postinstall` exists and is executable (`chmod +x scripts/postinstall`). This script runs `xattr -cr` on the installed application.
3.  **Ensure the component plist exists:** Make sure `component.plist` exists in the project root, correctly referencing the app bundle details and your app's bundle identifier.
4.  **Run pkgbuild:** Execute the following command in the project root directory:

    ```bash
    pkgbuild --root "dist/mac-arm64/" \
             --component-plist "component.plist" \
             --install-location "/Applications" \
             --scripts "scripts" \
             --version "1.0.0" \
             --identifier "com.elsa.videotranscriber.pkg" \
             --sign "Developer ID Installer: ELSA, Corp. (DQ47627WZ6)" \
             dist/VideoTranscriberInstaller-1.0.0.pkg
    ```


5.  **Distribute:** Share the generated `dist/VideoTranscriberInstaller-*.pkg` file.

### Method 2: Using pkgbuild with a previously successful build

If you encounter issues with `electron-builder` repeatedly failing to build with errors like "Application entry file main.js in app.asar does not exist," you can use a previously successful build:

1.  **Locate a previous successful build:** Find an existing `.app` bundle from a previous build (e.g., in an `OLD_dist/mac-arm64/` directory).
2.  **Update component.plist:** Make sure `component.plist` has the correct bundle identifier matching your app.
3.  **Make the postinstall script executable:**
    ```bash
    chmod +x scripts/postinstall
    ```
4.  **Run pkgbuild with the existing build:**
    ```bash
    pkgbuild --root "OLD_dist/mac-arm64/" \
             --component-plist "component.plist" \
             --install-location "/Applications" \
             --scripts "scripts" \
             --version "1.0.0" \
             --identifier "com.elsa.videotranscriber.pkg" \
             dist/VideoTranscriberInstaller-1.0.0.pkg
    ```

This installer will copy the application to `/Applications` and run the post-install script to remove the quarantine attribute, allowing users to run the app after installation (they might still need to right-click -> Open the very first time). 

## Packaging and Signing the Video Transcriber App

### 1. Obtain an Apple Developer Certificate

Before signing, obtain an Apple Developer certificate:
- Enroll in the Apple Developer Program
- Create a Developer ID Application certificate in your Apple Developer account
- Download and install the certificate in your Keychain

### 2. Configure Code Signing in package.json

Update the `mac` section in your package.json:

```json
"mac": {
  "target": [
    "dir",
    "zip",
    "dmg"
  ],
  "hardenedRuntime": true,
  "gatekeeperAssess": true,
  "entitlements": "build/entitlements.mac.plist",
  "entitlementsInherit": "build/entitlements.mac.plist",
  "identity": "Developer ID Application: Your Company Name (TEAMID)"
}
```

Replace `"Your Company Name (TEAMID)"` with your actual Apple Developer certificate name.

### 3. Build and Sign the Application

Run the build command:

```bash
npm run build
```

This will build and sign your application using electron-builder.

### 4. Create a Notarized PKG Installer (Optional)

For distribution outside the App Store:

```bash
# First, notarize the .app bundle
xcrun notarytool submit dist/mac-arm64/Video\ Transcriber.app --apple-id "your@email.com" --password "app-specific-password" --team-id "TEAMID" --wait

# Then create the PKG installer
pkgbuild --root "dist/mac-arm64/" \
         --component-plist "component.plist" \
         --install-location "/Applications" \
         --scripts "scripts" \
         --version "1.0.0" \
         --identifier "com.elsa.videotranscriber.pkg" \
         --sign "Developer ID Installer: ELSA, Corp. (DQ47627WZ6)" \
         dist/VideoTranscriberInstaller-1.0.0.pkg
```

### 5. Setting Up Automatic Notarization

To enable automatic notarization during the build process:

1. **Create the notarize.js script**: Create a file at `scripts/notarize.js` with the following content:

```javascript
const { notarize } = require('@electron/notarize');
const { build } = require('../package.json');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  
  // Only notarize on macOS
  if (electronPlatformName !== 'darwin') {
    return;
  }

  // Check if notarization is enabled
  if (!process.env.APPLE_ID || !process.env.APPLE_ID_PASSWORD) {
    console.log('Skipping notarization: environment variables not set');
    return;
  }

  console.log('Notarizing application...');

  const appName = context.packager.appInfo.productFilename;
  const appBundleId = build.appId || 'com.elsa.videotranscriber';

  return await notarize({
    appBundleId,
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_ID_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  });
};
```

2. **Install required dependency**:
```bash
npm install --save-dev @electron/notarize
```

3. **Enable in package.json**: Ensure the `afterSign` hook is specified in your package.json build config:
```json
"build": {
  "afterSign": "scripts/notarize.js"
}
```

4. **Set environment variables for notarization**: When building, provide your Apple credentials:
```bash
APPLE_ID="your@email.com" APPLE_ID_PASSWORD="app-specific-password" APPLE_TEAM_ID="YOUR_TEAM_ID" npm run build
```

The script is designed to skip notarization when environment variables aren't set, allowing you to run a normal build without notarization during development.

For more details on notarization, refer to Apple's documentation or the [@electron/notarize](https://github.com/electron/notarize) package. 

## Running in another machine

When trying to install in another machine, it will complain that the app is not secure.

Go to settings -> privacy & security 
scroll down to the bottom and allow the app to install anyway.
Then your app will be in the applications folder
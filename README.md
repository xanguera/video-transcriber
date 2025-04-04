# Video Transcriber

A simple Electron application to transcribe and translate video files using OpenAI's Whisper API.

## Features

*   Load local video files.
*   Extract audio using ffmpeg.
*   Transcribe audio using OpenAI Whisper.
*   Display transcript synchronized with video playback.
*   Highlight words in the transcript as they are spoken.
*   Prompts for OpenAI API key on first run and stores it securely.

## Prerequisites

*   Node.js and npm (or yarn)
*   An OpenAI API Key

## Installation

1.  Clone the repository (or download the source code).
2.  Navigate to the project directory in your terminal.
3.  Install dependencies:
    ```bash
    npm install
    ```

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

*   **Icons:** Place your custom icons (`icon.icns`, `icon.ico`, `icon.png`) in the `build/` directory before running the build command.
*   **Output:** For macOS, this command (as currently configured) creates a `.zip` file and a directory containing the `.app` bundle (e.g., `dist/mac-arm64/`).

## Creating a macOS PKG Installer (Optional)

To create a user-friendly `.pkg` installer for macOS that handles permissions correctly for unsigned apps:

1.  **Ensure the app is built:** Run `npm run build` first to generate the `.app` bundle (e.g., in `dist/mac-arm64/`).
2.  **Ensure the postinstall script exists:** Make sure `scripts/postinstall` exists and is executable (`chmod +x scripts/postinstall`). This script runs `xattr -cr` on the installed application.
3.  **Ensure the component plist exists:** Make sure `component.plist` exists in the project root, correctly referencing the app bundle details.
4.  **Run pkgbuild:** Execute the following command in the project root directory:

    ```bash
    pkgbuild --root "dist/mac-arm64/" \
             --component-plist "component.plist" \
             --install-location "/Applications" \
             --scripts "scripts" \
             --version "1.0.0" \
             --identifier "com.yourapp.videotranscriber.pkg" \
             dist/VideoTranscriberInstaller-1.0.0.pkg 
    ```
    *   *(Adjust `--root`, `--version`, and `--identifier` if necessary)*

5.  **Distribute:** Share the generated `dist/VideoTranscriberInstaller-*.pkg` file.

This installer will copy the application to `/Applications` and run the post-install script to remove the quarantine attribute, allowing users to run the unsigned app after installation (they might still need to right-click -> Open the very first time). 
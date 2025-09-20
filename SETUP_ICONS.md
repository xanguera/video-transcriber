# Setting Up Custom Icons for Video Transcriber

This guide explains how to replace the default Electron icon with your custom ELSA logo.

## Quick Setup Steps

### 1. Place Your Logo
- Put your `elsa_logo.png` file in the project root directory
- For best results, ensure your logo is:
  - Square aspect ratio (1:1)
  - At least 512x512 pixels
  - Has transparent background if desired

### 2. Run the Icon Setup Script
```bash
npm run setup-icons
```

This script will:
- ✅ Copy your PNG logo for Linux and window icons
- 📋 Provide instructions for creating macOS (.icns) and Windows (.ico) formats

### 3. Create Platform-Specific Icons

You have several options:

#### Option A: Online Converter (Recommended - Easiest)
1. Visit [Icon Kitchen](https://icon.kitchen/)
2. Upload your `elsa_logo.png`
3. Download the generated icons pack
4. Extract and copy the files:
   - `icon.icns` → `build/icons/icon.icns` (macOS)
   - `icon.ico` → `build/icons/icon.ico` (Windows)

#### Option B: Individual Online Converters
- **macOS**: [PNG to ICNS converter](https://convertio.co/png-icns/)
- **Windows**: [PNG to ICO converter](https://convertio.co/png-ico/)

#### Option C: macOS Built-in Tools (Advanced)
If you're on macOS, you can use the built-in `sips` and `iconutil` commands:

```bash
# Create iconset directory
mkdir icon.iconset

# Generate different sizes
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

# Create .icns file
iconutil -c icns icon.iconset

# Move to correct location
mv icon.icns build/icons/

# Clean up
rm -rf icon.iconset
```

## File Structure

After setup, your `build/icons/` directory should contain:

```
build/icons/
├── icon.png     # For Linux and window icons (auto-generated)
├── icon.icns    # For macOS builds (manual)
└── icon.ico     # For Windows builds (manual)
```

## Testing Your Icons

### Development Mode
```bash
npm start
```
The application window should now display your custom icon in the title bar and dock/taskbar.

### Production Builds
```bash
npm run build
```
The built application will include your custom icons for the appropriate platform.

## Platform-Specific Icon Locations

### During Development
- **Window Icon**: Appears in window title bar and taskbar
- **Dock Icon** (macOS): Appears in dock when app is running

### In Built Applications
- **macOS**: `.icns` icon appears in Finder, dock, and throughout the system
- **Windows**: `.ico` icon appears in file explorer, start menu, and taskbar  
- **Linux**: `.png` icon appears in file managers and app menus

## Troubleshooting

### Icon Not Appearing
1. Verify files exist in `build/icons/` directory:
   ```bash
   ls -la build/icons/
   ```

2. Check that your source logo exists:
   ```bash
   ls -la elsa_logo.png
   ```

3. Restart the application completely:
   ```bash
   npm start
   ```

### Icon Quality Issues
- Ensure source image is at least 512x512 pixels
- Use square aspect ratio (1:1)
- Avoid overly complex designs for small icon sizes
- Test with transparent and solid backgrounds

### Build Issues
- Make sure all three icon formats exist before running `npm run build`
- Check electron-builder logs for icon-related errors
- Verify file permissions on icon files

## Icon Configuration Details

The icon setup modifies these files:
- `src/main/windowManager.js` - Sets window icons for development
- `package.json` - Configures build icons for electron-builder
- `build/icons/` - Contains the actual icon files

### Reverting Changes
To remove custom icons and use Electron defaults:
1. Delete the `build/icons/` directory
2. Remove the `icon:` lines from `src/main/windowManager.js`
3. Remove the `icon:` entries from `package.json` build configuration 
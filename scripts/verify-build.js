const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying build includes yt-dlp binaries...\n');

// Check if binaries exist in source
const binariesDir = path.join(__dirname, '..', 'binaries');
const platforms = ['darwin', 'win32', 'linux'];

console.log('📁 Source binaries:');
platforms.forEach(platform => {
    const extension = platform === 'win32' ? '.exe' : '';
    const binaryPath = path.join(binariesDir, `${platform}-yt-dlp${extension}`);
    const exists = fs.existsSync(binaryPath);
    const size = exists ? (fs.statSync(binaryPath).size / 1024 / 1024).toFixed(1) + 'MB' : 'N/A';
    console.log(`  ${platform}: ${exists ? '✅' : '❌'} ${exists ? size : 'Missing'}`);
});

// Check dist directory if it exists
const distDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
    console.log('\n📦 Checking dist directory...');
    
    // Look for app directories
    const distContents = fs.readdirSync(distDir);
    distContents.forEach(item => {
        const itemPath = path.join(distDir, item);
        if (fs.statSync(itemPath).isDirectory()) {
            console.log(`\n📂 Checking ${item}:`);
            
            // Look for .app bundles first
            const appFiles = fs.readdirSync(itemPath).filter(file => file.endsWith('.app'));
            if (appFiles.length > 0) {
                appFiles.forEach(appFile => {
                    const appPath = path.join(itemPath, appFile);
                    console.log(`  📱 Found app bundle: ${appFile}`);
                    checkAppForBinaries(appPath, appFile);
                });
            } else {
                // Check the directory itself (for non-Mac builds)
                checkAppForBinaries(itemPath, item);
            }
        }
    });
} else {
    console.log('\n📦 No dist directory found. Run "npm run build" first.');
}

function checkAppForBinaries(appPath, appName) {
    console.log(`  Checking ${appName} for yt-dlp binary:`);
    
    // Check for extraResources yt-dlp (new simplified approach)
    const extraResourcesPaths = [
        path.join(appPath, 'Contents', 'Resources', 'yt-dlp'),
        path.join(appPath, 'Contents', 'Resources', 'yt-dlp.exe'),
        path.join(appPath, 'resources', 'yt-dlp'),
        path.join(appPath, 'resources', 'yt-dlp.exe')
    ];
    
    let found = false;
    extraResourcesPaths.forEach((checkPath, index) => {
        console.log(`    ${index + 1}. Checking: ${checkPath}`);
        if (fs.existsSync(checkPath)) {
            const stats = fs.statSync(checkPath);
            const size = (stats.size / 1024 / 1024).toFixed(1) + 'MB';
            console.log(`  ✅ Found yt-dlp binary at: ${checkPath} (${size})`);
            
            // Check if executable
            if (process.platform !== 'win32') {
                const isExecutable = stats.mode & parseInt('111', 8);
                console.log(`    Executable: ${isExecutable ? '✅ Yes' : '❌ No'}`);
            }
            found = true;
        } else {
            console.log(`    ❌ Not found: ${checkPath}`);
        }
    });
    
    // Also check for ffmpeg
    const ffmpegPaths = [
        path.join(appPath, 'Contents', 'Resources', 'ffmpeg'),
        path.join(appPath, 'Contents', 'Resources', 'ffmpeg.exe'),
        path.join(appPath, 'resources', 'ffmpeg'),
        path.join(appPath, 'resources', 'ffmpeg.exe')
    ];
    
    console.log(`  Checking ${appName} for ffmpeg binary:`);
    ffmpegPaths.forEach((checkPath, index) => {
        console.log(`    ${index + 1}. Checking: ${checkPath}`);
        if (fs.existsSync(checkPath)) {
            const stats = fs.statSync(checkPath);
            const size = (stats.size / 1024 / 1024).toFixed(1) + 'MB';
            console.log(`  ✅ Found ffmpeg binary at: ${checkPath} (${size})`);
        } else {
            console.log(`    ❌ Not found: ${checkPath}`);
        }
    });
    
    if (!found) {
        console.log('  ❌ No yt-dlp binary found in expected locations');
    }
}

console.log('\n✨ Verification complete!'); 
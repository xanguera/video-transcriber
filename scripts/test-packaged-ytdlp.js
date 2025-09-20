const path = require('path');
const fs = require('fs');

// Simulate packaged app environment
const mockApp = {
    isPackaged: true,
    getAppPath: () => '/Applications/Video Transcriber.app/Contents/Resources/app.asar'
};

const mockProcess = {
    resourcesPath: '/Applications/Video Transcriber.app/Contents/Resources',
    platform: 'darwin'
};

function getYtDlpPath() {
    const extension = mockProcess.platform === 'win32' ? '.exe' : '';
    
    // For production (packaged app), use extraResources location
    if (mockApp.isPackaged) {
        const extraResourcesPath = path.join(mockProcess.resourcesPath, `yt-dlp${extension}`);
        console.log(`✅ Using packaged yt-dlp: ${extraResourcesPath}`);
        return extraResourcesPath;
    } else {
        // For development, use bundled binary
        const platformName = mockProcess.platform;
        const bundledPath = path.join(__dirname, '..', 'binaries', `${platformName}-yt-dlp${extension}`);
        
        if (fs.existsSync(bundledPath)) {
            console.log(`✅ Using bundled yt-dlp: ${bundledPath}`);
            return bundledPath;
        } else {
            console.log(`❌ Bundled yt-dlp not found, using system yt-dlp from PATH`);
            return `yt-dlp${extension}`;
        }
    }
}

console.log('🧪 Testing yt-dlp path resolution in packaged app context...\n');

// Test with the actual built app
const actualAppPath = path.join(__dirname, '..', 'dist', 'mac-arm64', 'Video Transcriber.app', 'Contents', 'Resources');
if (fs.existsSync(actualAppPath)) {
    console.log(`📱 Testing with actual built app at: ${actualAppPath}\n`);
    
    // Update mock to use actual paths
    mockProcess.resourcesPath = actualAppPath;
    mockApp.getAppPath = () => path.join(actualAppPath, 'app.asar');
    
    const ytDlpPath = getYtDlpPath();
    console.log(`\n🎯 Final yt-dlp path: ${ytDlpPath}`);
    
    if (fs.existsSync(ytDlpPath)) {
        const stats = fs.statSync(ytDlpPath);
        const size = (stats.size / 1024 / 1024).toFixed(1) + 'MB';
        console.log(`✅ Binary exists and is ${size}`);
        
        // Test if it's executable
        if (stats.mode & parseInt('111', 8)) {
            console.log('✅ Binary is executable');
        } else {
            console.log('⚠️  Binary is not executable');
        }
    } else {
        console.log('❌ Binary not found at resolved path');
    }
} else {
    console.log('❌ Built app not found. Run "npm run build" first.');
} 
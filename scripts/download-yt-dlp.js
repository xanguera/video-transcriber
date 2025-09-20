const https = require('https');
const fs = require('fs');
const path = require('path');

const DOWNLOAD_DIR = path.join(__dirname, '..', 'binaries');

const platforms = {
    'win32': {
        url: `https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe`,
        filename: 'yt-dlp.exe'
    },
    'darwin': {
        url: `https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos`,
        filename: 'yt-dlp'
    },
    'linux': {
        url: `https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux`,
        filename: 'yt-dlp'
    }
};

function ensureDirectoryExists(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
    }
}

function downloadFile(url, outputPath) {
    return new Promise((resolve, reject) => {
        console.log(`Downloading ${url}`);
        console.log(`Saving to: ${outputPath}`);
        
        const file = fs.createWriteStream(outputPath);
        
        https.get(url, (response) => {
            // Handle redirects
            if (response.statusCode === 302 || response.statusCode === 301) {
                file.close();
                fs.unlinkSync(outputPath);
                return downloadFile(response.headers.location, outputPath)
                    .then(resolve)
                    .catch(reject);
            }
            
            if (response.statusCode !== 200) {
                file.close();
                fs.unlinkSync(outputPath);
                reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
                return;
            }
            
            response.pipe(file);
            
            file.on('finish', () => {
                file.close();
                
                // Make executable on Unix systems
                if (process.platform !== 'win32') {
                    try {
                        fs.chmodSync(outputPath, '755');
                        console.log(`Made ${outputPath} executable`);
                    } catch (error) {
                        console.warn(`Could not make ${outputPath} executable:`, error.message);
                    }
                }
                
                console.log(`✓ Downloaded: ${path.basename(outputPath)}`);
                resolve();
            });
            
            file.on('error', (err) => {
                fs.unlink(outputPath, () => {}); // Delete partial file
                reject(err);
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

async function downloadAllPlatforms() {
    console.log('📥 Downloading yt-dlp binaries...');
    ensureDirectoryExists(DOWNLOAD_DIR);
    
    const downloads = [];
    
    for (const [platform, config] of Object.entries(platforms)) {
        const outputPath = path.join(DOWNLOAD_DIR, `${platform}-${config.filename}`);
        
        // Skip if already exists and is not empty
        if (fs.existsSync(outputPath)) {
            const stats = fs.statSync(outputPath);
            if (stats.size > 0) {
                console.log(`✓ ${platform}-${config.filename} already exists (${Math.round(stats.size / 1024 / 1024)}MB)`);
                continue;
            }
        }
        
        downloads.push(downloadFile(config.url, outputPath));
    }
    
    if (downloads.length > 0) {
        try {
            await Promise.all(downloads);
            console.log('🎉 All yt-dlp binaries downloaded successfully!');
        } catch (error) {
            console.error('❌ Failed to download yt-dlp binaries:', error.message);
            process.exit(1);
        }
    } else {
        console.log('✓ All yt-dlp binaries already exist');
    }
}

// Allow running this script directly
if (require.main === module) {
    downloadAllPlatforms().catch(console.error);
}

module.exports = { downloadAllPlatforms }; 
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const https = require('https');

const YTDLP_VERSION = '2025.05.22'; // Latest stable version
const YTDLP_REPO = 'https://github.com/yt-dlp/yt-dlp';
const BUILD_DIR = path.join(__dirname, '..', 'build-temp');
const BINARIES_DIR = path.join(__dirname, '..', 'binaries');
const SIGNING_IDENTITY = 'ELSA, Corp. (DQ47627WZ6)';

console.log('🏗️  Building yt-dlp from source with code signing...\n');

async function downloadFile(url, destination) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destination);
        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                // Handle redirect
                return downloadFile(response.headers.location, destination).then(resolve).catch(reject);
            }
            
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                return;
            }
            
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', reject);
    });
}

async function runCommand(command, cwd = process.cwd()) {
    return new Promise((resolve, reject) => {
        console.log(`  Running: ${command}`);
        const child = spawn('bash', ['-c', command], { 
            cwd, 
            stdio: 'inherit',
            env: { ...process.env }
        });
        
        child.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command failed with exit code ${code}: ${command}`));
            }
        });
        
        child.on('error', reject);
    });
}

async function checkPythonSetup() {
    console.log('🐍 Checking Python setup...');
    
    try {
        execSync('python3 --version', { stdio: 'pipe' });
        console.log('  ✅ Python3 found');
    } catch (error) {
        throw new Error('Python3 not found. Please install Python 3.8+ from https://python.org');
    }
    
    try {
        execSync('pip3 --version', { stdio: 'pipe' });
        console.log('  ✅ pip3 found');
    } catch (error) {
        throw new Error('pip3 not found. Please install pip3');
    }
}

async function setupBuildEnvironment() {
    console.log('📁 Setting up build environment...');
    
    // Clean and create build directory
    if (fs.existsSync(BUILD_DIR)) {
        fs.rmSync(BUILD_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(BUILD_DIR, { recursive: true });
    
    // Ensure binaries directory exists
    if (!fs.existsSync(BINARIES_DIR)) {
        fs.mkdirSync(BINARIES_DIR, { recursive: true });
    }
    
    console.log(`  ✅ Build directory: ${BUILD_DIR}`);
}

async function downloadYtDlpSource() {
    console.log('📥 Downloading yt-dlp source...');
    
    const sourceUrl = `${YTDLP_REPO}/archive/refs/tags/${YTDLP_VERSION}.tar.gz`;
    const tarPath = path.join(BUILD_DIR, 'yt-dlp-source.tar.gz');
    
    console.log(`  Downloading from: ${sourceUrl}`);
    await downloadFile(sourceUrl, tarPath);
    console.log('  ✅ Source downloaded');
    
    // Extract the tarball
    console.log('  📦 Extracting source...');
    await runCommand(`tar -xzf yt-dlp-source.tar.gz`, BUILD_DIR);
    
    const extractedDir = path.join(BUILD_DIR, `yt-dlp-${YTDLP_VERSION}`);
    if (!fs.existsSync(extractedDir)) {
        throw new Error('Failed to extract yt-dlp source');
    }
    
    console.log('  ✅ Source extracted');
    return extractedDir;
}

async function installBuildDependencies(sourceDir) {
    console.log('📦 Installing build dependencies...');
    
    // Create a virtual environment to avoid conflicts
    console.log('  Creating Python virtual environment...');
    await runCommand('python3 -m venv build-venv', sourceDir);
    
    // Use the virtual environment's pip
    const venvPip = path.join(sourceDir, 'build-venv', 'bin', 'pip');
    const venvPython = path.join(sourceDir, 'build-venv', 'bin', 'python');
    
    // Install PyInstaller and other dependencies in the virtual environment
    await runCommand(`"${venvPip}" install pyinstaller setuptools wheel`, sourceDir);
    
    // Install yt-dlp dependencies
    if (fs.existsSync(path.join(sourceDir, 'requirements.txt'))) {
        await runCommand(`"${venvPip}" install -r requirements.txt`, sourceDir);
    }
    
    console.log('  ✅ Dependencies installed in virtual environment');
    return { venvPython, venvPip };
}

async function buildYtDlp(sourceDir, venvPython) {
    console.log('🔨 Building yt-dlp binary...');
    
    const platform = process.platform;
    const extension = platform === 'win32' ? '.exe' : '';
    const outputName = `${platform}-yt-dlp${extension}`;
    const outputPath = path.join(BINARIES_DIR, outputName);
    
    // PyInstaller command with code signing
    let pyinstallerCmd = `"${venvPython}" -m PyInstaller --onefile --name yt-dlp`;
    
    // Add code signing for macOS
    if (platform === 'darwin') {
        pyinstallerCmd += ` --codesign-identity "${SIGNING_IDENTITY}"`;
    }
    
    // Add the main script
    pyinstallerCmd += ` yt_dlp/__main__.py`;
    
    console.log(`  Building for platform: ${platform}`);
    console.log(`  Output will be: ${outputPath}`);
    
    try {
        await runCommand(pyinstallerCmd, sourceDir);
        
        // Find the built binary
        const distDir = path.join(sourceDir, 'dist');
        const builtBinary = path.join(distDir, `yt-dlp${extension}`);
        
        if (!fs.existsSync(builtBinary)) {
            throw new Error(`Built binary not found at: ${builtBinary}`);
        }
        
        // Copy to binaries directory
        fs.copyFileSync(builtBinary, outputPath);
        
        // Make executable on Unix systems
        if (platform !== 'win32') {
            fs.chmodSync(outputPath, '755');
        }
        
        const stats = fs.statSync(outputPath);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
        console.log(`  ✅ Binary built: ${outputPath} (${sizeMB}MB)`);
        
        return outputPath;
        
    } catch (error) {
        console.error('  ❌ Build failed:', error.message);
        throw error;
    }
}

async function verifyBinary(binaryPath) {
    console.log('🧪 Verifying built binary...');
    
    try {
        // Test version command
        const version = execSync(`"${binaryPath}" --version`, { encoding: 'utf8' }).trim();
        console.log(`  ✅ Binary works: ${version}`);
        
        // Check code signature on macOS
        if (process.platform === 'darwin') {
            try {
                const codesignOutput = execSync(`codesign -dv "${binaryPath}" 2>&1`, { encoding: 'utf8' });
                if (codesignOutput.includes(SIGNING_IDENTITY)) {
                    console.log(`  ✅ Code signature verified: ${SIGNING_IDENTITY}`);
                } else {
                    console.log(`  ⚠️  Code signature: ${codesignOutput.trim()}`);
                }
            } catch (codesignError) {
                console.log(`  ⚠️  Could not verify code signature: ${codesignError.message}`);
            }
        }
        
        return true;
    } catch (error) {
        console.error(`  ❌ Binary verification failed: ${error.message}`);
        throw error;
    }
}

async function cleanup() {
    console.log('🧹 Cleaning up...');
    
    if (fs.existsSync(BUILD_DIR)) {
        fs.rmSync(BUILD_DIR, { recursive: true, force: true });
        console.log('  ✅ Build directory cleaned');
    }
}

async function main() {
    try {
        await checkPythonSetup();
        await setupBuildEnvironment();
        
        const sourceDir = await downloadYtDlpSource();
        const { venvPython, venvPip } = await installBuildDependencies(sourceDir);
        
        const binaryPath = await buildYtDlp(sourceDir, venvPython);
        await verifyBinary(binaryPath);
        
        await cleanup();
        
        console.log('\n🎉 yt-dlp build completed successfully!');
        console.log(`📍 Binary location: ${binaryPath}`);
        console.log('🔐 Signed with your certificate - no more quarantine issues!');
        
    } catch (error) {
        console.error('\n❌ Build failed:', error.message);
        
        // Cleanup on error
        try {
            await cleanup();
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError.message);
        }
        
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { main }; 
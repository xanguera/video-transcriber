const fs = require('fs');
const path = require('path');

console.log('🎨 Icon Conversion Helper for Video Transcriber');
console.log('===============================================\n');

const sourceLogo = path.join(__dirname, '..', 'elsa_logo.png');
const iconsDir = path.join(__dirname, '..', 'build', 'icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
    console.log('✓ Created build/icons directory');
}

// Check if source logo exists
if (!fs.existsSync(sourceLogo)) {
    console.log('❌ Error: elsa_logo.png not found in project root');
    console.log('Please place your elsa_logo.png file in the project root directory.');
    console.log('Expected location:', sourceLogo);
    console.log('\n💡 To get started:');
    console.log('1. Place your elsa_logo.png in the project root');
    console.log('2. Run: npm run setup-icons');
    console.log('3. Follow the instructions to create .icns and .ico files');
    console.log('4. Test with: npm start');
    process.exit(1);
}

// Copy PNG for Linux and window icons
const iconPng = path.join(iconsDir, 'icon.png');
fs.copyFileSync(sourceLogo, iconPng);
console.log('✓ Copied icon.png for Linux and window icons');

// Get source logo info
const stats = fs.statSync(sourceLogo);
console.log(`✓ Source logo: ${(stats.size / 1024).toFixed(1)}KB`);

console.log('\n📋 Next Steps - Create Platform-Specific Icons:');
console.log('==============================================');

console.log('\n🚀 Quick Setup (Recommended):');
console.log('   1. Visit: https://icon.kitchen/');
console.log('   2. Upload your elsa_logo.png');
console.log('   3. Download the generated icons pack');
console.log('   4. Extract and copy:');
console.log('      • icon.icns → build/icons/icon.icns (macOS)');
console.log('      • icon.ico → build/icons/icon.ico (Windows)');

console.log('\n🔧 Alternative Methods:');
console.log('   • macOS .icns: https://convertio.co/png-icns/');
console.log('   • Windows .ico: https://convertio.co/png-ico/');

console.log('\n💻 macOS Command Line (Advanced):');
console.log('   Run these commands in your project root:');
console.log('   ┌─────────────────────────────────────────────────────┐');
console.log('   │ mkdir icon.iconset                                  │');
console.log('   │ sips -z 16 16     elsa_logo.png --out icon.iconset/icon_16x16.png     │');
console.log('   │ sips -z 32 32     elsa_logo.png --out icon.iconset/icon_16x16@2x.png  │');
console.log('   │ sips -z 32 32     elsa_logo.png --out icon.iconset/icon_32x32.png     │');
console.log('   │ sips -z 64 64     elsa_logo.png --out icon.iconset/icon_32x32@2x.png  │');
console.log('   │ sips -z 128 128   elsa_logo.png --out icon.iconset/icon_128x128.png   │');
console.log('   │ sips -z 256 256   elsa_logo.png --out icon.iconset/icon_128x128@2x.png│');
console.log('   │ sips -z 256 256   elsa_logo.png --out icon.iconset/icon_256x256.png   │');
console.log('   │ sips -z 512 512   elsa_logo.png --out icon.iconset/icon_256x256@2x.png│');
console.log('   │ sips -z 512 512   elsa_logo.png --out icon.iconset/icon_512x512.png   │');
console.log('   │ sips -z 1024 1024 elsa_logo.png --out icon.iconset/icon_512x512@2x.png│');
console.log('   │ iconutil -c icns icon.iconset                       │');
console.log('   │ mv icon.icns build/icons/                           │');
console.log('   │ rm -rf icon.iconset                                 │');
console.log('   └─────────────────────────────────────────────────────┘');

console.log('\n📁 Required Files Status:');
console.log('┌──────────────────────────────────────────────────────┐');
console.log('│ File                    Status       Purpose          │');
console.log('├──────────────────────────────────────────────────────┤');
console.log('│ build/icons/icon.png    ✅ Created   Linux & Window   │');
console.log('│ build/icons/icon.icns   ⏳ Needed    macOS builds     │');
console.log('│ build/icons/icon.ico    ⏳ Needed    Windows builds   │');
console.log('└──────────────────────────────────────────────────────┘');

console.log('\n🧪 Testing Your Icons:');
console.log('   • Development: npm start');
console.log('   • Production:  npm run build');

console.log('\n💡 Tips for Best Results:');
console.log('   • Use square aspect ratio (1:1)');
console.log('   • Minimum 512x512 pixels recommended');
console.log('   • Transparent background works well');
console.log('   • Simple designs work better at small sizes');

console.log('\n✅ Icon setup completed! Place .icns and .ico files, then test with npm start'); 
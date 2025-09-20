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
    console.log('Skipping notarization: APPLE_ID and/or APPLE_ID_PASSWORD environment variables not set');
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
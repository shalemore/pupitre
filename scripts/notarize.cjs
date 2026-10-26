/**
 * electron-builder's afterSign hook: hands the signed macOS app to Apple's notary service, which
 * Gatekeeper asks before it opens a download from the internet. It returns at once without the
 * three credentials, so a build from a laptop stays an unsigned, unnotarized build that still runs;
 * docs/signing.md lists what a release sets.
 */

const { join } = require("node:path");

const APPLE_CREDENTIALS = ["APPLE_ID", "APPLE_APP_SPECIFIC_PASSWORD", "APPLE_TEAM_ID"];

async function afterSign(context) {
  if (process.platform !== "darwin") return;

  const missing = APPLE_CREDENTIALS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.log(`Notarization skipped, ${missing.join(", ")} not set`);
    return;
  }

  // @electron/notarize is ESM only, so it is imported rather than required from this hook
  const { notarize } = await import("@electron/notarize");
  const appPath = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  console.log(`Notarizing ${appPath}`);
  await notarize({
    appPath,
    appleId: process.env["APPLE_ID"],
    appleIdPassword: process.env["APPLE_APP_SPECIFIC_PASSWORD"],
    teamId: process.env["APPLE_TEAM_ID"],
  });
}

module.exports = { afterSign };

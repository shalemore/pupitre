// Prints the installers a build left in release/, one per line, for the release workflow to sign
// an attestation for.
// Usage: node scripts/release-artifacts.ts
// release/ also holds the unpacked app folders and the update metadata, so the files are picked by
// the extensions electron-builder names its targets with rather than the folder being handed over.
// The paths are written with forward slashes on every platform, which is the form the glob of the
// attestation actions reads.
import { existsSync, readdirSync } from "node:fs";

const RELEASE_DIR = "release";

/** The targets in electron-builder.yml: nsis, dmg, zip, AppImage and deb. */
const INSTALLER_EXTENSIONS = [".exe", ".dmg", ".zip", ".AppImage", ".deb"];

if (!existsSync(RELEASE_DIR)) {
  console.error(`${RELEASE_DIR} is missing: run electron-builder before this script.`);
  process.exit(1);
}

const installers = readdirSync(RELEASE_DIR)
  .filter((name) => INSTALLER_EXTENSIONS.some((extension) => name.endsWith(extension)))
  .toSorted()
  .map((name) => `${RELEASE_DIR}/${name}`);

if (installers.length === 0) {
  console.error(`No installer in ${RELEASE_DIR}: the build did not leave an artifact to attest.`);
  process.exit(1);
}

console.log(installers.join("\n"));

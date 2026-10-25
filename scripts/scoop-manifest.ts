// Writes the Scoop manifest and the sha256 file of a released Windows installer.
// Usage: node scripts/scoop-manifest.ts <installer> <out-dir>
// Scoop does not run the NSIS installer: the "#/dl.7z" fragment makes it unpack the installer, which
// holds the app as app-64.7z, and pre_install unpacks that into the app folder. The manifest is
// built from package.json and the installer itself, so nothing is written down twice.
import { hash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { z } from "zod";

const packageSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string(),
  homepage: z.string(),
  license: z.string(),
  productName: z.string(),
  repository: z.object({ url: z.string() }),
});

const [installerPath, outDir] = process.argv.slice(2);
if (installerPath === undefined || outDir === undefined) {
  console.error("usage: scoop-manifest.ts <installer> <out-dir>");
  process.exit(1);
}

const packageFile: unknown = JSON.parse(await readFile("package.json", "utf8"));
const pkg = packageSchema.parse(packageFile);
const { name, version, description, homepage, license } = pkg;
const repo = pkg.repository.url.replace(/^git\+/, "").replace(/\.git$/, "");

const asset = basename(installerPath);
const sha256 = hash("sha256", await readFile(installerPath));

const url = (v: string) => `${repo}/releases/download/v${v}/${asset.replaceAll(version, v)}#/dl.7z`;
const executable = `${pkg.productName}.exe`;
const unpackApp = 'Expand-7zipArchive "$dir\\`$PLUGINSDIR\\app-64.7z" "$dir"';

const manifest = {
  version,
  description,
  homepage,
  license,
  architecture: { "64bit": { url: url(version), hash: sha256, pre_install: unpackApp } },
  // What the installer unpacks besides the app: its own files and the uninstaller
  post_install: 'Remove-Item "$dir\\`$PLUGINSDIR", "$dir\\`$R0" -Force -Recurse',
  bin: executable,
  shortcuts: [[executable, pkg.productName]],
  checkver: "github",
  autoupdate: {
    architecture: { "64bit": { url: url("$version"), hash: { url: "$baseurl.sha256" } } },
  },
};

await writeFile(join(outDir, `${asset}.sha256`), `${sha256}  ${asset}\n`);
await writeFile(join(outDir, `${name}.scoop.json`), `${JSON.stringify(manifest, null, 4)}\n`);
console.log(`Wrote the Scoop manifest of ${name} ${version} to ${outDir}`);

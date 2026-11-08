// Writes the Scoop manifest and the sha256 file of a released Windows installer.
// Usage: node scripts/scoop-manifest.ts <installer> <out-dir>
// Scoop does not run the NSIS installer: the "#/dl.7z" fragment makes it unpack the installer, which
// holds the app as app-64.7z, and pre_install unpacks that into the app folder. The manifest is
// built from package.json and the installer itself, so nothing is written down twice.
// It reads package.json without the app's dependencies, so a release can run it with plain Node.
import { hash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

/** The fields of package.json the manifest is built from. */
interface PackageInfo {
  name: string;
  version: string;
  description: string;
  homepage: string;
  license: string;
  productName: string;
  repositoryUrl: string;
}

/** The members of a JSON object, or a failure naming what was expected there. */
function members(value: unknown, where: string): Map<string, unknown> {
  if (typeof value !== "object" || value === null) throw new Error(`${where} is not an object`);
  const map = new Map<string, unknown>();
  for (const [key, member] of Object.entries(value)) map.set(key, member);
  return map;
}

function stringOf(map: Map<string, unknown>, key: string, where: string): string {
  const value = map.get(key);
  if (typeof value !== "string" || value === "") {
    throw new Error(`${where}: ${key} must be a non-empty string`);
  }
  return value;
}

function readPackage(source: string): PackageInfo {
  const pkg = members(JSON.parse(source), "package.json");
  const repository = members(pkg.get("repository"), "package.json: repository");
  return {
    name: stringOf(pkg, "name", "package.json"),
    version: stringOf(pkg, "version", "package.json"),
    description: stringOf(pkg, "description", "package.json"),
    homepage: stringOf(pkg, "homepage", "package.json"),
    license: stringOf(pkg, "license", "package.json"),
    productName: stringOf(pkg, "productName", "package.json"),
    repositoryUrl: stringOf(repository, "url", "package.json: repository"),
  };
}

const [installerPath, outDir] = process.argv.slice(2);
if (installerPath === undefined || outDir === undefined) {
  console.error("usage: scoop-manifest.ts <installer> <out-dir>");
  process.exit(1);
}

const pkg = readPackage(await readFile("package.json", "utf8"));
const { name, version, description, homepage, license } = pkg;
const repo = pkg.repositoryUrl.replace(/^git\+/, "").replace(/\.git$/, "");

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

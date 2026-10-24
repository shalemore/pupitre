import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
import { z } from "zod";

/**
 * Writes THIRD-PARTY-NOTICES.txt next to the bundle: the license text of every npm package that
 * ended up in it. MIT, BSD, ISC and Apache all ask for their notice to travel with the code, and
 * minifying drops the comments that carried it.
 */

const packageSchema = z.object({
  name: z.string(),
  version: z.string(),
  license: z.union([z.string(), z.object({ type: z.string() })]).optional(),
  homepage: z.string().optional(),
});

/** Said under the package, for the licenses that ask for more than their text. */
const NOTES: Record<string, string> = {
  elkjs:
    "Mermaid lays its diagrams out with elkjs, which is distributed under the Eclipse Public License 2.0 (EPL-2.0). Pupitre includes it unmodified. Its source code is at https://github.com/kieler/elkjs and in the elkjs package on npm.",
  dompurify:
    "DOMPurify is available under the Mozilla Public License 2.0 or the Apache License 2.0. Pupitre uses it under the Apache License 2.0.",
};

/** The folder of the package a bundled module belongs to, such as node_modules/@scope/name. */
function packageRoot(moduleId: string): string | undefined {
  const path = moduleId.replace(/\?.*$/, "").replaceAll("\\", "/");
  const marker = "/node_modules/";
  const at = path.lastIndexOf(marker);
  if (at === -1) return undefined;
  const [first, second] = path.slice(at + marker.length).split("/");
  if (first === undefined) return undefined;
  const name = first.startsWith("@") ? `${first}/${second}` : first;
  return path.slice(0, at + marker.length + name.length);
}

function licenseText(folder: string): string {
  const file = readdirSync(folder).find((entry) => /^(licen[cs]e|copying)(\..+)?$/i.test(entry));
  return file === undefined
    ? "(The package has no license file.)"
    : readFileSync(join(folder, file), "utf8").trim();
}

function describe(folder: string): string {
  const info = packageSchema.parse(JSON.parse(readFileSync(join(folder, "package.json"), "utf8")));
  const license =
    typeof info.license === "object" ? info.license.type : (info.license ?? "unknown license");
  const label = license.startsWith("(") ? license : `(${license})`;
  const lines = [`${info.name} ${info.version} ${label}`];
  if (info.homepage) lines.push(info.homepage);
  const note = NOTES[info.name];
  if (note) lines.push("", note);
  return [...lines, "", licenseText(folder)].join("\n");
}

export function thirdPartyNotices(): Plugin {
  return {
    name: "third-party-notices",
    generateBundle(_options, bundle) {
      const folders = new Set<string>();
      for (const output of Object.values(bundle)) {
        if (output.type !== "chunk") continue;
        for (const id of output.moduleIds) {
          const folder = packageRoot(id);
          if (folder !== undefined) folders.add(folder);
        }
      }
      const rule = "-".repeat(80);
      const text = [
        "Pupitre includes the open-source packages below. Their licenses follow.",
        ...[...folders].toSorted().map(describe),
      ].join(`\n\n${rule}\n\n`);
      this.emitFile({ type: "asset", fileName: "THIRD-PARTY-NOTICES.txt", source: `${text}\n` });
    },
  };
}

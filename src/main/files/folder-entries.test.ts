import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readFolder, markHidden } from "./folder-entries";

const folders: string[] = [];

async function folder(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "pupitre-folder-"));
  folders.push(path);
  return path;
}

afterEach(async () => {
  await Promise.all(folders.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("markHidden", () => {
  it("marks junk and dot entries", async () => {
    const path = await folder();
    await writeFile(join(path, "note.md"), "");
    await writeFile(join(path, ".secret.md"), "");
    await writeFile(join(path, "Thumbs.db"), "");

    const entries = await markHidden(await readFolder(path));
    const byName = new Map(entries.map((entry) => [entry.name, entry]));

    expect(byName.get("note.md")?.hidden).toBeUndefined();
    expect(byName.get(".secret.md")?.hidden).toBe(true);
    expect(byName.get("Thumbs.db")?.hidden).toBe(true);
  });

  it("marks an entry Windows keeps hidden", async () => {
    if (process.platform !== "win32") return;
    const path = await folder();
    const hidden = join(path, "hidden");
    await mkdir(hidden);
    const { setAttributes } = await import("winattr");
    await setAttributes(hidden, { hidden: true });

    const entries = await markHidden(await readFolder(path));
    expect(entries.find((entry) => entry.name === "hidden")?.hidden).toBe(true);
  });
});

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PINS_FILE, readPins, writePins } from "./pins";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "pupitre-pins-"));
  await writeFile(join(root, "README.md"), "# Read me");
  await mkdir(join(root, "docs"));
  await writeFile(join(root, "docs", "guide.md"), "# Guide");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("pins", () => {
  it("writes the relative paths and reads them back in order", async () => {
    writePins(root, ["README.md", "docs", "README.md"]);

    expect(JSON.parse(await readFile(join(root, PINS_FILE), "utf8"))).toEqual({
      version: 1,
      paths: ["README.md", "docs"],
    });
    expect((await readPins(root)).map((entry) => [entry.relative, entry.kind])).toEqual([
      ["README.md", "file"],
      ["docs", "directory"],
    ]);
  });

  it("leaves out paths outside the folder and paths that do not exist", async () => {
    writePins(root, ["../outside.md", "/etc/passwd", "missing.md", "docs"]);

    expect((await readPins(root)).map((entry) => entry.relative)).toEqual(["docs"]);
  });

  it("reads a missing or invalid file as no pins", async () => {
    expect(await readPins(root)).toEqual([]);
    await mkdir(join(root, ".pupitre"), { recursive: true });
    await writeFile(join(root, PINS_FILE), "{ not json");
    expect(await readPins(root)).toEqual([]);
  });
});

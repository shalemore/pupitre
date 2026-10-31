import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readThemesFromRoot } from "./theme-folders";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "pupitre-theme-folders-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("readThemesFromRoot", () => {
  it("reads a theme folder with its metadata", async () => {
    await mkdir(join(root, "custom"), { recursive: true });
    await writeFile(join(root, "custom/index.css"), ":root { color-scheme: dark; }");
    await writeFile(
      join(root, "custom/theme.json"),
      JSON.stringify({ name: { "en-US": "Custom" } }),
    );

    const themes = readThemesFromRoot(root, "global");

    expect(themes).toHaveLength(1);
    expect(themes[0]?.source).toBe("global");
    expect(themes[0]?.folder).toBe("custom");
    expect(themes[0]?.css).toContain("color-scheme: dark");
    expect(themes[0]?.meta).toEqual({ name: { "en-US": "Custom" } });
  });

  it("leaves a folder without a stylesheet out", async () => {
    await mkdir(join(root, "empty"), { recursive: true });
    expect(readThemesFromRoot(root, "project")).toEqual([]);
  });

  it("returns nothing for a folder that does not exist yet", () => {
    expect(readThemesFromRoot(join(root, "missing"), "global")).toEqual([]);
  });

  it("inlines a relative asset and leaves remote and data URLs alone", async () => {
    await mkdir(join(root, "custom"), { recursive: true });
    await writeFile(join(root, "custom/icon.png"), "png");
    await writeFile(
      join(root, "custom/index.css"),
      [
        'a { background: url("./icon.png"); }',
        'b { background: url("https://example.com/a.png"); }',
        'c { background: url("data:image/png;base64,abc"); }',
      ].join("\n"),
    );

    const [theme] = readThemesFromRoot(root, "global");

    expect(theme?.css).toContain('url("data:image/png;base64,cG5n")');
    expect(theme?.css).toContain("https://example.com/a.png");
    expect(theme?.css).toContain("data:image/png;base64,abc");
  });

  it("does not read an asset outside the theme folder", async () => {
    await mkdir(join(root, "custom"), { recursive: true });
    await writeFile(join(root, "secret.txt"), "secret");
    await writeFile(join(root, "custom/index.css"), 'a { background: url("../secret.txt"); }');

    const [theme] = readThemesFromRoot(root, "global");

    expect(theme?.css).toContain('url("../secret.txt")');
  });

  it("keeps a stylesheet whose theme.json cannot be parsed", async () => {
    await mkdir(join(root, "custom"), { recursive: true });
    await writeFile(join(root, "custom/index.css"), ":root {}");
    await writeFile(join(root, "custom/theme.json"), "{nope");

    const [theme] = readThemesFromRoot(root, "global");

    expect(theme?.meta).toBeUndefined();
  });
});

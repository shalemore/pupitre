import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readPluginStyle } from "./styles";

const folders: string[] = [];

async function pluginFolder(css: string, asset = true): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "pupitre-style-"));
  folders.push(path);
  await writeFile(join(path, "plugin.css"), css);
  if (asset) await writeFile(join(path, "dot.png"), "png");
  return path;
}

afterEach(async () => {
  await Promise.all(folders.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("readPluginStyle", () => {
  it("reads the stylesheet and inlines the files beside it", async () => {
    const folder = await pluginFolder(".md-heading { background-image: url('dot.png') }");
    const css = readPluginStyle(folder, "plugin.css");
    expect(css).toContain('url("data:image/png;base64,');
    expect(css).not.toContain("dot.png");
  });

  it("refuses a stylesheet that leaves the plugin folder", async () => {
    const folder = await pluginFolder("");
    await expect(
      Promise.resolve(readPluginStyle(folder, "../outside.css")),
    ).resolves.toBeUndefined();
  });

  it.each([
    ["@import", '@import "other.css";'],
    ["!important", ".md-heading { color: red !important }"],
    ["@property", "@property --x { syntax: '<color>' }"],
    ["expression()", ".md-heading { width: expression(1) }"],
    ["url()", ".md-heading { background: url(https://example.com/a.png) }"],
  ])("refuses %s", async (_name, css) => {
    const folder = await pluginFolder(css);
    expect(readPluginStyle(folder, "plugin.css")).toBeUndefined();
  });

  it("keeps data URLs, fragments and custom properties", async () => {
    const folder = await pluginFolder(
      ".md-heading { background: url(#grain); mask: url(var(--mask)); border-image: url(data:image/png;base64,cG5n) }",
    );
    expect(readPluginStyle(folder, "plugin.css")).toContain("url(#grain)");
  });

  it("does not read a folder that is not there", async () => {
    const folder = join(tmpdir(), "pupitre-style-missing");
    await mkdir(folder, { recursive: true });
    folders.push(folder);
    expect(readPluginStyle(folder, "plugin.css")).toBeUndefined();
  });
});

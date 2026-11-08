import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { installCopy, readPlugin, readState, writeState } from "./plugin-files";

const folders: string[] = [];

async function folder(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "pupitre-plugin-"));
  folders.push(path);
  return path;
}

/** A plugin folder with a manifest and the module it names. */
async function pluginFolder(manifest: Record<string, unknown> = {}): Promise<string> {
  const path = await folder();
  await writeFile(join(path, "main.js"), "console.log('hello');");
  await writeFile(
    join(path, "manifest.json"),
    JSON.stringify({ id: "hello", name: "Hello", version: "1.0.0", main: "main.js", ...manifest }),
  );
  return path;
}

afterEach(async () => {
  await Promise.all(folders.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("readPlugin", () => {
  it("reads the manifest and the state of a folder named after the id", async () => {
    const root = await folder();
    const plugin = join(root, "hello");
    await mkdir(plugin);
    await writeFile(join(plugin, "main.js"), "");
    await writeFile(
      join(plugin, "manifest.json"),
      JSON.stringify({ id: "hello", name: "Hello", version: "1.0.0", main: "main.js" }),
    );
    await writeFile(
      join(plugin, "state.json"),
      JSON.stringify({ enabled: true, version: "1.0.0", granted: [] }),
    );

    expect(readPlugin(plugin)).toMatchObject({
      id: "hello",
      enabled: true,
      granted: [],
      manifest: { name: "Hello" },
    });
  });

  it("does not read a folder whose manifest names another id", async () => {
    const root = await folder();
    const plugin = join(root, "hello");
    await mkdir(plugin);
    await writeFile(
      join(plugin, "manifest.json"),
      JSON.stringify({ id: "goodbye", name: "Bye", version: "1.0.0" }),
    );

    expect(readPlugin(plugin)).toBeUndefined();
  });

  it("does not read a manifest whose module leaves the plugin folder", async () => {
    const root = await folder();
    const plugin = join(root, "hello");
    await mkdir(plugin);
    await writeFile(
      join(plugin, "manifest.json"),
      JSON.stringify({ id: "hello", name: "Hello", version: "1.0.0", main: "../main.js" }),
    );
    await writeFile(join(root, "main.js"), "");

    expect(readPlugin(plugin)).toBeUndefined();
  });
});

describe("readState", () => {
  it("asks for permissions again when the plugin's version changed", async () => {
    const plugin = await pluginFolder();
    const manifest = { id: "hello", name: "Hello", version: "1.0.0", permissions: [] };
    writeState(plugin, { enabled: true, version: "0.9.0", granted: [] });

    expect(readState(plugin, manifest)).toEqual({
      enabled: false,
      version: "1.0.0",
      granted: [],
    });
  });
});

describe("installCopy", () => {
  it("copies the plugin and starts it disabled", async () => {
    const source = await pluginFolder();
    const root = await folder();

    const plugin = installCopy(source, root);

    expect(plugin).toEqual({
      id: "hello",
      manifest: { id: "hello", name: "Hello", version: "1.0.0", main: "main.js", permissions: [] },
      enabled: false,
      granted: [],
    });
    expect(await readFile(join(root, "hello", "main.js"), "utf8")).toBe("console.log('hello');");
    expect(JSON.parse(await readFile(join(root, "hello", "state.json"), "utf8"))).toMatchObject({
      enabled: false,
    });
  });

  it("refuses a plugin that is already installed", async () => {
    const source = await pluginFolder();
    const root = await folder();
    installCopy(source, root);

    expect(() => installCopy(source, root)).toThrow("already installed");
  });

  it("refuses a module outside the plugin folder", async () => {
    const source = await pluginFolder({ main: "../main.js" });
    const root = await folder();

    expect(() => installCopy(source, root)).toThrow("must stay inside");
  });
});

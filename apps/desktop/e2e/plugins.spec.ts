import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { close, editorText, launch, run } from "./app";

const FIXTURE = join(process.cwd(), "e2e/fixtures/plugins/hello");

async function headingColor(page: Page): Promise<string> {
  return page.evaluate(() => {
    const heading = document.querySelector(".md-heading");
    return heading === null ? "" : getComputedStyle(heading).color;
  });
}

test("installs a plugin whose styles, canvas and command all reach the app", async () => {
  const notes = await mkdtemp(join(tmpdir(), "pupitre-plugin-note-"));
  const note = join(notes, "note.md");
  await writeFile(note, "# A note\n\nSome text.\n");
  const app = await launch({ files: [note], settings: { locale: "en-US" } });
  try {
    const { page } = app;
    await page.locator(".cm-content").waitFor();
    await app.app.evaluate(({ dialog }, folder) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] });
    }, FIXTURE);

    const installed = await page.evaluate(() => window.desktop.invoke("plugins:install"));
    if (installed === null) throw new Error("The plugin was not installed");
    expect(installed.id).toBe("hello");

    await page.evaluate(
      (permissions) => window.desktop.invoke("plugins:grant", "hello", permissions),
      installed.manifest.permissions,
    );
    await page.evaluate(() => window.desktop.invoke("plugins:set-enabled", "hello", true));

    // The stylesheet is injected into its layer, scoped to the document
    await expect.poll(() => headingColor(page), { timeout: 15_000 }).toBe("rgb(255, 0, 255)");

    // The background canvas runs in a frame of its own and draws
    await expect
      .poll(() => page.frames().some((frame) => frame.url().includes("kind=background")), {
        timeout: 15_000,
      })
      .toBe(true);
    const background = page.frames().find((frame) => frame.url().includes("kind=background"));
    if (background === undefined) throw new Error("No background frame");
    await expect
      .poll(() =>
        background.evaluate(() => {
          const canvas = document.querySelector("canvas");
          const context = canvas instanceof HTMLCanvasElement ? canvas.getContext("2d") : null;
          return context === null ? [] : [...context.getImageData(10, 10, 1, 1).data];
        }),
      )
      .toEqual([255, 204, 0, 255]);
    // A surface is an opaque origin: neither the app's bridge nor Node reaches it
    expect(
      await background.evaluate(() => ({
        desktop: Reflect.has(window, "desktop"),
        require: Reflect.has(window, "require"),
      })),
    ).toEqual({ desktop: false, require: false });

    // The command reaches the palette and edits the open document
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const plugins = await window.desktop.invoke("plugins:list");
          return plugins[0]?.commands?.length ?? 0;
        }),
      )
      .toBe(1);
    await run(page, { id: "view.command-palette" });
    await page.getByText("Insert Greeting", { exact: true }).click();
    await expect.poll(() => editorText(page)).toContain("Hello from the plugin");

    // The effects switch removes the styles and the canvas, and leaves the plugin running
    await page.evaluate(() => window.desktop.invoke("settings:update", { pluginEffects: false }));
    await expect
      .poll(() =>
        page.evaluate(() => document.querySelector("style[data-plugin-style]")?.textContent ?? ""),
      )
      .toBe("");
    await expect
      .poll(() => page.frames().some((frame) => frame.url().includes("kind=background")))
      .toBe(false);

    const plugins = await page.evaluate(() => window.desktop.invoke("plugins:list"));
    expect(plugins[0]?.enabled).toBe(true);
  } finally {
    await close(app);
    await rm(notes, { recursive: true, force: true });
  }
});

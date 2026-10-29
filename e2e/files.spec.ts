import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { close, launch, run } from "./app";

/** A folder for the files of one test, kept out of the profile so a relaunch still finds them. */
async function workspace(): Promise<string> {
  return mkdtemp(join(tmpdir(), "pupitre-files-"));
}

/** A 1 × 1 red PNG: enough for the viewer to load, small enough to keep in the test. */
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("renders the indentation of an HTML block as HTML", async () => {
  const folder = await workspace();
  const picture = join(folder, "picture.png");
  const file = join(folder, "block.md");
  await writeFile(picture, PIXEL);
  await writeFile(
    file,
    '<p align="left">\n  <img src="picture.png" width="40" height="40" />\n</p>\n',
  );
  const app = await launch({ files: [file] });
  try {
    const image = app.page.locator(".md-html-block img");
    await expect(image).toBeVisible();
    // The whitespace before the tag collapses, so the picture starts where the block does; the
    // picture's frame settles once it has loaded
    await expect
      .poll(async () => {
        const [imageBox, blockBox] = await Promise.all([
          image.boundingBox(),
          app.page.locator(".md-html-block").boundingBox(),
        ]);
        if (imageBox === null || blockBox === null) return Number.POSITIVE_INFINITY;
        return Math.abs(imageBox.x - blockBox.x);
      })
      .toBeLessThan(1);
  } finally {
    await close(app);
    await rm(folder, { recursive: true, force: true });
  }
});

test("embeds the document's pictures in the exported HTML", async () => {
  const folder = await workspace();
  const picture = join(folder, "picture.png");
  const note = join(folder, "note.md");
  const out = join(folder, "export.html");
  await writeFile(picture, PIXEL);
  await writeFile(
    note,
    '# Note\n\n![shot](picture.png)\n\n<p align="left">\n  <img src="picture.png" width="20" height="20" />\n</p>\n',
  );
  const app = await launch({ files: [note] });
  try {
    await expect(app.page.locator(".cm-content")).toContainText("Note");
    await app.app.evaluate(({ dialog }, target) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: target });
    }, out);
    await run(app.page, { id: "file.export-html" });
    await expect
      .poll(() => readFile(out, "utf8").catch(() => ""))
      .toContain("data:image/png;base64,");
    const html = await readFile(out, "utf8");
    // Both the Markdown picture and the one in the HTML block went into the page
    expect(html).not.toContain('src="picture.png"');
    expect(html.match(/data:image\/png;base64,/g) ?? []).toHaveLength(2);
  } finally {
    await close(app);
    await rm(folder, { recursive: true, force: true });
  }
});

test("opens a picture in a preview instead of the editor", async () => {
  const folder = await workspace();
  const note = join(folder, "note.md");
  const picture = join(folder, "picture.png");
  await writeFile(note, "# Note\n");
  await writeFile(picture, PIXEL);
  const app = await launch({ files: [note] });
  try {
    await expect(app.page.locator(".cm-content")).toContainText("Note");
    await run(app.page, { id: "file.open-path", path: picture });
    const image = app.page.locator("main img");
    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute("src", /picture\.png$/);
    await expect(app.page.locator(".cm-content")).toHaveCount(0);
    // Saving works on text; a picture has nothing to write, so its bytes stay as they were
    await run(app.page, { id: "file.save" });
    await app.page.waitForTimeout(300);
    expect((await readFile(picture)).equals(PIXEL)).toBe(true);
    // Opening a text file replaces the preview, as it replaces a document with tabs off
    await run(app.page, { id: "file.open-path", path: note });
    await expect(app.page.locator(".cm-content")).toContainText("Note");
    await expect(app.page.locator("main img")).toHaveCount(0);
  } finally {
    await close(app);
    await rm(folder, { recursive: true, force: true });
  }
});

test("keeps the folder the sidebar showed across a restart", async () => {
  const folder = await workspace();
  const root = join(folder, "project");
  const nested = join(root, "src", "app", "file.md");
  await mkdir(join(root, "src", "app"), { recursive: true });
  await writeFile(join(root, "README.md"), "# Project\n");
  await writeFile(nested, "# Nested\n");
  const first = await launch({ files: [nested] });
  try {
    await expect(first.page.locator(".cm-content")).toContainText("Nested");
    await first.app.evaluate(({ dialog }, opened) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [opened] });
      dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
    }, root);
    await run(first.page, { id: "file.open-folder" });
    await expect(first.page.locator(`[data-sidebar=start] [title="project"]`)).toBeVisible();
    await first.app.close();
    await new Promise((resolve) => setTimeout(resolve, 500));

    const second = await launch({ profile: first.profile, files: [nested] });
    try {
      await expect(second.page.locator(".cm-content")).toContainText("Nested");
      // The restored document sits deep in the tree; the sidebar is still at the folder it opened
      await expect(second.page.locator(`[data-sidebar=start] [title="project"]`)).toBeVisible();
    } finally {
      await close(second);
    }
  } finally {
    await rm(first.temp, { recursive: true, force: true });
    await rm(folder, { recursive: true, force: true });
  }
});

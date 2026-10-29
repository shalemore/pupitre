import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { answerDialogs, close, editorText, kill, launch, replaceText, run } from "./app";

/** A folder for the files of one test, kept out of the profile so a relaunch still finds them. */
async function workspace(): Promise<string> {
  return mkdtemp(join(tmpdir(), "pupitre-files-"));
}

test("opens a file and writes an edit back with the file's line endings", async () => {
  const folder = await workspace();
  const file = join(folder, "notes.md");
  await writeFile(file, "# Notes\r\n\r\nFirst line\r\n");
  const app = await launch({ files: [file] });
  try {
    await expect(app.page.locator(".cm-content")).toContainText("Notes");
    await replaceText(app.page, "# Changed\n\nSecond line");
    await run(app.page, { id: "file.save" });
    // A save restores the CRLF the file was read with and ends the text with a newline
    await expect.poll(() => readFile(file, "utf8")).toBe("# Changed\r\n\r\nSecond line\r\n");
  } finally {
    await close(app);
    await rm(folder, { recursive: true, force: true });
  }
});

test("keeps a file changed elsewhere until the user chooses to overwrite it", async () => {
  const folder = await workspace();
  const file = join(folder, "shared.md");
  await writeFile(file, "first\n");
  const app = await launch({ files: [file] });
  try {
    await replaceText(app.page, "mine");
    await writeFile(file, "theirs\n");
    // Keep Editing, then Overwrite
    await answerDialogs(app.app, [2, 0]);
    await run(app.page, { id: "file.save" });
    await expect.poll(() => readFile(file, "utf8")).toBe("theirs\n");
    await expect(app.page.locator(".cm-content")).toContainText("mine");
    await run(app.page, { id: "file.save" });
    await expect.poll(() => readFile(file, "utf8")).toBe("mine\n");
  } finally {
    await close(app);
    await rm(folder, { recursive: true, force: true });
  }
});

test("opens a second file in its own tab and keeps each document apart", async () => {
  const folder = await workspace();
  const first = join(folder, "one.md");
  const second = join(folder, "two.md");
  await writeFile(first, "First\n");
  await writeFile(second, "Second\n");
  const app = await launch({ files: [first], settings: { tabs: true } });
  try {
    await run(app.page, { id: "file.open-path", path: second });
    await expect(app.page.getByRole("tab")).toHaveCount(2);
    await app.page.getByRole("tab", { name: "two.md" }).click();
    await expect(app.page.locator(".cm-content")).toContainText("Second");
    await app.page.getByRole("tab", { name: "one.md" }).click();
    await replaceText(app.page, "Changed one");
    await run(app.page, { id: "file.save" });
    await expect.poll(() => readFile(first, "utf8")).toBe("Changed one\n");
    await expect.poll(() => readFile(second, "utf8")).toBe("Second\n");
    expect(await editorText(app.page)).toContain("Changed one");
  } finally {
    await close(app);
    await rm(folder, { recursive: true, force: true });
  }
});

test("replaces the open document when tabs are off", async () => {
  const folder = await workspace();
  const first = join(folder, "one.md");
  const second = join(folder, "two.md");
  await writeFile(first, "First\n");
  await writeFile(second, "Second\n");
  const app = await launch({ files: [first] });
  try {
    await run(app.page, { id: "file.open-path", path: second });
    await expect(app.page.locator(".cm-content")).toContainText("Second");
    // The title bar names the only document; nothing is left to switch to
    await expect(app.page.getByRole("tab")).toHaveCount(0);
    await expect(app.page.locator("header")).toContainText("two.md");
  } finally {
    await close(app);
    await rm(folder, { recursive: true, force: true });
  }
});

test("turning tabs off returns to the one document on show", async () => {
  const folder = await workspace();
  const first = join(folder, "one.md");
  const second = join(folder, "two.md");
  await writeFile(first, "First\n");
  await writeFile(second, "Second\n");
  const app = await launch({ files: [first], settings: { tabs: true } });
  try {
    await run(app.page, { id: "file.open-path", path: second });
    await expect(app.page.getByRole("tab")).toHaveCount(2);
    await app.page.evaluate(() => window.desktop.invoke("settings:update", { tabs: false }));
    await expect(app.page.getByRole("tab")).toHaveCount(0);
    await expect(app.page.locator(".cm-content")).toContainText("Second");
  } finally {
    await close(app);
    await rm(folder, { recursive: true, force: true });
  }
});

test("brings back unsaved work after the app is killed", async () => {
  const first = await launch();
  const profile = first.profile;
  try {
    await run(first.page, { id: "file.new" });
    await first.page.locator(".cm-content").waitFor();
    await replaceText(first.page, "unsaved work");
    const draft = join(profile, "draft.json");
    await expect.poll(() => readFile(draft, "utf8").catch(() => "")).toContain("unsaved work");
  } finally {
    await kill(first.app);
  }
  const second = await launch({ profile });
  try {
    await expect(second.page.locator(".cm-content")).toContainText("unsaved work");
  } finally {
    await close(second);
    await rm(first.temp, { recursive: true, force: true });
  }
});

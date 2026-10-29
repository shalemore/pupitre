import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { close, launch, run } from "./app";

/** A folder for the files of one test, kept out of the profile so a relaunch still finds them. */
async function workspace(): Promise<string> {
  return mkdtemp(join(tmpdir(), "pupitre-files-"));
}

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

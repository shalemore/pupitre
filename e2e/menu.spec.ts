import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { close, launch, run } from "./app";

test("opens a title-bar menu, switches it and runs an item", async () => {
  const app = await launch();
  try {
    const bar = app.page.getByRole("menubar");
    await expect(bar).toBeVisible();
    const buttons = bar.locator("button");

    await buttons.first().click();
    const menu = app.page.getByRole("menu").first();
    await expect(menu).toBeVisible();
    await expect(menu).toHaveCSS("animation-name", "panel-enter");
    await expect(menu.getByRole("menuitem").first()).toBeVisible();

    // Pointing at the next menu switches the panel; the menu that takes its place does not replay
    // the arrival.
    await buttons.nth(1).hover();
    await expect(app.page.getByRole("menu").first()).toBeVisible();
    await expect(app.page.getByRole("menu")).toHaveCount(1);
    await expect(app.page.getByRole("menu").first()).toHaveCSS("animation-name", "none");

    await app.page.keyboard.press("Escape");
    await expect(app.page.getByRole("menu")).toHaveCount(0);

    // The first entry of the first menu is New Document, which replaces the welcome page
    await buttons.first().click();
    await app.page.getByRole("menu").first().getByRole("menuitem").first().click();
    await expect(app.page.locator(".cm-content")).toBeVisible();
  } finally {
    await close(app);
  }
});

test("closing a tab leaves the menu bar closed", async () => {
  const folder = await mkdtemp(join(tmpdir(), "pupitre-menu-"));
  const first = join(folder, "one.md");
  const second = join(folder, "two.md");
  await writeFile(first, "First\n");
  await writeFile(second, "Second\n");
  const app = await launch({ files: [first], settings: { tabs: true } });
  try {
    await run(app.page, { id: "file.open-path", path: second });
    await expect(app.page.getByRole("tab")).toHaveCount(2);
    // The last tab closed gives the bar back to the menus while the pointer still sits over it
    await app.page.locator('[role="tablist"] > div').first().locator("button").last().click();
    await expect(app.page.getByRole("tab")).toHaveCount(0);
    await expect(app.page.getByRole("menubar")).toBeVisible();
    await expect(app.page.getByRole("menu")).toHaveCount(0);
  } finally {
    await close(app);
    await rm(folder, { recursive: true, force: true });
  }
});

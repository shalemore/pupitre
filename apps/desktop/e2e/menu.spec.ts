import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
    // The panel finishes its arrival: a replaying animation would leave it faded
    await expect(menu).toHaveCSS("opacity", "1");
    await expect(menu.getByRole("menuitem").first()).toBeVisible();

    // Pointing at the next menu switches the panel, and only one panel is on screen
    await buttons.nth(1).hover();
    await expect(app.page.getByRole("menu").first()).toHaveCSS("opacity", "1");
    await expect(app.page.getByRole("menu")).toHaveCount(1);

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

test("a shortcut updates the check mark of an open menu", async () => {
  const app = await launch();
  try {
    const bar = app.page.getByRole("menubar");
    await bar.locator("button").nth(4).click();
    // View holds the three checks; source mode is the last of them
    const sourceMode = app.page.getByRole("menuitemcheckbox").last();
    await expect(sourceMode).toHaveAttribute("aria-checked", "false");
    await app.page.evaluate(() => window.desktop.invoke("settings:update", { sourceMode: true }));
    await expect(sourceMode).toHaveAttribute("aria-checked", "true");
  } finally {
    await close(app);
  }
});

test("a held theme key toggles once, while every new press toggles again", async () => {
  const app = await launch();
  try {
    const scheme = () =>
      readFile(join(app.profile, "settings.json"), "utf8").then(
        (text): unknown => {
          const settings: unknown = JSON.parse(text);
          // The file only holds values that differ from the defaults, and light is the default
          return typeof settings === "object" && settings !== null && "colorScheme" in settings
            ? settings.colorScheme
            : "light";
        },
        () => "light",
      );
    const press = (autoRepeat: boolean) =>
      app.app.evaluate(({ BrowserWindow }, repeat) => {
        const window = BrowserWindow.getAllWindows()[0];
        if (!window) throw new Error("the app has no window");
        window.webContents.focus();
        window.webContents.sendInputEvent({
          type: "keyDown",
          keyCode: "d",
          modifiers: repeat ? ["control", "shift", "isautorepeat"] : ["control", "shift"],
        });
        window.webContents.sendInputEvent({
          type: "keyUp",
          keyCode: "d",
          modifiers: ["control", "shift"],
        });
      }, autoRepeat);

    await press(false);
    await expect.poll(scheme).toBe("dark");
    // The repeats a held key sends leave the scheme where the first press put it
    await press(true);
    await press(true);
    await expect.poll(scheme).toBe("dark");
    await press(false);
    await expect.poll(scheme).toBe("light");
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

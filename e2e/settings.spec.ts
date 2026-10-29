import { expect, test } from "@playwright/test";
import { close, launch } from "./app";

test("opening a font picker leaves the settings page where it was", async () => {
  const app = await launch();
  try {
    const settingsWindow = app.app.waitForEvent("window");
    await app.page.evaluate(() => window.desktop.invoke("window:open-settings"));
    const settings = await settingsWindow;
    await settings.waitForLoadState("domcontentloaded");
    // A short window makes the list longer than the page, which is when the page used to scroll
    await app.app.evaluate(({ BrowserWindow }) => {
      for (const window of BrowserWindow.getAllWindows()) {
        if (window.webContents.getURL().includes("#settings")) window.setContentSize(760, 520);
      }
    });
    await settings.getByRole("tab").nth(1).click();
    await expect(settings.locator("[data-slot=combobox-control]").first()).toBeVisible();
    await settings.locator("[data-slot=combobox-control]").first().click();
    await expect(settings.locator("[data-slot=combobox-content]")).toBeVisible();
    // The list brings its selected option into view itself; the settings page stays put
    expect(await settings.evaluate(() => document.scrollingElement?.scrollTop ?? 0)).toBe(0);
    expect(
      await settings.evaluate(() => document.querySelector<HTMLElement>("main")?.scrollTop ?? 0),
    ).toBe(0);
  } finally {
    await close(app);
  }
});

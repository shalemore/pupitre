import { expect, test } from "@playwright/test";
import { close, launch } from "./app";

test("opens a title-bar menu, switches it and runs an item", async () => {
  const app = await launch();
  try {
    const bar = app.page.locator("nav[data-menu-bar]");
    await expect(bar).toBeVisible();
    const buttons = bar.locator("button");

    await buttons.first().click();
    const menu = app.page.getByRole("menu").first();
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem").first()).toBeVisible();

    // Pointing at the next menu switches the panel instead of leaving the bar
    await buttons.nth(1).hover();
    await expect(app.page.getByRole("menu").first()).toBeVisible();

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

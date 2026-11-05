import { expect, test } from "@playwright/test";
import { close, launch } from "./app";

test("the desktop window draws no web splash", async () => {
  const app = await launch({ files: ["README.md"] });
  try {
    // The desktop entry has no splash at all; the browser demo's is its own HTML file
    expect(await app.page.locator("#boot-splash").count()).toBe(0);
    await app.page.locator(".cm-content").waitFor();
    expect(await app.page.locator("#boot-splash").count()).toBe(0);
  } finally {
    await close(app);
  }
});

test("steps the zoom of the page with Ctrl and the plus and minus keys", async () => {
  const app = await launch({ files: ["README.md"] });
  try {
    await app.page.locator(".cm-content").waitFor();
    const width = () => app.page.evaluate(() => innerWidth);
    const press = (keyCode: string) =>
      app.app.evaluate(({ BrowserWindow }, key) => {
        const window = BrowserWindow.getAllWindows()[0];
        if (!window) throw new Error("the app has no window");
        window.webContents.focus();
        window.webContents.sendInputEvent({
          type: "keyDown",
          keyCode: key,
          modifiers: ["control"],
        });
        window.webContents.sendInputEvent({
          type: "keyUp",
          keyCode: key,
          modifiers: ["control"],
        });
      }, keyCode);
    const before = await width();
    await press("=");
    // The page itself has to shrink, not just the number the setting holds
    await expect.poll(width).toBeLessThan(before);
    await press("-");
    await expect.poll(width).toBe(before);
  } finally {
    await close(app);
  }
});

test("typing folds the immersive chrome under a pointer resting at the top", async () => {
  const app = await launch({ files: ["README.md"], settings: { windowStyle: "immersive" } });
  try {
    await app.page.locator(".cm-content").waitFor();
    const barHeight = () =>
      app.page.evaluate(
        () => document.querySelector(".app-title-bar")?.getBoundingClientRect().height ?? -1,
      );
    await app.page.mouse.move(600, 4);
    await expect.poll(barHeight).toBeGreaterThan(0);
    // The pointer stays at the top; typing alone takes the bar away
    await app.page.locator(".cm-content").focus();
    await app.page.keyboard.type("x");
    await expect.poll(barHeight).toBe(0);
    // Reaching for the edge again brings it back
    await app.page.mouse.move(600, 400);
    await app.page.mouse.move(600, 4);
    await expect.poll(barHeight).toBeGreaterThan(0);
  } finally {
    await close(app);
  }
});

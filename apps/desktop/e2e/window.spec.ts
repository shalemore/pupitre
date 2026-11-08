import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { close, launch } from "./app";

const README = join(import.meta.dirname, "../../../README.md");

test("the desktop window draws no web splash", async () => {
  const app = await launch({ files: [README] });
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
  const app = await launch({ files: [README] });
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
  const app = await launch({ files: [README], settings: { windowStyle: "immersive" } });
  try {
    await app.page.locator(".cm-content").waitFor();
    // What the reader sees and can reach: the bar's height and focusability, and the room the
    // sidebars take beside the document
    const chrome = () =>
      app.page.evaluate(() => {
        const bar = document.querySelector(".app-title-bar");
        return {
          barHeight: bar?.getBoundingClientRect().height ?? -1,
          barFocusable: bar instanceof HTMLElement && !bar.inert,
          sidebars: [...document.querySelectorAll("[data-sidebar]")].map(
            (sidebar) => sidebar.getBoundingClientRect().width,
          ),
        };
      });
    const allShown = (state: Awaited<ReturnType<typeof chrome>>) =>
      state.barHeight > 0 && state.barFocusable && state.sidebars.every((width) => width > 0);
    const allFolded = (state: Awaited<ReturnType<typeof chrome>>) =>
      state.barHeight === 0 && !state.barFocusable && state.sidebars.every((width) => width === 0);

    await app.page.mouse.move(600, 4);
    await expect.poll(async () => allShown(await chrome())).toBe(true);
    // The pointer stays at the top; typing alone takes the bar and the sidebars away
    await app.page.locator(".cm-content").focus();
    await app.page.keyboard.type("x");
    await expect.poll(async () => allFolded(await chrome())).toBe(true);

    // The top brings the bar back, while each sidebar waits for the pointer to reach its edge
    await app.page.mouse.move(600, 400);
    await app.page.mouse.move(600, 4);
    await expect.poll(async () => (await chrome()).barHeight).toBeGreaterThan(0);
    expect((await chrome()).sidebars.every((width) => width === 0)).toBe(true);
    await app.page.mouse.move(4, 400);
    await expect.poll(async () => (await chrome()).sidebars.some((width) => width > 0)).toBe(true);
  } finally {
    await close(app);
  }
});

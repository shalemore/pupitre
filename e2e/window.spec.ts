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

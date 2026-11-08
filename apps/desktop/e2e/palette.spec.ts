import { expect, test } from "@playwright/test";
import { close, launch, run } from "./app";

test("the command palette rises in place", async () => {
  const app = await launch();
  try {
    await run(app.page, { id: "view.command-palette" });
    const sheet = app.page.locator('[data-slot="sheet"]');
    await expect(sheet).toBeVisible();
    const boxes = await sheet.evaluate((element) => {
      const animation = element.getAnimations()[0];
      if (animation === undefined) return undefined;
      animation.pause();
      animation.currentTime = 0;
      const start = element.getBoundingClientRect();
      animation.currentTime = 1000;
      const end = element.getBoundingClientRect();
      return { startX: start.left, startY: start.top, endX: end.left, endY: end.top };
    });
    if (boxes === undefined) throw new Error("the palette has no entrance animation");
    // A centred sheet keeps its place from the first frame; the arrival only lifts it two pixels
    expect(boxes.startX).toBe(boxes.endX);
    expect(boxes.startY - boxes.endY).toBeCloseTo(2, 1);
  } finally {
    await close(app);
  }
});

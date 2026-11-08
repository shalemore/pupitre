import { describe, expect, it } from "vitest";
import { textOfHtml, withoutScripts } from "./html";

describe("textOfHtml", () => {
  it("drops tags and comments and reads the characters they stand for", () => {
    expect(textOfHtml("<b>Bold</b> &amp; <!-- gone -->plain")).toBe("Bold & plain");
  });
});

describe("withoutScripts", () => {
  it("leaves a page that has none as it was written", () => {
    const page = "<!doctype html><html><body><p>Text</p></body></html>";
    expect(withoutScripts(page)).toBe(page);
  });

  it("takes the script elements out of a page that has them", () => {
    const cleaned = withoutScripts(
      "<!doctype html><html><body><p>Text</p><script>alert(1)</script></body></html>",
    );
    expect(cleaned.startsWith("<!doctype html>")).toBe(true);
    expect(cleaned).not.toContain("<script");
    expect(cleaned).toContain("<p>Text</p>");
  });
});

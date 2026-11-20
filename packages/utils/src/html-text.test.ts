import { describe, expect, it } from "vitest";
import { textOfHtml } from "./html-text";

describe("textOfHtml", () => {
  it("reads the visible text of a fragment", () => {
    expect(textOfHtml("<b>Bold</b> &amp; <!-- gone -->plain")).toBe("Bold & plain");
  });
});

import { describe, expect, it } from "vitest";
import { readToken } from "./tokens";

describe("readToken", () => {
  it("reads a token as the stylesheet writes it, without the whitespace around it", () => {
    const style = {
      getPropertyValue: (name: string) => (name === "--ui-brand" ? " oklch(0.6 0.1 40) " : ""),
    };
    expect(readToken(style, "ui-brand")).toBe("oklch(0.6 0.1 40)");
    expect(readToken(style, "ui-danger")).toBe("");
  });
});

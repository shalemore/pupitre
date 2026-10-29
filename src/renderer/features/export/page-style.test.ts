import { describe, expect, it } from "vitest";
import source from "./page-style.ts?raw";

describe("page styles", () => {
  it("takes its radii from the theme instead of literal pixels", () => {
    expect(source).not.toMatch(/border-radius:\s*(?!0)\d+(?:\.\d+)?px/);
  });

  it("takes its weights from the document's tokens", () => {
    expect(source).not.toMatch(/font-weight:\s*\d{3}\b/);
  });
});

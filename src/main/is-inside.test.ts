import { describe, expect, it } from "vitest";
import { isInside } from "./is-inside";

describe("isInside", () => {
  it("accepts a path under the root", () => {
    expect(isInside("/notes", "/notes/a.md")).toBe(true);
    expect(isInside("/notes", "/notes/sub/a.md")).toBe(true);
  });

  it("refuses the root itself and a path beside it", () => {
    expect(isInside("/notes", "/notes")).toBe(false);
    expect(isInside("/notes", "/notes-old/a.md")).toBe(false);
    expect(isInside("/notes", "/etc/passwd")).toBe(false);
  });

  it("accepts a child whose name starts with two dots", () => {
    expect(isInside("/notes", "/notes/..foo/a.md")).toBe(true);
  });
});

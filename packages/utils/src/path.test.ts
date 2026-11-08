import { describe, expect, it } from "vitest";
import { pathFromFileUrl } from "./path";

describe("pathFromFileUrl", () => {
  it("reads the path a file: URL names", () => {
    expect(pathFromFileUrl(new URL("file:///home/me/notes/today.md"))).toBe(
      "/home/me/notes/today.md",
    );
    expect(pathFromFileUrl(new URL("file:///C:/notes/today%20note.md"))).toBe(
      "C:/notes/today note.md",
    );
    expect(pathFromFileUrl(new URL("file://server/share/notes/today.md"))).toBe(
      "//server/share/notes/today.md",
    );
  });
});

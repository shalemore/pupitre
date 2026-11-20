import { describe, expect, it } from "vitest";
import { isInsideFolder, relativeToFolder, toSlashes } from "./paths";

describe("path helpers", () => {
  it("writes a path with forward slashes", () => {
    expect(toSlashes("C:\\notes\\a.md")).toBe("C:/notes/a.md");
    expect(toSlashes("/notes/a.md")).toBe("/notes/a.md");
  });

  it("tells a path inside a folder from one beside it", () => {
    expect(isInsideFolder("C:\\notes", "C:\\notes\\a.md")).toBe(true);
    expect(isInsideFolder("/notes/", "/notes/sub/a.md")).toBe(true);
    expect(isInsideFolder("/notes", "/notes-old/a.md")).toBe(false);
    expect(isInsideFolder("/notes", "/notes")).toBe(false);
  });

  it("names where a path sits under a folder", () => {
    expect(relativeToFolder("/notes", "/notes/sub/a.md")).toBe("sub/a.md");
    expect(relativeToFolder("C:\\notes", "C:\\notes\\a.md")).toBe("a.md");
    expect(relativeToFolder("/notes", "/notes-old/a.md")).toBeUndefined();
    expect(relativeToFolder("/notes", "/notes")).toBeUndefined();
  });
});

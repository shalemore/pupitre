import { describe, expect, it } from "vitest";
import { fileNameOf, isInsideFolder, withoutDocumentExtension, withTrailingNewline } from "./file";

describe("file helpers", () => {
  it("reads the name of a path with either separator", () => {
    expect(fileNameOf("C:\\notes\\today.md")).toBe("today.md");
    expect(fileNameOf("/home/me/notes/today.md")).toBe("today.md");
  });

  it("drops the Markdown extension only", () => {
    expect(withoutDocumentExtension("today.md")).toBe("today");
    expect(withoutDocumentExtension("archive.tar.gz")).toBe("archive.tar.gz");
  });

  it("tells a path inside a folder from one beside it", () => {
    expect(isInsideFolder("C:\\notes", "C:\\notes\\a.md")).toBe(true);
    expect(isInsideFolder("/notes/", "/notes/sub/a.md")).toBe(true);
    expect(isInsideFolder("/notes", "/notes-old/a.md")).toBe(false);
    expect(isInsideFolder("/notes", "/notes")).toBe(false);
  });

  it("ends a file with one newline", () => {
    expect(withTrailingNewline("text")).toBe("text\n");
    expect(withTrailingNewline("text\n")).toBe("text\n");
  });
});

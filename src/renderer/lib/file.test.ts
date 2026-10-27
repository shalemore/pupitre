import { describe, expect, it } from "vitest";
import {
  fileNameOf,
  isInsideFolder,
  parentFolder,
  pathFromFileUrl,
  relativeToFolder,
  withoutDocumentExtension,
  withTrailingNewline,
} from "./file";

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

  it("names where a path sits under a folder", () => {
    expect(relativeToFolder("/notes", "/notes/sub/a.md")).toBe("sub/a.md");
    expect(relativeToFolder("C:\\notes", "C:\\notes\\a.md")).toBe("a.md");
    expect(relativeToFolder("/notes", "/notes-old/a.md")).toBeUndefined();
    expect(relativeToFolder("/notes", "/notes")).toBeUndefined();
  });

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

  it("ends a file with one newline", () => {
    expect(withTrailingNewline("text")).toBe("text\n");
    expect(withTrailingNewline("text\n")).toBe("text\n");
  });
});

describe("the folder that holds a path", () => {
  it("keeps the separators of a Windows path", () => {
    expect(parentFolder("C:\\Users\\me\\docs")).toBe("C:\\Users\\me");
    expect(parentFolder("C:\\Users")).toBe("C:\\");
    expect(parentFolder("C:/Users/me")).toBe("C:/Users");
    expect(parentFolder("C:/Users")).toBe("C:/");
  });

  it("stops at a root, a drive or a network share", () => {
    expect(parentFolder("C:\\")).toBeUndefined();
    expect(parentFolder("C:")).toBeUndefined();
    expect(parentFolder("/")).toBeUndefined();
    expect(parentFolder("\\\\server\\share")).toBeUndefined();
  });

  it("walks a Unix path up to its root", () => {
    expect(parentFolder("/home/me")).toBe("/home");
    expect(parentFolder("/home")).toBe("/");
    expect(parentFolder("/home/me/")).toBe("/home");
  });

  it("takes the folder under a network share", () => {
    expect(parentFolder("\\\\server\\share\\docs")).toBe("\\\\server\\share");
  });

  it("has nothing above a path with no separator", () => {
    expect(parentFolder("docs")).toBeUndefined();
    expect(parentFolder("")).toBeUndefined();
  });
});

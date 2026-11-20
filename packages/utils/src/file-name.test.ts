import { describe, expect, it } from "vitest";
import { fileNameOf, fileStem } from "./file-name";

describe("fileNameOf", () => {
  it("reads the name of a path with either separator", () => {
    expect(fileNameOf(String.raw`C:\notes\today.md`)).toBe("today.md");
    expect(fileNameOf("/home/me/notes/today.md")).toBe("today.md");
  });
});

describe("fileStem", () => {
  it("keeps letters and punctuation a file name may have", () => {
    expect(fileStem("a note, finally!.md")).toBe("a-note-finally-.md");
    expect(fileStem("图片 1.png")).toBe("图片-1.png");
  });
});

import { describe, expect, it } from "vitest";
import { fileNameOf } from "./file-name";

describe("fileNameOf", () => {
  it("reads the name of a path with either separator", () => {
    expect(fileNameOf(String.raw`C:\notes\today.md`)).toBe("today.md");
    expect(fileNameOf("/home/me/notes/today.md")).toBe("today.md");
  });
});

import type { FolderEntry } from "@pupitre/desktop-api";
import { describe, expect, it } from "vitest";
import { sortFolderEntries, UNTIMED } from "./folder-sort";

const entry = (name: string, kind: FolderEntry["kind"] = "file"): FolderEntry => ({
  name,
  path: `/${name}`,
  kind,
});

describe("sortFolderEntries", () => {
  it("puts directories first and then the newest file", () => {
    const sorted = sortFolderEntries(
      [entry("old.md"), entry("folder", "directory"), entry("new.md")],
      [1, UNTIMED, 2],
    );
    expect(sorted.map((item) => item.name)).toEqual(["folder", "new.md", "old.md"]);
    expect(sorted[1]?.time).toBe(2);
    expect(sorted[0]?.time).toBeUndefined();
  });

  it("orders by name when it has no times", () => {
    const sorted = sortFolderEntries([entry("b.md"), entry("a.md")]);
    expect(sorted.map((item) => item.name)).toEqual(["a.md", "b.md"]);
    expect(sorted.every((item) => item.time === undefined)).toBe(true);
  });

  it("keeps entries the system could not date at the end", () => {
    const sorted = sortFolderEntries([entry("unknown.md"), entry("dated.md")], [UNTIMED, 5]);
    expect(sorted.map((item) => item.name)).toEqual(["dated.md", "unknown.md"]);
  });
});

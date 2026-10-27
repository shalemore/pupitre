import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { moveFile } from "./move-file";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, rename: vi.fn<typeof actual.rename>() };
});

const renameMock = vi.mocked(rename);
let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "pupitre-move-file-"));
  renameMock.mockReset();
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** The error a rename reports when the two paths are on different volumes. */
function crossDevice(): Error {
  return Object.assign(new Error("cross-device"), { code: "EXDEV" });
}

describe("moveFile", () => {
  it("copies and removes the source when a rename cannot cross a file system", async () => {
    const from = join(dir, "from.txt");
    const to = join(dir, "to.txt");
    await writeFile(from, "hello");
    renameMock.mockRejectedValue(crossDevice());

    await moveFile(from, to);

    expect(renameMock).toHaveBeenCalledWith(from, to);
    expect(await readFile(to, "utf8")).toBe("hello");
    await expect(readFile(from, "utf8")).rejects.toThrow(/ENOENT/);
  });

  it("does not hide any other rename failure", async () => {
    const from = join(dir, "from.txt");
    const to = join(dir, "to.txt");
    await writeFile(from, "hello");
    renameMock.mockRejectedValue(Object.assign(new Error("denied"), { code: "EACCES" }));

    await expect(moveFile(from, to)).rejects.toThrow("denied");
    expect(await readFile(from, "utf8")).toBe("hello");
  });
});

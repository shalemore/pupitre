import { describe, expect, it } from "vitest";
import { formatFileSize } from "./file-size";

describe("formatting a file size", () => {
  it("steps up a unit every 1024 bytes", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1024)).toBe("1 KiB");
    expect(formatFileSize(1536)).toBe("1.5 KiB");
    expect(formatFileSize(20 * 1024 * 1024)).toBe("20 MiB");
    expect(formatFileSize(3 * 1024 ** 3)).toBe("3 GiB");
  });

  it("keeps a value below the smallest unit as it is", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(999)).toBe("999 B");
  });
});

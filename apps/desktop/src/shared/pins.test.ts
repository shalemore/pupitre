import { describe, expect, it } from "vitest";
import { pinKeyOf } from "./pins";

describe("pin keys", () => {
  it("writes a path with forward slashes and no edge slash", () => {
    expect(pinKeyOf("docs\\guide.md")).toBe("docs/guide.md");
    expect(pinKeyOf("/docs/guide.md/")).toBe("docs/guide.md");
  });

  it("leaves out paths that name nothing or leave the folder", () => {
    expect(pinKeyOf("")).toBeUndefined();
    expect(pinKeyOf("/")).toBeUndefined();
    expect(pinKeyOf("../outside.md")).toBeUndefined();
    expect(pinKeyOf("docs//guide.md")).toBeUndefined();
    expect(pinKeyOf("./guide.md")).toBeUndefined();
  });
});

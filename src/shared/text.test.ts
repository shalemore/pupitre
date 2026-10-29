import { describe, expect, it } from "vitest";
import { toLf } from "./text";

describe("normalizing line endings", () => {
  it("turns CRLF and a lone CR into LF", () => {
    expect(toLf("a\r\nb\rc\nd")).toBe("a\nb\nc\nd");
  });

  it("leaves text already written in LF as it is", () => {
    expect(toLf("a\nb")).toBe("a\nb");
  });
});

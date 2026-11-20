import { describe, expect, it } from "vitest";
import { isRecord } from "./objects";

describe("isRecord", () => {
  it.each([{}, { a: 1 }, { nested: { b: 2 } }])("accepts %j", (value) => {
    expect(isRecord(value)).toBe(true);
  });

  it.each([null, undefined, 0, "", [], [1]])("rejects %j", (value) => {
    expect(isRecord(value)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { imageExtensionFor, imageMimeType } from "./image-types";

describe("imageMimeType", () => {
  it("reads an extension with or without its dot", () => {
    expect(imageMimeType("png")).toBe("image/png");
    expect(imageMimeType(".JPEG")).toBe("image/jpeg");
  });

  it("returns nothing for another file", () => {
    expect(imageMimeType(".txt")).toBeUndefined();
    expect(imageMimeType("")).toBeUndefined();
  });
});

describe("imageExtensionFor", () => {
  it("picks one extension for a type two of them share", () => {
    expect(imageExtensionFor("image/jpeg")).toBe(".jpg");
    expect(imageExtensionFor("image/png; charset=binary")).toBe(".png");
  });

  it("returns nothing for another type", () => {
    expect(imageExtensionFor("text/plain")).toBeUndefined();
  });
});

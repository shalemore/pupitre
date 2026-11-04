import { describe, expect, it } from "vitest";
import { type ZoomKeystroke, zoomCommandOf } from "./zoom-shortcuts";

function key(overrides: Partial<ZoomKeystroke> = {}): ZoomKeystroke {
  return {
    type: "keyDown",
    key: "",
    control: true,
    meta: false,
    alt: false,
    shift: false,
    ...overrides,
  };
}

describe("zoomCommandOf", () => {
  it("steps the zoom with the characters plus, equals and minus", () => {
    expect(zoomCommandOf(key({ key: "=" }), "win32")).toBe("in");
    expect(zoomCommandOf(key({ key: "+", shift: true }), "win32")).toBe("in");
    expect(zoomCommandOf(key({ key: "-" }), "win32")).toBe("out");
  });

  it("takes the keypad's plus, minus and zero as the same keys", () => {
    expect(zoomCommandOf(key({ key: "+" }), "win32")).toBe("in");
    expect(zoomCommandOf(key({ key: "-" }), "win32")).toBe("out");
    expect(zoomCommandOf(key({ key: "0" }), "win32")).toBe("reset");
  });

  it("resets the zoom with zero and its shifted paren", () => {
    expect(zoomCommandOf(key({ key: "0" }), "win32")).toBe("reset");
    expect(zoomCommandOf(key({ key: ")", shift: true }), "win32")).toBe("reset");
  });

  it("keeps Ctrl+Shift+R as the reset it used to be", () => {
    expect(zoomCommandOf(key({ key: "R", shift: true }), "win32")).toBe("reset");
    expect(zoomCommandOf(key({ key: "r" }), "win32")).toBeUndefined();
  });

  it("follows the command key of the platform", () => {
    expect(zoomCommandOf(key({ key: "=", control: false, meta: true }), "darwin")).toBe("in");
    expect(zoomCommandOf(key({ key: "=" }), "darwin")).toBeUndefined();
    expect(zoomCommandOf(key({ key: "=", control: false, meta: true }), "win32")).toBe(undefined);
  });

  it("ignores the keys without the command key, with Alt, or once released", () => {
    expect(zoomCommandOf(key({ key: "=", control: false }), "win32")).toBeUndefined();
    expect(zoomCommandOf(key({ key: "=", alt: true }), "win32")).toBeUndefined();
    expect(zoomCommandOf(key({ key: "=", type: "keyUp" }), "win32")).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { type Keystroke, shortcutOf } from "./shortcuts";

function key(overrides: Partial<Keystroke> = {}): Keystroke {
  return {
    type: "keyDown",
    key: "",
    control: true,
    meta: false,
    alt: false,
    shift: false,
    isAutoRepeat: false,
    ...overrides,
  };
}

describe("shortcutOf", () => {
  it("steps the zoom with the characters plus, equals and minus", () => {
    expect(shortcutOf(key({ key: "=" }), "win32")).toEqual({ kind: "zoom", command: "in" });
    expect(shortcutOf(key({ key: "+", shift: true }), "win32")).toEqual({
      kind: "zoom",
      command: "in",
    });
    expect(shortcutOf(key({ key: "-" }), "win32")).toEqual({ kind: "zoom", command: "out" });
  });

  it("takes the keypad's plus, minus and zero as the same keys", () => {
    expect(shortcutOf(key({ key: "+" }), "win32")).toEqual({ kind: "zoom", command: "in" });
    expect(shortcutOf(key({ key: "-" }), "win32")).toEqual({ kind: "zoom", command: "out" });
    expect(shortcutOf(key({ key: "0" }), "win32")).toEqual({ kind: "zoom", command: "reset" });
  });

  it("resets the zoom with zero and its shifted paren", () => {
    expect(shortcutOf(key({ key: "0" }), "win32")).toEqual({ kind: "zoom", command: "reset" });
    expect(shortcutOf(key({ key: ")", shift: true }), "win32")).toEqual({
      kind: "zoom",
      command: "reset",
    });
  });

  it("keeps Ctrl+Shift+R as the reset it used to be", () => {
    expect(shortcutOf(key({ key: "R", shift: true }), "win32")).toEqual({
      kind: "zoom",
      command: "reset",
    });
    expect(shortcutOf(key({ key: "r" }), "win32")).toBeUndefined();
  });

  it("toggles the theme on every new press but not while the key repeats", () => {
    expect(shortcutOf(key({ key: "D", shift: true }), "win32")).toEqual({ kind: "toggleTheme" });
    expect(shortcutOf(key({ key: "D", shift: true, isAutoRepeat: true }), "win32")).toBeUndefined();
    expect(shortcutOf(key({ key: "d" }), "win32")).toBeUndefined();
  });

  it("follows the command key of the platform", () => {
    expect(shortcutOf(key({ key: "=", control: false, meta: true }), "darwin")).toEqual({
      kind: "zoom",
      command: "in",
    });
    expect(shortcutOf(key({ key: "=" }), "darwin")).toBeUndefined();
    expect(shortcutOf(key({ key: "=", control: false, meta: true }), "win32")).toBe(undefined);
  });

  it("ignores the keys without the command key, with Alt, or once released", () => {
    expect(shortcutOf(key({ key: "=", control: false }), "win32")).toBeUndefined();
    expect(shortcutOf(key({ key: "=", alt: true }), "win32")).toBeUndefined();
    expect(shortcutOf(key({ key: "=", type: "keyUp" }), "win32")).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { type ChromeOptions, chromeVisibility } from "./chrome-visibility";

const options: ChromeOptions = {
  immersive: () => true,
  canFold: () => true,
  titleBarPinned: () => false,
  startPinned: () => false,
  endPinned: () => false,
  startRoom: () => 256,
  endRoom: () => 256,
};

const state = {
  writing: true,
  kept: false,
  near: { top: false, start: false, end: false },
  topReached: false,
};

const at = (overrides: Partial<typeof state> = {}) =>
  chromeVisibility({ ...state, ...overrides }, options, 1400);

describe("chromeVisibility", () => {
  it("folds the chrome while writing and shows it before the first work", () => {
    expect(chromeVisibility(state, options, 1400)).toEqual({
      titleBar: false,
      start: false,
      end: false,
    });
    expect(chromeVisibility({ ...state, writing: false }, options, 1400)).toEqual({
      titleBar: true,
      start: true,
      end: true,
    });
  });

  it("shows the bar only while the pointer is at the top since the last write", () => {
    const top = { near: { top: true, start: false, end: false } };
    expect(at(top).titleBar).toBe(false);
    expect(at({ ...top, topReached: true }).titleBar).toBe(true);
    expect(at({ ...top, topReached: true, writing: false }).titleBar).toBe(true);
  });

  it("brings each sidebar back from its own edge", () => {
    expect(at({ near: { top: false, start: true, end: false } })).toEqual({
      titleBar: false,
      start: true,
      end: false,
    });
    expect(at({ near: { top: false, start: false, end: true } })).toEqual({
      titleBar: false,
      start: false,
      end: true,
    });
  });

  it("keeps what the user pinned out of the fold", () => {
    const pinned: ChromeOptions = {
      ...options,
      titleBarPinned: () => true,
      startPinned: () => true,
      endPinned: () => true,
    };
    expect(chromeVisibility(state, pinned, 1400)).toEqual({
      titleBar: true,
      start: true,
      end: true,
    });
  });

  it("gives the document room by folding the end sidebar before the start one", () => {
    const idle = { ...state, writing: false };
    expect(chromeVisibility(idle, options, 1000)).toEqual({
      titleBar: true,
      start: true,
      end: false,
    });
    expect(chromeVisibility(idle, options, 700)).toEqual({
      titleBar: true,
      start: false,
      end: false,
    });
    // A pinned end sidebar stays, and the start one gives way instead
    expect(chromeVisibility(idle, { ...options, endPinned: () => true }, 700)).toEqual({
      titleBar: true,
      start: false,
      end: true,
    });
  });

  it("keeps a classic window's title bar and only folds the sidebars the user collapsed", () => {
    const classic: ChromeOptions = { ...options, immersive: () => false };
    expect(chromeVisibility(state, classic, 1400)).toEqual({
      titleBar: true,
      start: false,
      end: false,
    });
    expect(
      chromeVisibility({ ...state, near: { top: false, start: true, end: false } }, classic, 1400),
    ).toEqual({ titleBar: true, start: true, end: false });
  });

  it("keeps the chrome out after a menu pick until the next write or scroll", () => {
    expect(chromeVisibility({ ...state, writing: false, kept: true }, options, 1400)).toEqual({
      titleBar: true,
      start: true,
      end: true,
    });
    expect(
      chromeVisibility({ ...state, writing: false }, { ...options, canFold: () => false }, 1400),
    ).toEqual({ titleBar: true, start: true, end: true });
  });
});

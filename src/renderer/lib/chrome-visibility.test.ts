import { describe, expect, it } from "vitest";
import { type ChromeOptions, chromeVisibility } from "./chrome-visibility";

const options: ChromeOptions = {
  immersive: () => true,
  canFold: () => true,
  titleBarPinned: () => false,
  startPinned: () => false,
  endPinned: () => false,
  startWanted: () => true,
  endWanted: () => true,
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
      startSidebar: false,
      endSidebar: false,
    });
    expect(chromeVisibility({ ...state, writing: false }, options, 1400)).toEqual({
      titleBar: true,
      startSidebar: true,
      endSidebar: true,
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
      startSidebar: true,
      endSidebar: false,
    });
    expect(at({ near: { top: false, start: false, end: true } })).toEqual({
      titleBar: false,
      startSidebar: false,
      endSidebar: true,
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
      startSidebar: true,
      endSidebar: true,
    });
  });

  it("gives the document room by folding the end sidebar before the start one", () => {
    const idle = { ...state, writing: false };
    expect(chromeVisibility(idle, options, 1000)).toEqual({
      titleBar: true,
      startSidebar: true,
      endSidebar: false,
    });
    expect(chromeVisibility(idle, options, 700)).toEqual({
      titleBar: true,
      startSidebar: false,
      endSidebar: false,
    });
    // A pinned end sidebar stays, and the start one gives way instead
    expect(chromeVisibility(idle, { ...options, endPinned: () => true }, 700)).toEqual({
      titleBar: true,
      startSidebar: false,
      endSidebar: true,
    });
  });

  it("keeps a classic window's title bar and only folds the sidebars the user collapsed", () => {
    const classic: ChromeOptions = { ...options, immersive: () => false };
    expect(chromeVisibility(state, classic, 1400)).toEqual({
      titleBar: true,
      startSidebar: false,
      endSidebar: false,
    });
    expect(
      chromeVisibility({ ...state, near: { top: false, start: true, end: false } }, classic, 1400),
    ).toEqual({ titleBar: true, startSidebar: true, endSidebar: false });
  });

  it("keeps a sidebar the layout has no place for hidden, whatever the pointer asks", () => {
    const idle = { ...state, writing: false, near: { top: false, start: true, end: true } };
    expect(chromeVisibility(idle, { ...options, startWanted: () => false }, 1400)).toMatchObject({
      startSidebar: false,
      endSidebar: true,
    });
  });

  it("keeps the chrome out after a menu pick until the next write or scroll", () => {
    expect(chromeVisibility({ ...state, writing: false, kept: true }, options, 1400)).toEqual({
      titleBar: true,
      startSidebar: true,
      endSidebar: true,
    });
    expect(
      chromeVisibility({ ...state, writing: false }, { ...options, canFold: () => false }, 1400),
    ).toEqual({ titleBar: true, startSidebar: true, endSidebar: true });
  });
});

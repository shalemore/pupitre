import { describe, expect, it } from "vitest";
import { sidebarState } from "./sidebar";

describe("sidebarState", () => {
  it("stores an immersive sidebar as its pin", () => {
    expect(sidebarState("start", true)).toEqual({ key: "sidebarPinnedStart", closed: false });
    expect(sidebarState("end", true)).toEqual({ key: "sidebarPinnedEnd", closed: false });
  });

  it("stores a classic sidebar as its collapse", () => {
    expect(sidebarState("start", false)).toEqual({
      key: "sidebarCollapsedStart",
      closed: true,
    });
    expect(sidebarState("end", false)).toEqual({ key: "sidebarCollapsedEnd", closed: true });
  });
});

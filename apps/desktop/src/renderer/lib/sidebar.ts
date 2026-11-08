/** The window edge a sidebar sits at; the immersive window folds each one towards its own edge. */
export type SidebarSide = "start" | "end";

/** The setting that holds one sidebar's state, and whether its value is the closed sidebar. */
export interface SidebarState {
  key: "sidebarPinnedStart" | "sidebarPinnedEnd" | "sidebarCollapsedStart" | "sidebarCollapsedEnd";
  closed: boolean;
}

const SIDEBAR_STATES: Readonly<
  Record<"immersive" | "classic", Readonly<Record<SidebarSide, SidebarState>>>
> = {
  immersive: {
    start: { key: "sidebarPinnedStart", closed: false },
    end: { key: "sidebarPinnedEnd", closed: false },
  },
  classic: {
    start: { key: "sidebarCollapsedStart", closed: true },
    end: { key: "sidebarCollapsedEnd", closed: true },
  },
};

/** An immersive window stores a sidebar's open state as its pin, a classic one as its collapse. */
export function sidebarState(side: SidebarSide, immersive: boolean): SidebarState {
  return SIDEBAR_STATES[immersive ? "immersive" : "classic"][side];
}

/** The width a sidebar opens at, and the room it may be dragged into. */
export const SIDEBAR_WIDTH = { initial: 256, min: 180, max: 480 } as const;

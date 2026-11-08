/** The window edge a sidebar sits at; the immersive window folds each one towards its own edge. */
export type SidebarSide = "start" | "end";

/** The width a sidebar opens at, and the room it may be dragged into. */
export const SIDEBAR_WIDTH = { initial: 256, min: 180, max: 480 } as const;

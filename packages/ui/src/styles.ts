/*
 * Classes app.css defines for a theme to replace. TypeScript names them so a component cannot
 * invent one; the stylesheet remains the only place that draws them.
 */
export const FLOATING_PANEL = "floating-panel";
export const PRESSABLE = "pressable";
export const OUTLINE_ROW = "outline-row";
export const SCROLL_FADE = "scroll-fade";

/* What a panel keeps from what it hangs from, and from the window edge, in the pixels UI SDK's
   positioning takes rather than the spacing tokens the styles use. */
export const PANEL_SIDE_OFFSET = 6;
export const PANEL_COLLISION_PADDING = 8;

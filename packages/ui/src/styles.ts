import { css } from "./styled-system/css";

/** A single line of text clipped with an ellipsis, to compose as `css(truncateStyle, { … })`. */
export const truncateStyle = css.raw({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

/** The same clip as a class, for an element that needs nothing else. */
export const truncate = "truncate";

/** A glyph that points the other way in a right-to-left window. */
export const rtlFlip = "rtl:scale-x-[-1]";

/** A small control that stays quiet until the pointer or the focus reaches it. */
export const quietButton =
  "shrink-0 text-tertiary opacity-50 transition-opacity duration-ui ease-out-expo hover:opacity-100 focus-visible:opacity-100 data-[pressed]:opacity-100";

/** The list inside a floating panel: every menu, dropdown and context menu shares it. */
export const menuPanel =
  "z-50 flex min-w-52 max-h-(--kb-popper-content-available-height) flex-col overflow-y-auto overscroll-contain rounded-sm p-1 text-xs text-foreground outline-none select-none";

/** A line that takes the room left in a row and clips what does not fit. */
export const truncateGrow = "truncate min-w-0 flex-1";

/** A control that keeps its size in a row that may be too narrow. */
export const shrinkNone = "shrink-0";

/** Text that stands beside the important part of a row. */
export const dim = "opacity-60";

/** A name a screen reader reads and the window does not show. */
export const srOnly = "sr-only";

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

/** The list a dropdown or a combobox lays its rows in: the panel draws the surface. */
export const listboxReset = "outline-none";

/** The caret that turns while the popup it names is open. */
export const chevronTurnClass =
  "transition-transform duration-base ease-out-expo [[data-open]_&]:rotate-180";

/** The caret that turns while the popup it names is open. */
export const chevronTurn = css.raw({
  transitionProperty: "transform",
  transitionDuration: "base",
  transitionTimingFunction: "outExpo",
  "[data-open] &": { transform: "rotate(180deg)" },
});

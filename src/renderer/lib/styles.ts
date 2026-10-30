import { css } from "@/styled-system/css";

/** A single line of text clipped with an ellipsis. */
export const truncate = css({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

/** A glyph that points the other way in a right-to-left window. */
export const rtlFlip = css({ _rtl: { scale: "-1 1" } });

/** A small control that stays quiet until the pointer or the focus reaches it. */
export const quietButton = css({
  flexShrink: 0,
  color: "tertiary",
  opacity: 0.5,
  transitionProperty: "opacity",
  transitionDuration: "ui",
  transitionTimingFunction: "outExpo",
  _hover: { opacity: 1 },
  _focusVisible: { opacity: 1 },
  "&[data-pressed]": { opacity: 1 },
});

/** The list inside a floating panel: every menu, dropdown and context menu shares it. */
export const menuPanel = css({
  zIndex: "50",
  display: "flex",
  minWidth: "52",
  maxHeight: "var(--kb-popper-content-available-height)",
  flexDirection: "column",
  overflowY: "auto",
  overscrollBehavior: "contain",
  padding: "1",
  textStyle: "xs",
  color: "foreground",
  outlineStyle: "none",
  userSelect: "none",
});

/** A line that takes the room left in a row and clips what does not fit. */
export const truncateGrow = css({
  minWidth: 0,
  flex: "1",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

/** A control that keeps its size in a row that may be too narrow. */
export const shrinkNone = css({ flexShrink: 0 });

/** Text that stands beside the important part of a row. */
export const dim = css({ opacity: 0.6 });

/** A name a screen reader reads and the window does not show. */
export const srOnly = css({ srOnly: true });

/*
 * Classes app.css defines for a theme to replace. TypeScript names them so a component cannot
 * invent one; the stylesheet remains the only place that draws them.
 */
export const FLOATING_PANEL = "floating-panel";
export const PRESSABLE = "pressable";
export const OUTLINE_ROW = "outline-row";
export const SCROLL_FADE = "scroll-fade";

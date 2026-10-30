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

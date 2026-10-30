import { css } from "@/styled-system/css";

/** The classes of the folder tree: its rows, the field that renames one, and the tree itself. */

export const errorText = css({
  paddingInline: "2.5",
  paddingBlock: "1.5",
  textStyle: "2xs",
  color: "destructive",
});
export const renameRow = css({
  display: "flex",
  alignItems: "center",
  gap: "1.5",
  paddingInlineEnd: "2.5",
});
export const indentIcon = css({ width: "3", height: "3", flexShrink: 0 });
export const chevron = css({
  width: "3",
  height: "3",
  flexShrink: 0,
  transitionProperty: "transform",
  transitionDuration: "base",
  transitionTimingFunction: "outExpo",
  _rtl: { scale: "-1 1" },
});
export const chevronOpen = css({ rotate: "90deg" });
export const fileIcon = css({ width: "3.5", height: "3.5", flexShrink: 0 });
export const renameField = css({
  minWidth: 0,
  flex: "1",
  borderRadius: "md",
  borderWidth: "hairline",
  borderStyle: "solid",
  borderColor: "border",
  backgroundColor: "surface.2",
  paddingInline: "2.5",
  paddingBlock: "1",
  textStyle: "xs",
  color: "foreground",
  outlineStyle: "none",
  _focusVisible: { boxShadow: "focus" },
});
export const groupRow = css({ position: "relative" });
export const itemsStart = css({ alignItems: "flex-start" });
export const rowDirectory = css({ paddingInlineEnd: "8" });
export const nameMin = css({ minWidth: 0 });
export const nameGrow = css({ flex: "1" });
export const blockTruncate = css({
  display: "block",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
export const secondaryLine = css({
  display: "block",
  textStyle: "2xs",
  fontWeight: "normal",
  color: "tertiary",
  fontVariantNumeric: "tabular-nums",
});
export const excerptLine = css({
  marginBlockStart: "0.5",
  lineClamp: 2,
  textStyle: "2xs",
  fontWeight: "normal",
  color: "tertiary",
});
export const openButton = css({
  position: "absolute",
  insetInlineEnd: "1",
  top: "50%",
  translate: "0 -50%",
  opacity: 0,
  transitionProperty: "opacity",
  transitionDuration: "ui",
  transitionTimingFunction: "outExpo",
  _groupHover: { opacity: 1 },
  _focusVisible: { opacity: 1 },
});
export const arrow = css({ width: "3", height: "3", _rtl: { scale: "-1 1" } });
export const iconOffset = css({ marginBlockStart: "0.5" });
export const stack = css({ "& > * + *": { marginBlockStart: "0.5" } });
export const expandAnimation = css({
  "& > * + *": { marginBlockStart: "0.5" },
  animationName: "fadeInDownSmall",
  animationDuration: "base",
  animationTimingFunction: "enter",
});
export const treeRoot = css({
  padding: "2",
  minHeight: "full",
  "& > * + *": { marginBlockStart: "0.5" },
});
export const sectionLabel = css({
  paddingInline: "2.5",
  paddingBlockStart: "1",
  textStyle: "2xs",
  fontWeight: "medium",
  letterSpacing: "wider",
  color: "tertiary",
  textTransform: "uppercase",
});
export const divider = css({
  marginInline: "2.5",
  borderBlockStartWidth: "hairline",
  borderBlockStartStyle: "solid",
  borderBlockStartColor: "border.subtle",
});

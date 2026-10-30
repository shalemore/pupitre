import { css } from "@/styled-system/css";

/** The classes of the main window: its frame, the title bar and the card the document stands on. */

export const windowFrame = css({
  height: "100vh",
  width: "100vw",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  color: "foreground",
  _print: { display: "block", height: "auto", overflow: "visible" },
});
export const windowImmersive = css({ backgroundColor: "surface.0" });
export const windowClassic = css({ backgroundColor: "surface.1" });
export const titleBar = css({
  overflow: "hidden",
  transitionProperty: "height",
  transitionDuration: "sheet",
  transitionTimingFunction: "outExpo",
});
export const titleBarHidden = css({ height: 0 });
export const frameBorderBottom = css({
  borderBlockEndWidth: "hairline",
  borderBlockEndStyle: "solid",
  borderBlockEndColor: "border",
});
export const frameBorderStart = css({
  borderInlineStartWidth: "hairline",
  borderInlineStartStyle: "solid",
  borderInlineStartColor: "border",
});
export const frameBorderEnd = css({
  borderInlineEndWidth: "hairline",
  borderInlineEndStyle: "solid",
  borderInlineEndColor: "border",
});
export const titleGrid = css({
  flex: "1",
  minWidth: 0,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, auto) minmax(0, 1fr)",
  alignItems: "center",
  gap: "2",
});
export const titleStart = css({
  display: "flex",
  minWidth: 0,
  alignItems: "center",
  gap: "2",
  overflow: "hidden",
});
export const mark = css({ color: "muted.foreground" });
export const titleCenter = css({
  minWidth: 0,
  paddingInline: "4",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "2",
  fontWeight: "medium",
  color: "foreground",
});
export const dirtyDot = css({
  width: "1.5",
  height: "1.5",
  flexShrink: 0,
  borderRadius: "full",
  backgroundColor: "brand",
  animationName: "zoomIn",
  animationDuration: "snap",
  animationTimingFunction: "outExpo",
});
export const ellipsis = css({ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });
export const titleEnd = css({
  display: "flex",
  minWidth: 0,
  alignItems: "center",
  justifyContent: "flex-end",
  overflow: "hidden",
});
export const content = css({
  flex: "1",
  minHeight: 0,
  display: "flex",
  overflow: "hidden",
  _print: { display: "block", overflow: "visible" },
});
export const contentGap = css({
  gap: "var(--pref-immersive-gap)",
  paddingBlock: "var(--pref-immersive-gap)",
  paddingInlineStart: 0,
  _print: { padding: 0 },
});
export const contentEnd = css({ paddingInlineEnd: "var(--pref-immersive-gap)" });
export const contentEndSplit = css({ paddingInlineEnd: 0 });
export const card = css({
  flex: "1",
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  _print: { display: "block", overflow: "visible" },
});
export const cardImmersive = css({
  borderRadius: "lg",
  backgroundColor: "surface.1",
  boxShadow: "sm",
  _print: { borderRadius: 0, boxShadow: "none" },
});
export const documentArea = css({
  flex: "1",
  minHeight: 0,
  display: "flex",
  overflow: "hidden",
  _print: { display: "block", overflow: "visible" },
});
export const grow = css({ flex: "1" });
export const editorArea = css({
  flex: "1",
  height: "full",
  overflow: "hidden",
  position: "relative",
  _print: { height: "auto", overflow: "visible" },
});
export const wordCountLabel = css({
  textStyle: "2xs",
  color: "muted.foreground",
  fontVariantNumeric: "tabular-nums",
  display: "flex",
  flexShrink: 0,
  alignItems: "center",
  gap: "1.5",
  whiteSpace: "nowrap",
  marginInlineEnd: "2",
});

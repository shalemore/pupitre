import { cva, css } from "@/styled-system/css";

/** The classes of the main window: the title bar and the card the document stands on. */

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
/**
 * The row the card and the sidebars stand in. An immersive window keeps an even gap to its edges,
 * and in a split layout the end sidebar reaches the window edge.
 */
export const content = cva({
  base: {
    flex: "1",
    minHeight: 0,
    display: "flex",
    overflow: "hidden",
    _print: { display: "block", overflow: "visible" },
  },
  variants: {
    immersive: {
      true: {
        gap: "var(--pref-immersive-gap)",
        paddingBlock: "var(--pref-immersive-gap)",
        paddingInlineStart: 0,
        _print: { padding: 0 },
      },
    },
    split: { true: {}, false: {} },
  },
  compoundVariants: [
    { immersive: true, split: true, css: { paddingInlineEnd: 0 } },
    { immersive: true, split: false, css: { paddingInlineEnd: "var(--pref-immersive-gap)" } },
  ],
});
/** The document stands on a card of its own in an immersive window, and lies flat on a classic one. */
export const card = cva({
  base: {
    flex: "1",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    _print: { display: "block", overflow: "visible" },
  },
  variants: {
    immersive: {
      true: {
        borderRadius: "lg",
        backgroundColor: "surface.1",
        boxShadow: "sm",
        _print: { borderRadius: 0, boxShadow: "none" },
      },
    },
  },
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

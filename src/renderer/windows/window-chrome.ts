import { cva } from "@/styled-system/css";

/** The frame of a window and the borders between the parts inside it, shared by both windows. */

/** An immersive window stands its parts on its own surface; a classic one uses the page surface. */
export const windowFrame = cva({
  base: {
    height: "[100vh]",
    width: "[100vw]",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    color: "foreground",
    _print: { display: "block", height: "auto", overflow: "visible" },
  },
  variants: {
    immersive: {
      true: { backgroundColor: "surface.0" },
      false: { backgroundColor: "surface.1" },
    },
  },
});
/** A hairline under the title bar, which a classic window draws and an immersive one leaves out. */
export const barDivider = cva({
  base: {},
  variants: {
    classic: {
      true: {
        borderBlockEndWidth: "hairline",
        borderBlockEndStyle: "solid",
        borderBlockEndColor: "border",
      },
    },
  },
});
/** The hairline a classic window draws between a sidebar and the document. */
export const sidebarDivider = cva({
  base: {},
  variants: {
    side: { start: {}, end: {} },
    classic: { true: {}, false: {} },
  },
  compoundVariants: [
    {
      side: "start",
      classic: true,
      css: {
        borderInlineEndWidth: "hairline",
        borderInlineEndStyle: "solid",
        borderInlineEndColor: "border",
      },
    },
    {
      side: "end",
      classic: true,
      css: {
        borderInlineStartWidth: "hairline",
        borderInlineStartStyle: "solid",
        borderInlineStartColor: "border",
      },
    },
  ],
});

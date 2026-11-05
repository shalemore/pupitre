import { css } from "@/styled-system/css";

/** The frame of a window and the borders between the parts inside it, shared by both windows. */

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

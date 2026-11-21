import { cva } from "class-variance-authority";

/** The frame of a window and the borders between the parts inside it, shared by both windows. */

/** An immersive window stands its parts on its own surface; a classic one uses the page surface. */
export const windowFrame = cva(
  "flex h-screen w-screen flex-col overflow-hidden text-foreground print:block print:h-auto print:overflow-visible",
  {
    variants: {
      immersive: {
        true: "bg-surface-0",
        false: "bg-surface-1",
      },
    },
  },
);
/** A hairline under the title bar, which a classic window draws and an immersive one leaves out. */
export const barDivider = cva("", {
  variants: {
    classic: {
      true: "border-b border-hairline border-border",
    },
  },
});
/** The hairline a classic window draws between a sidebar and the document. */
export const sidebarDivider = cva("", {
  variants: {
    side: { start: "", end: "" },
    classic: { true: "", false: "" },
  },
  compoundVariants: [
    {
      side: "start",
      classic: true,
      class: "border-e border-hairline border-border",
    },
    {
      side: "end",
      classic: true,
      class: "border-s border-hairline border-border",
    },
  ],
});

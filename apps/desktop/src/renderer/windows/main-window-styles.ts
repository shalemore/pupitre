import { cva } from "class-variance-authority";

/** The classes of the main window: the title bar and the card the document stands on. */

export const titleGrid =
  "grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,auto)_minmax(0,1fr)] items-center gap-2";
export const titleStart = "flex min-w-0 items-center gap-2 overflow-hidden";
export const titleCenter =
  "flex min-w-0 items-center justify-center gap-2 px-4 font-medium text-foreground";
export const dirtyDot =
  "size-1.5 shrink-0 rounded-full bg-brand animate-[zoomIn_var(--transition-duration-snap)_var(--ease-out-expo)]";
export const titleEnd = "flex min-w-0 items-center justify-end overflow-hidden";
/**
 * The row the card and the sidebars stand in. An immersive window keeps an even gap to its edges,
 * and in a split layout the end sidebar reaches the window edge.
 */
export const content = cva(
  "flex min-h-0 flex-1 overflow-hidden print:block print:overflow-visible",
  {
    variants: {
      immersive: {
        true: "gap-(--pref-immersive-gap) py-(--pref-immersive-gap) ps-0 print:p-0",
      },
      split: { true: "", false: "" },
    },
    compoundVariants: [
      { immersive: true, split: true, class: "pe-0" },
      { immersive: true, split: false, class: "pe-(--pref-immersive-gap)" },
    ],
  },
);
/** The document stands on a card of its own in an immersive window, and lies flat on a classic one. */
export const card = cva(
  "flex min-w-0 flex-1 flex-col overflow-hidden print:block print:overflow-visible",
  {
    variants: {
      immersive: {
        true: "rounded-lg bg-surface-1 shadow-sm print:rounded-none print:shadow-none",
      },
      // A background plugin draws on the window, so the card must not paint over it
      clear: {
        true: "bg-transparent shadow-none",
      },
    },
  },
);
export const documentArea =
  "flex min-h-0 flex-1 overflow-hidden print:block print:overflow-visible";
/** The welcome screen takes the room the document would have. */
export const welcomeArea = "flex-1";
export const editorArea =
  "relative isolate h-full flex-1 overflow-hidden print:h-auto print:overflow-visible";

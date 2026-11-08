import type { Component } from "solid-js";
import { css } from "@/styled-system/css";

const layer = css({
  position: "fixed",
  insetBlockStart: "titleBar",
  insetInline: "0",
  insetBlockEnd: "0",
  zIndex: "50",
  overflow: "hidden",
  pointerEvents: "none",
  "& > *": { pointerEvents: "auto" },
});

/**
 * Holds floating panels below the title bar and clips them there, so a select near the bottom of
 * a short window opens upward over the document without covering the menu bar. Empty space passes
 * the pointer through to the window.
 */
export const PopupLayer: Component = () => <div data-popup-layer class={layer} />;

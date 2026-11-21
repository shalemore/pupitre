import type { Component } from "solid-js";

/**
 * Holds floating panels below the title bar and clips them there, so a select near the bottom of
 * a short window opens upward over the document without covering the menu bar. Empty space passes
 * the pointer through to the window.
 */
export const PopupLayer: Component = () => (
  <div
    data-popup-layer
    class="pointer-events-none fixed inset-x-0 top-title-bar bottom-0 z-50 overflow-hidden [&>*]:pointer-events-auto"
  />
);

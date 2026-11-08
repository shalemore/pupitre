/**
 * The custom properties the interface reads from the stylesheet in TypeScript. Naming them once
 * makes a misspelled token a compile error instead of a silent empty value, and
 * `scripts/check-css.ts` fails when one of them stops being declared by a stylesheet.
 *
 * Tokens the settings set at runtime (`--pref-*`) are named here too, so a reader cannot invent
 * one, but no stylesheet declares them. This module holds no values: they live in app.css, in
 * editor.css and in the active theme.
 */
export const TOKEN_NAMES = [
  // Window surfaces, text and accents
  "ui-surface-0",
  "ui-surface-1",
  "ui-text-primary",
  "ui-text-secondary",
  "ui-text-muted",
  "ui-brand",
  "ui-danger",
  "ui-success",

  // GitHub alerts
  "alert-note",
  "alert-tip",
  "alert-important",
  "alert-warning",
  "alert-caution",

  // Diagrams, drawn from the same colors as the document
  "diagram-fill",
  "diagram-stroke",
  "diagram-line",
  "diagram-text",
  "diagram-accent",

  // Fonts, where the theme names the fallback the settings' choices build on
  "font-document",
  "font-mono",
  "font-sans",
  "font-stack-intent",

  // Motion, so code that animates by hand follows the transitions around it
  "transition-duration-ui",
  "transition-duration-sheet",
  "ease-out-expo",

  // Preferences, set from the settings before the first render
  "pref-font-family",
  "pref-code-font",
  "pref-ui-font",
  "pref-font-size",
  "pref-line-height",
  "pref-content-width",
  "pref-immersive-gap",
] as const;

export type TokenName = (typeof TOKEN_NAMES)[number];

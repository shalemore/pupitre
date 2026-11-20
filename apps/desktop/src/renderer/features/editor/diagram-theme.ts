import type { DiagramTheme } from "@pupitre/markdown";
import { isDarkColor, toHex } from "@pupitre/utils";
import { readToken, type TokenName } from "@/lib/tokens";

/**
 * Reads the active theme's diagram colors (the --diagram-* tokens in app.css) into Mermaid's
 * `base` theme. Whether the diagram is dark follows the canvas color rather than the system
 * scheme, because a light-only theme can be used in dark mode.
 */
export function readDiagramTheme(): DiagramTheme {
  const style = getComputedStyle(document.documentElement);
  const color = (name: TokenName) => toHex(readToken(style, name));
  const canvas = color("ui-surface-1");
  const fill = color("diagram-fill");
  const stroke = color("diagram-stroke");
  const line = color("diagram-line");
  const text = color("diagram-text");
  const accent = color("diagram-accent");
  return {
    darkMode: isDarkColor(canvas),
    fontFamily: readToken(style, "pref-font-family") || readToken(style, "font-document"),
    background: canvas,
    primaryColor: fill,
    primaryTextColor: text,
    primaryBorderColor: stroke,
    mainBkg: fill,
    nodeBorder: stroke,
    textColor: text,
    titleColor: text,
    lineColor: line,
    tertiaryColor: canvas,
    clusterBkg: canvas,
    clusterBorder: stroke,
    edgeLabelBackground: canvas,
    noteBkgColor: fill,
    noteTextColor: text,
    noteBorderColor: accent,
    actorBkg: fill,
    actorBorder: stroke,
    actorTextColor: text,
    signalColor: line,
    signalTextColor: text,
    pie1: accent,
    // Mermaid's light gray shadow turns into a glow on a dark canvas
    dropShadow: "none",
  };
}

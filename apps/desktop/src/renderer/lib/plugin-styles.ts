import type { PluginStyle } from "@pupitre/desktop-api";
import { desktop } from "@pupitre/desktop-api/client";
import { createEffect, createSignal } from "solid-js";
import { settings } from "@/lib/settings";

const [styles, setStyles] = createSignal<readonly PluginStyle[]>([]);

/**
 * The element that carries the plugin styles, found in the document rather than kept in a module
 * variable, so a hot update still finds the CSS the window is showing.
 */
function styleElement(): HTMLStyleElement {
  const found = document.querySelector("style[data-plugin-style]");
  if (found instanceof HTMLStyleElement) return found;
  const element = document.createElement("style");
  element.dataset["pluginStyle"] = "";
  document.head.append(element);
  return element;
}

function loadPluginStyles(): void {
  void desktop.invoke("plugins:styles").then(setStyles, () => setStyles([]));
}

/**
 * Injects the plugins' styles into the `plugin` cascade layer, scoped to the document so a plugin
 * cannot restyle the window around it. The user's preferences sit above that layer and win.
 */
function applyPluginStyles(): void {
  const css = settings().pluginEffects ? styles() : [];
  styleElement().textContent = css
    .map((style) => `@layer plugin {\n@scope (.md-document) {\n${style.css}\n}\n}`)
    .join("\n");
}

/** Keeps the plugin stylesheets in the window current; called once by the main window. */
export function setupPluginStyles(): void {
  desktop.on("plugins:changed", loadPluginStyles);
  loadPluginStyles();
  createEffect(applyPluginStyles);
}

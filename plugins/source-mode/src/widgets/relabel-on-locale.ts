import { currentLocale } from "@pupitre/i18n/solid";
import { createEffect, createRoot } from "solid-js";

/**
 * Text a widget writes into its own DOM sits outside the Solid tree, so a language change does not
 * reach it by itself. A widget registers how to write its text again, and the callback is dropped
 * once its element leaves the document.
 */
const relabeling = new Set<() => void>();

createRoot(() =>
  createEffect(() => {
    currentLocale();
    // A relabel that finds its element gone removes itself; a Set iterator allows that
    for (const relabel of relabeling) relabel();
  }),
);

export function relabelOnLocaleChange(element: HTMLElement, relabel: () => void): void {
  const run = () => {
    if (element.isConnected) relabel();
    else relabeling.delete(run);
  };
  relabeling.add(run);
  relabel();
}

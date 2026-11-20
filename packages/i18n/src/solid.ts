import { createMemo, createRoot, createSignal } from "solid-js";
import { DEFAULT_LOCALE, getDictionary, getDirection, type SupportedLocale } from "./index";

const [locale, setLocaleSignal] = createRoot(() => createSignal<SupportedLocale>(DEFAULT_LOCALE));

/** Sets the language every `t()` reads from the next render on. */
export function setLocale(next: SupportedLocale): void {
  setLocaleSignal(next);
}

/** The language in use; the host resolves it from its settings and the system. */
export const currentLocale = createRoot(() => createMemo(() => locale()));

/** The dictionary `t()` returns, typed against every key the app translates. */
export const t = createRoot(() => createMemo(() => getDictionary(currentLocale())));

export const currentDirection = () => getDirection(currentLocale());

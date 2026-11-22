import { createMemo, createRoot, createSignal } from "solid-js";
import { DEFAULT_LOCALE, getDictionary, getDirection, type SupportedLocale } from "./index";

const [localeOverride, setLocaleSignal] = createRoot(() =>
  createSignal<SupportedLocale>(DEFAULT_LOCALE),
);
const [localeSource, setLocaleSource] = createRoot(() =>
  createSignal<(() => SupportedLocale) | undefined>(undefined),
);

/** Sets the language every `t()` reads from the next render on. */
export function setLocale(next: SupportedLocale): void {
  setLocaleSignal(next);
}

/** Derives the active locale directly from a reactive host getter without an effect relay. */
export function bindLocale(source: () => SupportedLocale): void {
  setLocaleSource(() => source);
}

/** The language in use; the host resolves it from its settings and the system. */
export const currentLocale = createRoot(() =>
  createMemo(() => localeSource()?.() ?? localeOverride()),
);

/** The dictionary `t()` returns, typed against every key the app translates. */
export const t = createRoot(() => createMemo(() => getDictionary(currentLocale())));

export const currentDirection = () => getDirection(currentLocale());

import { getDictionary, getDirection, resolveLocale } from "@pupitre/i18n";
import { createMemo, createRoot } from "solid-js";
import { settings } from "@/lib/settings";

export * from "@pupitre/i18n";

export const currentLocale = createRoot(() =>
  createMemo(() => resolveLocale(settings().locale, navigator.languages)),
);
export const t = createRoot(() => createMemo(() => getDictionary(currentLocale())));
export const currentDirection = () => getDirection(currentLocale());

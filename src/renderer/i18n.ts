import { getDictionary, getDirection, resolveLocale } from "@shared/i18n";
import { createMemo, createRoot } from "solid-js";
import { settings } from "@/lib/settings";

export * from "@shared/i18n";

export const currentLocale = createRoot(() =>
  createMemo(() => resolveLocale(settings().locale, [navigator.language])),
);
export const t = createRoot(() => createMemo(() => getDictionary(currentLocale())));
export const currentDirection = () => getDirection(currentLocale());

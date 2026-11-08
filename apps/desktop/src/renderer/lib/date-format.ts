import { intlLocale } from "@pupitre/i18n";
import { currentLocale } from "@pupitre/i18n/solid";
import { createMemo, createRoot } from "solid-js";

/** The date and time the interface shows, written in the language it is showing. */
export const dateTimeFormat = createRoot(() =>
  createMemo(
    () =>
      new Intl.DateTimeFormat(intlLocale(currentLocale()), {
        dateStyle: "medium",
        timeStyle: "short",
      }),
  ),
);

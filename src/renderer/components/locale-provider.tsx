import { I18nProvider } from "@kobalte/core/i18n";
import type { ParentComponent } from "solid-js";
import { currentLocale } from "@/i18n";

/**
 * Tells Kobalte the locale the app is set to. Without it Kobalte reads the direction from the
 * locale the browser was started in, which can differ from the one chosen in the settings.
 */
export const LocaleProvider: ParentComponent = (props) => (
  <I18nProvider locale={currentLocale()}>{props.children}</I18nProvider>
);

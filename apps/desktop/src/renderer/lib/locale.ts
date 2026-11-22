import { resolveLocale } from "@pupitre/i18n";
import { bindLocale } from "@pupitre/i18n/solid";
import { settings } from "@/lib/settings";

// The language every `t()` reads; derived directly from settings and system languages so
// consumers never paint a stale frame behind an effect relay.
bindLocale(() => resolveLocale(settings().locale, navigator.languages));

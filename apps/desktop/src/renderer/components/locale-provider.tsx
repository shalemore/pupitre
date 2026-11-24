import type { ParentComponent } from "solid-js";

/**
 * Keeps the locale wrapper boundary; `appearance.ts` sets `lang` and `dir` on the document root,
 * which UI SDK reads directly from the DOM.
 */
export const LocaleProvider: ParentComponent = (props) => <>{props.children}</>;

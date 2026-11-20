import type { JSX } from "@solidjs/web";
import { type Accessor, createContext, useContext } from "solid-js";

export type ScrollbarVisibility = "auto" | "always" | "never";

/** What `ScrollView` needs from the host's preferences; the app maps its settings onto it. */
export interface ScrollViewPreferences {
  scrollbar: ScrollbarVisibility;
  /** Dissolve content into the edges that still have more past them. */
  fade: boolean;
}

const DEFAULT: ScrollViewPreferences = { scrollbar: "auto", fade: true };

const ScrollViewPreferencesContext = createContext<Accessor<ScrollViewPreferences>>(() => DEFAULT);

export function ScrollViewPreferencesProvider(props: {
  value: Accessor<ScrollViewPreferences>;
  children: JSX.Element;
}) {
  return (
    <ScrollViewPreferencesContext value={props.value}>
      {props.children}
    </ScrollViewPreferencesContext>
  );
}

export function useScrollViewPreferences(): Accessor<ScrollViewPreferences> {
  return useContext(ScrollViewPreferencesContext);
}

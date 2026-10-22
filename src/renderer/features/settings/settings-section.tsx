import { type ParentComponent, Show } from "solid-js";

/** A titled group of settings rows. */
export const SettingsSection: ParentComponent<{ title: string; description?: string }> = (
  props,
) => (
  <section class="max-w-xl">
    <h2 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {props.title}
    </h2>
    <Show when={props.description}>
      <p class="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{props.description}</p>
    </Show>
    <div class="mt-3 divide-y divide-border/40">{props.children}</div>
  </section>
);

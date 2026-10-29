import { useComboboxContext } from "@kobalte/core/combobox";
import { createEffect, onMount } from "solid-js";

/**
 * Starts the list on its first row and keeps a row pointed at as the query replaces the list. The
 * input keeps the focus, so the list is walked through the combobox's own active descendant.
 */
export function FocusFirstRow(): null {
  const context = useComboboxContext();
  onMount(() => context.open("first", "manual"));
  createEffect(() => {
    const collection = context.listState().collection();
    const selection = context.listState().selectionManager();
    const focused = selection.focusedKey();
    if (focused != null && collection.getItem(focused) !== undefined) return;
    const first = collection.getFirstKey();
    if (first !== undefined) selection.setFocusedKey(first);
  });
  return null;
}

/** Keeps the highlighted row on show; the list scrolls, the focus stays in the input. */
export function ShowFocusedRow(): null {
  const context = useComboboxContext();
  createEffect(() => {
    const selection = context.listState().selectionManager();
    const key = selection.focusedKey();
    const id = context.listboxId();
    const list = id === undefined ? null : document.getElementById(id);
    if (key == null || list === null) return;
    list.querySelector(`[data-key="${key}"]`)?.scrollIntoView({ block: "nearest" });
  });
  return null;
}

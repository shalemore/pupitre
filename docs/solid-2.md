# Solid 2 & UI SDK Notes

Pupitre runs on Solid 2.0 (`solid-js`, `@solidjs/web`) and `@ui-sdk/solid`. Solid 2 enforces strict reactivity diagnostics in development that halt or warn on Solid 1 habits. Keep these project boundaries in mind instead of falling back to Solid 1 patterns.

## Reactivity Rules That Bite

- **Never write to signals inside an owned scope (`REACTIVE_WRITE_IN_OWNED_SCOPE`).** Module-level `createRoot` blocks must only create signals and computations; trigger initial async fetches outside `createRoot` (or in `onSettled`).
- **Never create primitives or register `onCleanup` inside `onSettled` (`PRIMITIVE_IN_FORBIDDEN_SCOPE`).** `onSettled` runs while the reactive queue is draining:
  - Return a cleanup function from `onSettled` instead of calling `onCleanup`. Use `listen()` from `@/lib/listen` rather than `makeEventListener` inside `onSettled`.
  - Use `debounce` from `@pupitre/utils` (plain `setTimeout`, no Solid owner) inside `onSettled` or editor setup instead of `@solid-primitives/scheduled`.
- **Never relay state through `createEffect` (`EFFECT_RELAY_TEAR`).** Reading a signal in `createEffect` just to write another signal splits one update across two flushes:
  - Derived values belong in `createMemo` or a plain function.
  - Local editable state that resets when a prop or upstream signal changes belongs in a **writable derived signal**: `createSignal(() => { source(); return initial; })`.
  - Chrome/UI reactions to an interaction (e.g. keeping an immersive bar open when a menu closes) belong in the event handler alongside the state change, not in a deferred `createEffect`.
- **Never read signals/props in untracked places (`STRICT_READ_UNTRACKED`).**
  - Read reactive values in JSX, `createMemo`, or the first (compute) argument of `createEffect(compute, effect)` — never in the component body, `ref` callbacks, event-handler binding expressions (`onClick={obj().fn}` → `onClick={() => obj().fn()}`), or the effect callback.
  - For form initial values, use `defaultValue={...}` instead of assigning `input.value` in `ref`.
  - Only use `untrack()` for genuinely imperative one-shot snapshots (such as a command method called from an effect), never to silence a warning on a reactive dependency.
- **Key `<For>` lists when objects are recreated (`UNSTABLE_LIST_IDENTITY`).** If a source rebuilds fresh objects on every fetch (like host menu entries), pass `keyed={(item) => item.id}` so DOM nodes and highlight state survive.
- **Keep `<Show>` / `<Match>` narrowing keyed.** Use `<Show when={val()} keyed>` / `<Match when={cond ? item : false} keyed>` so the child callback receives the narrowed value.

## CodeMirror + Solid 2 Islands

CodeMirror calls `WidgetType.toDOM()` synchronously inside `EditorView.update` (which can itself be triggered from `onSettled`). Calling Solid's `render()` synchronously inside `toDOM()` triggers Solid's global `flush()`, causing `PRIMITIVE_IN_FORBIDDEN_SCOPE` or CodeMirror re-entrancy (`Calls to EditorView.update are not allowed while an update is in progress`).

- Always mount Solid-backed CodeMirror widgets in `plugins/source-mode` through `mountWidget` / `unmountWidget` or `createStatefulWidgets` in `plugins/source-mode/src/mount-widget.ts`. They defer `render()` to a microtask, fold pre-mount updates, and guard against early `destroy()`.
- Keep active block previews (`MathWidget`, `MermaidWidget`, `HtmlBlockWidget`, `TocWidget`) as separate `block: true` widgets above `.md-code-block-start` in `rendered-blocks.ts` rather than nesting them inside the first `.cm-line`.

## `@ui-sdk/solid` Conventions

- Use `omit(props, ...)` instead of `splitProps`.
- Sheet/dialog anchors use `data-sheet` because `@ui-sdk/solid` owns `data-slot` on its elements.
- `MenuTrigger` / `DialogContent` / `SelectContent` render into `popupLayer()` (`container={popupLayer()}`) so popups stay clipped below the title bar.

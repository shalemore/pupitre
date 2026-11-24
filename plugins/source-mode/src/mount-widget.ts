import { render, type JSX } from "@solidjs/web";
import { createSignal, type Accessor, type Setter } from "solid-js";

const disposers = new WeakMap<HTMLElement, () => void>();

/**
 * Mounts a Solid subtree inside a CodeMirror `WidgetType.toDOM()` container.
 *
 * CodeMirror invokes `toDOM()` synchronously during `EditorView.update`, which itself may be
 * triggered from a Solid `onSettled` hook or `createEffect` callback (for example, when constructing
 * the view, restoring scroll position, or reconfiguring compartments). Calling Solid 2's `render()`
 * or `createSignal()` synchronously inside `toDOM()` would:
 * 1. Throw `PRIMITIVE_IN_FORBIDDEN_SCOPE` whenever `onSettled` is on the call stack.
 * 2. Synchronously run Solid 2's global `flush()`, which can execute another pending editor effect
 *    that calls `view.dispatch()` and crashes CodeMirror with
 *    `Calls to EditorView.update are not allowed while an update is in progress`.
 *
 * Deferring the Solid root creation to a microtask escapes both the CodeMirror update transaction
 * and any enclosing Solid lifecycle scope while still rendering before the browser's next paint.
 * If CodeMirror destroys the widget before the microtask runs, mounting is skipped.
 */
export function mountWidget(container: HTMLElement, view: () => JSX.Element): void {
  let disposed = false;
  let disposeRoot: (() => void) | undefined;

  disposers.set(container, () => {
    disposed = true;
    disposeRoot?.();
  });

  queueMicrotask(() => {
    if (disposed) return;
    disposeRoot = render(view, container);
  });
}

/** Disposes a Solid subtree mounted by `mountWidget`. Call from `WidgetType.destroy(dom)`. */
export function unmountWidget(dom: HTMLElement): void {
  disposers.get(dom)?.();
  disposers.delete(dom);
}

interface StatefulEntry<S> {
  update: (updater: (previous: S) => S) => void;
  dispose: () => void;
}

/**
 * Creates a typed pool for CodeMirror widgets whose DOM is kept across edits (`WidgetType.updateDOM`)
 * or updated imperatively from editor commands while a Solid subtree renders inside them.
 *
 * Updates that arrive before the deferred microtask mounts the Solid root are folded into the
 * pending initial state, so `updateDOM()` or focus commands called in the same turn never get lost.
 */
export function createStatefulWidgets<S>() {
  const entries = new WeakMap<HTMLElement, StatefulEntry<S>>();

  return {
    mount(
      container: HTMLElement,
      initial: S,
      view: (state: Accessor<S>, update: (updater: (previous: S) => S) => void) => JSX.Element,
    ): void {
      let pending = initial;
      let disposed = false;
      let setBox: Setter<{ current: S }> | undefined;
      let disposeRoot: (() => void) | undefined;

      const applyUpdate = (updater: (previous: S) => S) => {
        pending = updater(pending);
        setBox?.({ current: pending });
      };

      entries.set(container, {
        update: applyUpdate,
        dispose: () => {
          disposed = true;
          disposeRoot?.();
        },
      });

      queueMicrotask(() => {
        if (disposed) return;
        const [box, setState] = createSignal({ current: pending });
        setBox = setState;
        disposeRoot = render(() => view(() => box().current, applyUpdate), container);
      });
    },

    update(dom: HTMLElement, updater: (previous: S) => S): boolean {
      const entry = entries.get(dom);
      if (!entry) return false;
      entry.update(updater);
      return true;
    },

    unmount(dom: HTMLElement): void {
      entries.get(dom)?.dispose();
      entries.delete(dom);
    },
  };
}

import { cn } from "cn";
import { onCleanup, onMount, Show, type ParentComponent } from "solid-js";
import { desktop } from "@/lib/desktop";
import { CaptionButtons } from "./caption-buttons";

/**
 * What the title bar gives up as it narrows, most disposable first. The windows mark those parts
 * with data-bar-part; the menu bar and the document name stay, the name truncating and the menu
 * clipping only when there is nothing left to hide.
 */
const GIVE_WAY = ["count", "name"];

/**
 * The window title bar. It is draggable as a whole and leaves room for the native caption buttons
 * or traffic lights (see .app-title-bar in app.css); the main window on Windows and Linux gets
 * caption buttons drawn here instead. Its height is h-10, which has to stay TITLE_BAR_HEIGHT, the
 * height the main process gives the native buttons and the traffic lights.
 */
export const TitleBar: ParentComponent<{ class?: string; inert?: boolean }> = (props) => {
  const side = desktop.initialState.captionSide;
  // macOS keeps its traffic lights in the native bar, on the left, as the drawn buttons can
  const layoutSide = side ?? (desktop.platform === "darwin" ? "left" : undefined);
  let bar: HTMLElement | undefined;

  /** Whether the title grid's side cells hold more than their columns can show. */
  const crowded = (): boolean => {
    if (!bar) return false;
    if (bar.scrollWidth > bar.clientWidth) return true;
    const grid = bar.querySelector("[data-title-grid]");
    if (!(grid instanceof HTMLElement)) return false;
    return [grid.firstElementChild, grid.lastElementChild].some(
      (cell) => cell instanceof HTMLElement && cell.scrollWidth > cell.clientWidth,
    );
  };

  /**
   * Hides the parts that no longer fit, in GIVE_WAY order, and gives them back when they do. It
   * unhides everything first, so the answer does not depend on what is hidden now; the observer
   * sees one settled layout, since the width is the same at the end as at the start of a pass.
   */
  const fit = () => {
    if (!bar) return;
    const hidden: string[] = [];
    bar.removeAttribute("data-compact");
    for (const part of GIVE_WAY) {
      if (!crowded()) break;
      hidden.push(part);
      bar.setAttribute("data-compact", hidden.join(" "));
    }
  };

  onMount(() => {
    if (!bar) return;
    fit();
    // The bar resizes with the window, its parts with their text: a language change widens the menus
    const observer = new ResizeObserver(fit);
    observer.observe(bar);
    for (const child of bar.children) observer.observe(child);
    // A side cell keeps its column's width, so the parts inside it are what grows
    const grid = bar.querySelector("[data-title-grid]");
    if (grid !== null) {
      for (const cell of grid.children) {
        observer.observe(cell);
        for (const child of cell.children) observer.observe(child);
      }
    }
    onCleanup(() => observer.disconnect());
  });

  return (
    <header
      ref={(element) => (bar = element)}
      // The caption buttons stay on the window's physical side in every language, so the bar keeps one order; its texts follow their own script
      dir="ltr"
      data-caption-buttons={side}
      data-caption-side={layoutSide}
      inert={props.inert}
      class={cn(
        // The horizontal padding comes from .app-title-bar, which leaves room for the caption buttons
        "app-title-bar print:hidden w-full h-10 shrink-0 flex items-center gap-2 select-none bg-surface-0 text-xs",
        props.class,
      )}
    >
      <Show when={side === "left"}>
        <CaptionButtons side="left" />
      </Show>
      {props.children}
      <Show when={side === "right"}>
        <CaptionButtons side="right" />
      </Show>
    </header>
  );
};

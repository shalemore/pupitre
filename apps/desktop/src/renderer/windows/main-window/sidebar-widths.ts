import type { SidebarWidths } from "@pupitre/desktop-api";
import { debounce } from "@solid-primitives/scheduled";
import { createEffect, createSignal, on } from "solid-js";
import { desktop } from "@/lib/desktop";
import { SIDEBAR_WIDTH } from "@/lib/sidebar";

/** A drag reports the pointer for every pixel it moves; only the width it settles on is worth writing. */
const SAVE_DELAY = 300;

/** The width of each sidebar, kept from the last run and written back once a drag settles. */
export function createSidebarWidths(saved: SidebarWidths | undefined) {
  const [start, setStart] = createSignal(saved?.start ?? SIDEBAR_WIDTH.initial);
  const [end, setEnd] = createSignal(saved?.end ?? SIDEBAR_WIDTH.initial);
  const saveSoon = debounce(
    (startWidth: number, endWidth: number) =>
      void desktop.invoke("window:set-sidebar-widths", { start: startWidth, end: endWidth }),
    SAVE_DELAY,
  );
  createEffect(
    on([start, end], ([startWidth, endWidth]) => saveSoon(startWidth, endWidth), { defer: true }),
  );
  return { start, end, setStart, setEnd };
}

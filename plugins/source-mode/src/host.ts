import type { EditorView } from "@codemirror/view";
import type { DocumentImage } from "@pupitre/markdown";

interface Timing {
  duration: number;
  ease: (t: number) => number;
}

/**
 * What the rendering needs from the app that opened it: the picture menu draws the app's own
 * chrome, and motion follows the app's animation setting rather than the system alone.
 */
export interface SourceModeHost {
  openImageMenu(view: EditorView, event: MouseEvent, knownImage?: DocumentImage): boolean;
  motionEnabled(): boolean;
  scrollTiming(): Timing;
}

let host: SourceModeHost | undefined;

/** Sets the host once, before the editor that renders with these extensions is built. */
export function configureSourceModeHost(next: SourceModeHost): void {
  host = next;
}

export function sourceModeHost(): SourceModeHost {
  if (host === undefined) throw new Error("The source mode plugin has no host");
  return host;
}

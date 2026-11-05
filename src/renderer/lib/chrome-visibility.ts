/** What the window and its settings allow. A function per value keeps it reactive. */
export interface ChromeOptions {
  /** Whether the window is an immersive one; a classic window keeps its title bar and only folds sidebars the user collapsed. */
  immersive: () => boolean;
  canFold: () => boolean;
  startPinned: () => boolean;
  endPinned: () => boolean;
  titleBarPinned: () => boolean;
  /** Width a sidebar takes beside the document; 0 when the layout shows none. */
  startRoom: () => number;
  endRoom: () => number;
}

export interface ChromeVisibility {
  readonly titleBar: boolean;
  readonly start: boolean;
  readonly end: boolean;
}

/** Room the document keeps beside the sidebars: a narrower one wraps so hard it stops reading. */
const DOCUMENT_MIN_WIDTH = 560;

/**
 * The title bar and each sidebar are shown or folded from the same state and policy. This is the
 * only place that decides it; the editor wiring only feeds events in.
 */
export function chromeVisibility(
  state: {
    writing: boolean;
    kept: boolean;
    near: { top: boolean; start: boolean; end: boolean };
    topReached: boolean;
  },
  options: ChromeOptions,
  viewport: number,
): ChromeVisibility {
  const cramped = (room: number) => viewport < room + DOCUMENT_MIN_WIDTH;
  const endFolded = () => !options.endPinned() && cramped(options.startRoom() + options.endRoom());
  const startFolded = () =>
    !options.startPinned() && cramped(options.startRoom() + (endFolded() ? 0 : options.endRoom()));
  const shown = (atEdge: boolean, folded = false) =>
    !options.canFold() || state.kept || atEdge || (!state.writing && !folded);
  const sidebarShown = (atEdge: boolean, pinned: boolean, immersiveShown: boolean) =>
    options.immersive() ? pinned || immersiveShown : pinned || atEdge || state.kept;

  return {
    titleBar:
      !options.immersive() || options.titleBarPinned() || shown(state.near.top && state.topReached),
    start: sidebarShown(
      state.near.start,
      options.startPinned(),
      shown(state.near.start, startFolded()),
    ),
    end: sidebarShown(state.near.end, options.endPinned(), shown(state.near.end, endFolded())),
  };
}

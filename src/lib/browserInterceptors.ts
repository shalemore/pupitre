/**
 * Intercepts default browser/Webview2 behaviors that reveal webview origins:
 * - Reload shortcuts: F5, Ctrl+R, Ctrl+Shift+R
 * - Print dialog: Ctrl+P
 * - View source: Ctrl+U
 * - Browser history navigation: Alt+Left, Alt+Right, Backspace outside inputs
 * - Browser zooming: Ctrl+Plus, Ctrl+Minus, Ctrl+0, Ctrl+Wheel (redirected to app-level zoom)
 * - Browser context menu: right-click Inspect/Reload/Back/Forward
 * - Drag-drop window navigation
 */

export interface BrowserInterceptorOptions {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  onFind?: () => void;
  onReplace?: () => void;
}

export function setupBrowserInterceptors(options: BrowserInterceptorOptions = {}): () => void {
  if (typeof window === "undefined") return () => {};

  const handleKeyDown = (e: KeyboardEvent) => {
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;

    if (e.key === "F5" || (isCtrlOrCmd && e.key.toLowerCase() === "r")) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (isCtrlOrCmd && e.key.toLowerCase() === "p") {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (isCtrlOrCmd && e.key.toLowerCase() === "u") {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (isCtrlOrCmd && (e.key === "=" || e.key === "+" || e.code === "NumpadAdd")) {
      e.preventDefault();
      e.stopPropagation();
      options.onZoomIn?.();
      return;
    }

    if (isCtrlOrCmd && (e.key === "-" || e.code === "NumpadSubtract")) {
      e.preventDefault();
      e.stopPropagation();
      options.onZoomOut?.();
      return;
    }

    if (isCtrlOrCmd && (e.key === "0" || e.code === "Numpad0")) {
      e.preventDefault();
      e.stopPropagation();
      options.onZoomReset?.();
      return;
    }

    if (isCtrlOrCmd && e.key.toLowerCase() === "f") {
      e.preventDefault();
      e.stopPropagation();
      options.onFind?.();
      return;
    }

    if (isCtrlOrCmd && e.key.toLowerCase() === "h") {
      e.preventDefault();
      e.stopPropagation();
      options.onReplace?.();
      return;
    }

    if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (e.key === "Backspace") {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.closest(".cm-content"));
      if (!isInput) {
        e.preventDefault();
      }
    }
  };

  const handleWheel = (e: WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      if (e.deltaY < 0) {
        options.onZoomIn?.();
      } else if (e.deltaY > 0) {
        options.onZoomOut?.();
      }
    }
  };

  const handleContextMenu = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    const isTextInput = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
    if (!isTextInput) {
      e.preventDefault();
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
  };

  window.addEventListener("keydown", handleKeyDown, { capture: true });
  window.addEventListener("wheel", handleWheel, { passive: false });
  window.addEventListener("contextmenu", handleContextMenu);
  window.addEventListener("dragover", handleDragOver);

  return () => {
    window.removeEventListener("keydown", handleKeyDown, { capture: true });
    window.removeEventListener("wheel", handleWheel);
    window.removeEventListener("contextmenu", handleContextMenu);
    window.removeEventListener("dragover", handleDragOver);
  };
}

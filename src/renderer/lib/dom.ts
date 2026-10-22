import { onCleanup, onMount } from "solid-js";

/**
 * Attaches pointerdown outside and Escape key listeners to close popovers/dropdowns.
 */
export function useClickOutside(getRef: () => HTMLElement | null, onClose: () => void) {
  const handleClickOutside = (e: MouseEvent) => {
    const el = getRef();
    if (el && !el.contains(e.target as Node)) {
      onClose();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  onMount(() => {
    window.addEventListener("pointerdown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener("pointerdown", handleClickOutside);
    window.removeEventListener("keydown", handleKeyDown);
  });
}

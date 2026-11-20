// The host has to exist before the renderer is evaluated, because the renderer reads
// window.desktop at import time. Loading it as a module of its own, not with a static import in
// the same graph, also keeps the renderer's chunks from evaluating before the host's body.

/** Never leave the splash covering a page that did not reach the editor. */
const SPLASH_TIMEOUT = 8000;

function hideSplash(): void {
  const splash = document.getElementById("boot-splash");
  if (splash === null || splash.hasAttribute("data-done")) return;
  splash.setAttribute("data-done", "");
  window.setTimeout(() => splash.remove(), 500);
}

const root = document.getElementById("root");
if (root !== null) {
  // The editor chunk is the last thing to arrive on a slow connection; the settings window is up
  // as soon as its root renders, and has no editor to wait for.
  const ready = () =>
    location.hash === "#settings" ||
    document.querySelector(".cm-content, [data-slot=welcome]") !== null;
  const observer = new MutationObserver(() => {
    if (!ready()) return;
    observer.disconnect();
    requestAnimationFrame(() => requestAnimationFrame(hideSplash));
  });
  observer.observe(root, { childList: true, subtree: true });
}
window.setTimeout(hideSplash, SPLASH_TIMEOUT);

void (async () => {
  await import("./host");
  await import("@/main");
})();

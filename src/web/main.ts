// The host has to exist before the renderer is evaluated, because the renderer reads
// window.desktop at import time. Loading it as a module of its own, not with a static import in
// the same graph, also keeps the renderer's chunks from evaluating before the host's body.
void (async () => {
  await import("./host");
  await import("@/main");
})();

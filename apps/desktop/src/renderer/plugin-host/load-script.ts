/** Loads a classic script into a host page; the plugin bundle registers itself as it runs. */
export function loadScript(src: string): Promise<void> {
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  const script = document.createElement("script");
  script.src = src;
  script.addEventListener("load", () => resolve(), { once: true });
  script.addEventListener("error", () => reject(new Error(`Could not load ${src}`)), {
    once: true,
  });
  document.head.append(script);
  return promise;
}

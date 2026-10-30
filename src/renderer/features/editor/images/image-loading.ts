import type { EditorView } from "@codemirror/view";
import { t } from "@/i18n";
import { hasTransparency } from "./image-alpha";

/**
 * How a picture loads: the skeleton a slow download shows, the retries a failed one makes, and
 * the message that takes its place when it never arrives.
 */

/** A picture fetched from the web, whose absence may be the network's fault rather than its own. */
const WEB_IMAGE = /^https?:\/\//i;

/** How long a picture may take before a placeholder stands in for it. */
const SLOW_LOAD_DELAY = 500;

/** How long a failed download waits before each of its three tries, longer every time. */
const RETRY_DELAYS = [1000, 2000, 4000] as const;

/** The pictures whose download failed and that wait for the network, by the retry they run. */
const waitingForNetwork = new Set<() => boolean>();
let watchesNetwork = false;

/**
 * Runs `retry` once the network comes back, for a picture that could not be downloaded. The retry
 * gives back whether it still needs the network, so a picture that is gone or loaded leaves the set.
 */
function retryWhenNetworkReturns(retry: () => boolean): void {
  waitingForNetwork.add(retry);
  if (watchesNetwork) return;
  watchesNetwork = true;
  window.addEventListener("online", () => {
    for (const waiting of waitingForNetwork) {
      if (!waiting()) waitingForNetwork.delete(waiting);
    }
  });
}

/** Watches a picture load, showing the skeleton while it is slow and the retry when it fails. */
export function watchImage(
  view: EditorView,
  image: HTMLImageElement,
  frame: HTMLElement,
  src: string,
): void {
  const skeleton = document.createElement("span");
  skeleton.className = "md-image-skeleton";
  const message = document.createElement("span");
  message.className = "md-image-fallback-message";
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "md-image-retry";
  retry.textContent = t().editor.image.retry;
  const fallback = document.createElement("span");
  fallback.className = "md-image-fallback";
  fallback.append(message, retry);

  frame.setAttribute("data-state", "loading");
  frame.append(skeleton, fallback);

  const remote = WEB_IMAGE.test(src);
  const attributeWidth = Number(image.getAttribute("width"));
  const styleWidth = Number.parseFloat(image.style.width);
  let knownWidth = attributeWidth || (Number.isFinite(styleWidth) ? styleWidth : 0);
  let knownHeight = Number(image.getAttribute("height")) || 0;
  let loaded = false;
  let failed = false;
  let attempts = 0;
  let slowTimer: number | undefined;

  const showSkeleton = () => {
    window.clearTimeout(slowTimer);
    slowTimer = window.setTimeout(() => {
      if (!loaded && image.isConnected) frame.setAttribute("data-slow", "");
    }, SLOW_LOAD_DELAY);
  };

  const settle = (state: "ready" | "error") => {
    window.clearTimeout(slowTimer);
    frame.removeAttribute("data-slow");
    frame.setAttribute("data-state", state);
    view.requestMeasure();
  };

  /** Fetches the picture; a retry keeps the failure message up until the answer arrives. */
  const load = (retrying = false) => {
    if (!image.isConnected) return;
    loaded = false;
    window.clearTimeout(slowTimer);
    frame.removeAttribute("data-slow");
    if (!retrying) {
      frame.setAttribute("data-state", "loading");
      showSkeleton();
    }
    image.src = src;
  };

  // A download that failed once is tried again when the network comes back, without the user
  // having to notice that it went away
  const retryWhenOnline = () => {
    if (!image.isConnected || !failed) return false;
    failed = false;
    attempts = 0;
    load(true);
    return false;
  };

  image.addEventListener("load", () => {
    loaded = true;
    failed = false;
    attempts = 0;
    knownWidth = image.naturalWidth || knownWidth;
    knownHeight = image.naturalHeight || knownHeight;
    frame.style.removeProperty("inline-size");
    frame.style.removeProperty("min-block-size");
    settle("ready");
    // A picture with a clear background, an icon for one, keeps its own outline instead of
    // standing in a frame that would box it in
    frame.toggleAttribute("data-alpha", hasTransparency(image));
    // The line changes as the picture arrives, or as its frame gives way to its outline
    view.requestMeasure();
  });

  image.addEventListener("error", () => {
    if (loaded || !image.isConnected) return;
    if (remote) retryWhenNetworkReturns(retryWhenOnline);
    const delay = RETRY_DELAYS[attempts];
    if (remote && delay !== undefined) {
      attempts += 1;
      window.setTimeout(() => load(true), delay);
      return;
    }
    failed = true;
    message.textContent = remote ? t().editor.image.failedNetwork : t().editor.image.failedFile;
    // Keep the space the picture would take, so retrying it does not move the page
    if (knownWidth > 0) frame.style.inlineSize = `${knownWidth}px`;
    if (knownHeight > 0) frame.style.minBlockSize = `${knownHeight}px`;
    settle("error");
  });

  retry.addEventListener("mousedown", (event) => event.preventDefault());
  retry.addEventListener("click", () => {
    failed = false;
    attempts = 0;
    load(true);
  });

  showSkeleton();
  image.src = src;
}

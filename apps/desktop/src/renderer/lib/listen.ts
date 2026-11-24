/**
 * Adds a DOM listener and returns the function that takes it off again.
 *
 * `makeEventListener` does the same, but registers the removal with `onCleanup`, which Solid forbids
 * inside `onSettled`: a listener added there has to hand its removal back, and the component returns
 * it from its own `onSettled`. Where the listener is added in a computation, the primitive is the
 * shorter way to say it.
 */
export function listen<K extends keyof WindowEventMap>(
  target: Window,
  type: K,
  handler: (event: WindowEventMap[K]) => void,
  options?: AddEventListenerOptions,
): () => void;
export function listen<K extends keyof HTMLElementEventMap>(
  target: HTMLElement,
  type: K,
  handler: (event: HTMLElementEventMap[K]) => void,
  options?: AddEventListenerOptions,
): () => void;
export function listen(
  target: EventTarget,
  type: string,
  handler: EventListener,
  options?: AddEventListenerOptions,
): () => void {
  target.addEventListener(type, handler, options);
  return () => target.removeEventListener(type, handler, options);
}

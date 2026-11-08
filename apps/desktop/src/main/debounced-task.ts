/**
 * A task that runs once the calls stop, such as the write that follows a burst of window moves.
 * `flush` runs what is still pending, for the path that ends the process.
 */
export interface DebouncedTask {
  schedule: () => void;
  cancel: () => void;
  flush: () => void;
}

export function createDebouncedTask(
  run: () => void,
  delay: number,
  options: { unref?: boolean } = {},
): DebouncedTask {
  let timer: NodeJS.Timeout | undefined;

  const cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };

  return {
    schedule: () => {
      cancel();
      timer = setTimeout(() => {
        timer = undefined;
        run();
      }, delay);
      // A pending write must not be what keeps a quitting app alive, when it is flushed on the way out
      if (options.unref === true) timer.unref();
    },
    cancel,
    flush: () => {
      cancel();
      run();
    },
  };
}

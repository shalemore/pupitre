import pLimit, { type LimitFunction } from "p-limit";

/**
 * How many file operations run at once. A folder can hold thousands of documents, and starting a
 * read for every one of them exhausts the handles a process may open; a small window keeps a pass
 * over the folder quick without that.
 */
const IO_CONCURRENCY = 8;

/**
 * A limiter for one pass over a folder. Each pass gets its own, so a slow folder does not hold up
 * a pass over another one.
 */
export function createIOLimit(): LimitFunction {
  return pLimit(IO_CONCURRENCY);
}

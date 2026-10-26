import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const alias = { "@shared": resolve("src/shared"), "@": resolve("src/renderer") };

/**
 * The benchmarks live apart from the unit tests: `npm test` collects `*.test.ts` only and never
 * runs them, and a benchmark asserts only that it ran, so a parser regression shows as a number
 * rather than as a failure. Node, because the parser reads the text itself and none of it needs a
 * DOM.
 */
export default defineConfig({
  resolve: { alias },
  test: {
    environment: "node",
    benchmark: { include: ["bench/**/*.bench.ts"] },
  },
});

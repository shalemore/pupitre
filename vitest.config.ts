import { resolve } from "node:path";
import solid from "vite-plugin-solid";
import { defineConfig } from "vitest/config";

const alias = { "@shared": resolve("src/shared"), "@": resolve("src/renderer") };

// Unit tests sit next to the code they test. The main process and the shared code run in Node as
// they do in the app; the renderer runs in jsdom, which is enough for CodeMirror's state, its
// Lezer tree and commands. What needs real layout or the real app is covered by the e2e suite.
export default defineConfig({
  resolve: { alias },
  test: {
    // The property tests run a thousand documents through the parser, which coverage instrumentation
    // makes a few times slower than a plain run.
    testTimeout: 30_000,
    restoreMocks: true,
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["src/main/**/*.test.ts", "src/shared/**/*.test.ts", "scripts/**/*.test.ts"],
        },
      },
      {
        extends: true,
        plugins: [solid({ hot: false })],
        test: {
          name: "renderer",
          environment: "jsdom",
          include: ["src/renderer/**/*.test.{ts,tsx}"],
          // The renderer reads window.desktop at import time; the web demo's host provides one
          // that keeps everything in memory
          setupFiles: ["src/web/host.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/testing.ts",
        "src/shared/i18n/locales/**",
        "src/**/*.d.ts",
      ],
      reporter: ["text-summary", "html", "lcov"],
      // A floor that only catches a shrinking suite; raise it as more of the app is covered.
      thresholds: { statements: 9, branches: 12, functions: 5, lines: 9 },
    },
  },
});

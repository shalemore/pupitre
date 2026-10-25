import { resolve } from "node:path";
import { defineConfig } from "electron-vite";
import { rendererConfig } from "./vite.shared.js";

const shared = { "@shared": resolve("src/shared") };

export default defineConfig({
  main: {
    resolve: { alias: shared },
  },
  preload: {
    resolve: { alias: shared },
    // A preload script in a sandboxed renderer must be CommonJS
    build: { rolldownOptions: { output: { format: "cjs", entryFileNames: "[name].cjs" } } },
  },
  renderer: rendererConfig(),
});

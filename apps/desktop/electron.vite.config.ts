import { defineConfig } from "electron-vite";
import { rendererConfig, sharedAlias } from "./vite.shared.js";

export default defineConfig({
  main: {
    resolve: { alias: sharedAlias },
  },
  preload: {
    resolve: { alias: sharedAlias },
    // A preload script in a sandboxed renderer must be CommonJS
    build: { rolldownOptions: { output: { format: "cjs", entryFileNames: "[name].cjs" } } },
  },
  renderer: rendererConfig(),
});

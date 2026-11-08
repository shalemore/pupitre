import { resolve } from "node:path";
import { defineConfig } from "electron-vite";
import { rendererConfig, sharedAlias } from "./vite.shared.js";

export default defineConfig({
  main: {
    resolve: { alias: sharedAlias },
  },
  preload: {
    resolve: { alias: sharedAlias },
    // A preload script in a sandboxed renderer must be CommonJS
    build: {
      rolldownOptions: {
        input: {
          index: resolve("src/preload/index.ts"),
          plugin: resolve("src/preload/plugin.ts"),
        },
        output: { format: "cjs", entryFileNames: "[name].cjs" },
      },
    },
  },
  renderer: {
    ...rendererConfig(),
    build: {
      rolldownOptions: {
        input: {
          index: resolve("src/renderer/index.html"),
          pluginHost: resolve("src/renderer/plugin-host/index.html"),
          pluginSurface: resolve("src/renderer/plugin-host/surface.html"),
        },
      },
    },
  },
});

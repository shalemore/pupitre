import { resolve } from "node:path";
import { defineConfig } from "vite";
import { rendererConfig } from "./vite.shared";

// The renderer on its own, with the browser host of src/web in place of the desktop app's main process
export default defineConfig({
  root: "src/web",
  // Relative, so the page works from any path, such as https://<user>.github.io/pupitre/
  base: "./",
  publicDir: resolve("src/renderer/public"),
  ...rendererConfig(),
  build: { outDir: resolve("out/web"), emptyOutDir: true },
  preview: { host: "127.0.0.1" },
});

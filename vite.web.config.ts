import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

// The renderer on its own, with the browser host of src/web in place of the desktop app's main process
export default defineConfig({
  root: "src/web",
  // Relative, so the page works from any path, such as https://<user>.github.io/pupitre/
  base: "./",
  publicDir: resolve("src/renderer/public"),
  resolve: { alias: { "@shared": resolve("src/shared"), "@": resolve("src/renderer") } },
  plugins: [solid(), tailwindcss()],
  build: { outDir: resolve("out/web"), emptyOutDir: true },
  // Vite binds "localhost" to ::1 only on some machines, and the browser then gets a refused connection
  server: { host: "127.0.0.1" },
  preview: { host: "127.0.0.1" },
});

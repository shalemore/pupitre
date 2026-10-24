import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import pkg from "./package.json";
import { thirdPartyNotices } from "./scripts/third-party-notices";

// MathJax reads its own version with `eval('require')`, which a page's CSP forbids; giving it the
// version at build time leaves that branch out of the bundle
const define = { PACKAGE_VERSION: JSON.stringify(pkg.version) };

// The renderer on its own, with the browser host of src/web in place of the desktop app's main process
export default defineConfig({
  root: "src/web",
  // Relative, so the page works from any path, such as https://<user>.github.io/pupitre/
  base: "./",
  publicDir: resolve("src/renderer/public"),
  resolve: { alias: { "@shared": resolve("src/shared"), "@": resolve("src/renderer") } },
  define,
  plugins: [solid(), tailwindcss(), thirdPartyNotices()],
  build: { outDir: resolve("out/web"), emptyOutDir: true },
  // Vite binds "localhost" to ::1 only on some machines, and the browser then gets a refused connection
  server: { host: "127.0.0.1" },
  preview: { host: "127.0.0.1" },
});

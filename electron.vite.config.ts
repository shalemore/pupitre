import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "electron-vite";
import solid from "vite-plugin-solid";
import pkg from "./package.json";
import { thirdPartyNotices } from "./scripts/third-party-notices";

const shared = { "@shared": resolve("src/shared") };
// MathJax reads its own version with `eval('require')`, which the window's CSP forbids; giving it the
// version at build time leaves that branch out of the bundle
const define = { PACKAGE_VERSION: JSON.stringify(pkg.version) };

export default defineConfig({
  main: {
    resolve: { alias: shared },
  },
  preload: {
    resolve: { alias: shared },
    // A preload script in a sandboxed renderer must be CommonJS
    build: { rolldownOptions: { output: { format: "cjs", entryFileNames: "[name].cjs" } } },
  },
  renderer: {
    resolve: { alias: { ...shared, "@": resolve("src/renderer") } },
    define,
    plugins: [solid(), tailwindcss(), thirdPartyNotices()],
    // Vite binds "localhost" to ::1 only on some machines, and Electron then gets ERR_CONNECTION_REFUSED
    server: { host: "127.0.0.1" },
  },
});

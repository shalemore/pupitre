import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import solid from "vite-plugin-solid";
import pkg from "./package.json" with { type: "json" };
import { thirdPartyNotices } from "./scripts/third-party-notices.js";

/**
 * The settings of the renderer, which both the app and the web demo build: the same bundle, with
 * the same plugins and aliases. A function, so that each build gets plugins of its own.
 */
export function rendererConfig() {
  return {
    // MathJax reads its own version with `eval('require')`, which a page's CSP forbids; giving it
    // the version at build time leaves that branch out of the bundle
    define: { PACKAGE_VERSION: JSON.stringify(pkg.version) },
    resolve: { alias: { "@shared": resolve("src/shared"), "@": resolve("src/renderer") } },
    plugins: [solid(), tailwindcss(), thirdPartyNotices()],
    // Vite binds "localhost" to ::1 only on some machines, and the page then gets ERR_CONNECTION_REFUSED
    server: { host: "127.0.0.1" },
  };
}

import { resolve } from "node:path";
import { pandacss } from "@pandacss/vite";
import type { AliasOptions } from "vite";
import solid from "vite-plugin-solid";
import { thirdPartyNotices } from "./scripts/third-party-notices.js";

export const alias: AliasOptions = {
  "@shared": resolve("src/shared"),
  "@": resolve("src/renderer"),
};

export const sharedAlias: AliasOptions = { "@shared": resolve("src/shared") };

/**
 * The settings of the renderer, which both the app and the web demo build: the same bundle, with
 * the same plugins and aliases. A function, so that each build gets plugins of its own.
 */
export function rendererConfig() {
  return {
    resolve: { alias },
    // electron-vite gives each environment its own root; Panda scans from the repository instead
    plugins: [
      pandacss({
        cwd: process.cwd(),
        outdir: resolve(process.cwd(), "src/renderer/styled-system"),
      }),
      solid(),
      thirdPartyNotices(),
    ],
    // Vite binds "localhost" to ::1 only on some machines, and the page then gets ERR_CONNECTION_REFUSED
    server: { host: "127.0.0.1" },
  };
}

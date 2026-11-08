import { defineConfig } from "@pandacss/dev";
import { pandaPreset } from "@pupitre/panda-preset";

/**
 * The package generates its own classes only to type and run its components: the app's config
 * extends the same preset and scans this source, so the app's stylesheet is the one that defines
 * what the components use. Shipping a second stylesheet would define every class twice.
 */
export default defineConfig({
  presets: ["@pandacss/preset-base", "@pandacss/preset-panda", pandaPreset],
  preflight: false,
  jsxFramework: "solid",
  strictTokens: true,
  strictPropertyValues: true,
  include: ["./src/**/*.{ts,tsx}"],
  outdir: "src/styled-system",
  // Components import the helpers next to them; the app's config lists the same path so it can
  // extract their styles while scanning this source
  importMap: {
    css: "./styled-system/css",
    recipes: "./styled-system/recipes",
    patterns: "./styled-system/patterns",
    jsx: "./styled-system/jsx",
    tokens: "./styled-system/tokens",
  },
  exclude: ["./src/styled-system"],
  layers: { tokens: "theme", recipes: "components" },
});

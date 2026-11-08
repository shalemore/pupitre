import { defineConfig } from "@pandacss/dev";
import { pandaPreset } from "@pupitre/panda-preset";

/**
 * The interface's styles are generated from the values its stylesheet defines. The scales live in
 * `@pupitre/panda-preset`, which both this config and the UI package use, so a class name a
 * component computes is the class the app's stylesheet defines. Type safety comes from the tokens:
 * a color, size or duration that does not exist fails to compile. A value the scales do not have is
 * written as an arbitrary value in brackets, such as `width: "[100vh]"`.
 */
export default defineConfig({
  presets: ["@pandacss/preset-base", "@pandacss/preset-panda", pandaPreset],
  // Native controls come with borders, margins and a background of their own; the reset takes
  // them away so the app's styles decide every one of them
  preflight: true,
  jsxFramework: "solid",
  strictTokens: true,
  strictPropertyValues: true,
  // The UI package ships unstyled-in-place components: the app's stylesheet must define the
  // utilities they use, so the same scan covers both
  include: [
    "./src/renderer/**/*.{ts,tsx}",
    "./src/web/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  outdir: "src/renderer/styled-system",
  // The app imports through the renderer's alias and the UI package through a sibling path; Panda
  // only extracts the styles of a file whose helpers it can name, so both paths are listed here
  importMap: {
    css: ["@/styled-system/css", "./styled-system/css"],
    recipes: ["@/styled-system/recipes", "./styled-system/recipes"],
    patterns: ["@/styled-system/patterns", "./styled-system/patterns"],
    jsx: ["@/styled-system/jsx", "./styled-system/jsx"],
    tokens: ["@/styled-system/tokens", "./styled-system/tokens"],
  },
  // Generated code is not a source the scanner should read back
  exclude: ["./src/renderer/styled-system", "../../packages/ui/src/styled-system"],
  layers: { tokens: "theme", recipes: "components" },
});

import { defineConfig } from "@pandacss/dev";
import { TITLE_BAR_HEIGHT } from "@pupitre/desktop-api";
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
  // The app and the main process must agree on the bar's height, so the token comes from the
  // constant the native window is given rather than a second number in the stylesheet
  theme: { extend: { tokens: { sizes: { titleBar: { value: `${TITLE_BAR_HEIGHT}px` } } } } },
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
    "../../plugins/*/src/**/*.{ts,tsx}",
  ],
  outdir: "src/renderer/styled-system",
  // The app imports through the renderer's alias, the UI package through a sibling path and the
  // plugins through the package's own entry; Panda only extracts the styles of a file whose
  // helpers it can name, so every path is listed here
  importMap: {
    css: ["@/styled-system/css", "./styled-system/css", "@pupitre/ui"],
  },
  // Generated code is not a source the scanner should read back
  exclude: ["./src/renderer/styled-system", "../../packages/ui/src/styled-system"],
  layers: { tokens: "theme", recipes: "components" },
});

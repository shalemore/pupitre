import { defineConfig } from "@pandacss/dev";

/**
 * Panda generates the interface's styles from the values the stylesheets already define. Every
 * token below is an alias for a custom property in app.css, never a value of its own: a theme
 * overrides those properties in the `document-theme` layer, so it still changes the whole
 * interface without TypeScript knowing about it.
 *
 * Panda's tokens are the `theme` layer and its recipes the `components` layer, which is where the
 * app's own order puts them (app.css). Type safety comes from the tokens: a color, size or
 * duration that does not exist fails to compile.
 */
export default defineConfig({
  presets: ["@pandacss/preset-base", "@pandacss/preset-panda"],
  // The reset Tailwind's preflight used to give the chrome: borders on native controls and the
  // margins of headings, lists and paragraphs come from the app's own styles instead
  preflight: true,
  jsxFramework: "solid",
  include: ["./src/renderer/**/*.{ts,tsx}", "./src/web/**/*.{ts,tsx}"],
  outdir: "src/renderer/styled-system",
  // Components import through the renderer's alias, so Panda reads the same paths
  importMap: {
    css: "@/styled-system/css",
    recipes: "@/styled-system/recipes",
    patterns: "@/styled-system/patterns",
    jsx: "@/styled-system/jsx",
    tokens: "@/styled-system/tokens",
  },
  // Generated code is not a source the scanner should read back
  exclude: ["./src/renderer/styled-system"],
  layers: { tokens: "theme", recipes: "components" },
  theme: {
    extend: {
      tokens: {
        colors: {
          border: {
            DEFAULT: { value: "var(--border)" },
            subtle: { value: "var(--ui-alpha-1)" },
            strong: { value: "var(--ui-alpha-3)" },
          },
          input: { value: "var(--input)" },
          field: { value: "var(--ui-field)" },
          foreground: { value: "var(--foreground)" },
          primary: {
            DEFAULT: { value: "var(--primary)" },
            foreground: { value: "var(--primary-foreground)" },
          },
          secondary: {
            DEFAULT: { value: "var(--secondary)" },
            foreground: { value: "var(--secondary-foreground)" },
          },
          muted: {
            DEFAULT: { value: "var(--muted)" },
            foreground: { value: "var(--muted-foreground)" },
          },
          tertiary: { value: "var(--ui-text-muted)" },
          accent: { value: "var(--accent)" },
          destructive: { value: "var(--destructive)" },
          success: { value: "var(--ui-success)" },
          popover: { value: "var(--popover)" },
          brand: {
            DEFAULT: { value: "var(--brand)" },
            foreground: { value: "var(--brand-foreground)" },
            hover: { value: "var(--ui-brand-hover)" },
          },
          selected: { value: "var(--ui-alpha-2)" },
          surface: {
            0: { value: "var(--ui-surface-0)" },
            1: { value: "var(--ui-surface-1)" },
            2: { value: "var(--ui-surface-2)" },
            3: { value: "var(--ui-surface-3)" },
          },
          segmented: {
            track: { value: "var(--ui-segmented-track)" },
            thumb: { value: "var(--ui-segmented-thumb)" },
          },
          knob: { value: "var(--ui-knob)" },
          window: {
            close: { value: "var(--color-window-close)" },
            closeForeground: { value: "var(--color-window-close-foreground)" },
          },
        },
        fonts: {
          sans: { value: "var(--font-sans)" },
          mono: { value: "var(--font-mono)" },
        },
        // The interface's type scale, which a theme may resize as a whole
        fontSizes: {
          "2xs": { value: "var(--text-2xs)" },
          xs: { value: "var(--text-xs)" },
          sm: { value: "var(--text-sm)" },
          base: { value: "var(--text-base)" },
          xl: { value: "var(--text-xl)" },
        },
        radii: {
          xs: { value: "var(--radius-xs)" },
          sm: { value: "var(--radius-sm)" },
          md: { value: "var(--radius-md)" },
          lg: { value: "var(--radius-lg)" },
          xl: { value: "var(--radius-xl)" },
          "2xl": { value: "var(--radius-2xl)" },
          full: { value: "var(--radius-full)" },
        },
        shadows: {
          sm: { value: "var(--shadow-sm)" },
          md: { value: "var(--shadow-md)" },
          float: { value: "var(--shadow-float)" },
          focus: { value: "var(--shadow-focus)" },
          segmentedThumb: { value: "var(--shadow-segmented-thumb)" },
        },
        durations: {
          fast: { value: "var(--transition-duration-fast)" },
          snap: { value: "var(--transition-duration-snap)" },
          ui: { value: "var(--transition-duration-ui)" },
          base: { value: "var(--transition-duration-base)" },
          sheet: { value: "var(--transition-duration-sheet)" },
          slow: { value: "var(--transition-duration-slow)" },
        },
        easings: {
          outExpo: { value: "var(--ease-out-expo)" },
          snap: { value: "var(--ease-snap)" },
          enter: { value: "var(--ease-enter)" },
          spring: { value: "var(--ease-spring)" },
        },
        zIndex: {
          1: { value: "1" },
          10: { value: "10" },
          40: { value: "40" },
          50: { value: "50" },
        },
      },
      // A font size and the line height the utilities paired it with
      textStyles: {
        "2xs": { value: { fontSize: "2xs", lineHeight: "calc(1 / 0.6875)" } },
        xs: { value: { fontSize: "xs", lineHeight: "1rem" } },
        sm: { value: { fontSize: "sm", lineHeight: "1.25rem" } },
        base: { value: { fontSize: "base", lineHeight: "1.5rem" } },
        xl: { value: { fontSize: "xl", lineHeight: "1.75rem" } },
      },
      // The transition every control shares; a change of color runs at the interface's pace
      layerStyles: {
        interactive: {
          value: {
            transition: "colors",
            transitionDuration: "ui",
            transitionTimingFunction: "outExpo",
          },
        },
      },
      keyframes: {
        fadeIn: {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        fadeInDown: {
          from: { opacity: 0, transform: "translateY(-0.5rem)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        fadeInDownSmall: {
          from: { opacity: 0, transform: "translateY(-0.25rem)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        zoomIn: {
          from: { opacity: 0, scale: "0.5" },
          to: { opacity: 1, scale: "1" },
        },
        fadeInUpSmall: {
          from: { opacity: 0, transform: "translateY(0.25rem)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
      },
    },
  },
});

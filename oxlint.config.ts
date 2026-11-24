import { defineConfig } from "oxlint";

export default defineConfig({
  categories: {
    correctness: "error",
    suspicious: "error",
    perf: "error",
  },
  plugins: ["unicorn", "typescript", "oxc", "vitest"],
  jsPlugins: ["oxlint-tailwindcss"],
  settings: {
    tailwindcss: {
      entryPoint: "apps/desktop/src/renderer/app.css",
    },
  },
  rules: {
    // An exhaustive switch over a union ends a function on a path the rule counts as falling off
    // its end, though TypeScript proves that no case is left; `noImplicitReturns` already rejects
    // a function that returns a value on one branch and falls off its end.
    "typescript/consistent-return": "off",
    // A type and a value from the same module may stay apart; two value imports may not
    "no-duplicate-imports": ["error", { allowSeparateTypeImports: true }],
    "unicorn/consistent-function-scoping": "off",
    "tailwindcss/no-conflicting-classes": "error",
    "tailwindcss/no-contradicting-variants": "warn",
    "tailwindcss/no-duplicate-classes": "warn",
    "tailwindcss/no-dynamic-classes": "error",
    "tailwindcss/no-unknown-classes": "error",
    "tailwindcss/enforce-canonical": "warn",
    "tailwindcss/enforce-negative-arbitrary-values": "warn",
    "tailwindcss/no-deprecated-classes": "error",
    "tailwindcss/no-unnecessary-arbitrary-value": "warn",
    "tailwindcss/consistent-variant-order": "warn",
    "tailwindcss/enforce-consistent-important-position": "warn",
    "tailwindcss/enforce-consistent-variable-syntax": "warn",
    "tailwindcss/enforce-shorthand": "warn",
    // Class ordering is handled by oxfmt's sortTailwindcss
    "tailwindcss/enforce-sort-order": "off",
    "tailwindcss/no-unnecessary-whitespace": "warn",
  },
  ignorePatterns: [
    "**/node_modules/**",
    "apps/desktop/out/**",
    "apps/desktop/release/**",
    "packages/*/dist/**",
    // Panda generates them; there is nothing to fix by hand there
    "apps/desktop/src/renderer/styled-system/**",
    "packages/*/src/styled-system/**",
    "plugins/*/dist/**",
  ],
});

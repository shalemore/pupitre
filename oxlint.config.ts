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
      entryPoint: "src/renderer/app.css",
    },
  },
  rules: {
    // An exhaustive switch over a union ends a function on a path the rule counts as falling off
    // its end, though TypeScript proves that no case is left; `noImplicitReturns` already rejects
    // a function that returns a value on one branch and falls off its end.
    "typescript/consistent-return": "off",
    "unicorn/consistent-function-scoping": "off",
    "tailwindcss/enforce-canonical": "warn",
    "tailwindcss/enforce-consistent-variable-syntax": "warn",
    "tailwindcss/no-unknown-classes": "error",
    "tailwindcss/no-conflicting-classes": "error",
    "tailwindcss/enforce-shorthand": "warn",
  },
  ignorePatterns: ["node_modules/**", "out/**", "release/**"],
});

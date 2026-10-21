import { defineConfig } from "oxlint";

export default defineConfig({
  categories: {
    correctness: "error",
    suspicious: "error",
    perf: "error",
  },
  plugins: ["unicorn", "typescript", "oxc"],
  jsPlugins: ["oxlint-tailwindcss"],
  settings: {
    tailwindcss: {
      entryPoint: "src/app.css",
    },
  },
  rules: {
    "unicorn/consistent-function-scoping": "off",
    "tailwindcss/enforce-canonical": "warn",
    "tailwindcss/enforce-consistent-variable-syntax": "warn",
    "tailwindcss/no-unknown-classes": "error",
    "tailwindcss/no-conflicting-classes": "error",
    "tailwindcss/enforce-shorthand": "warn",
  },
  ignorePatterns: [
    "node_modules/**",
    "vendor/**",
    "legacy-iced/**",
    "src-tauri/**",
    "dist/**",
  ],
});

import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/trusted.ts"],
  format: "esm",
  dts: true,
  clean: true,
  // The package is ESM, so `.js` names are enough; the defaults would add `.mjs` and `.d.mts`
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
  // A plugin brings these; the SDK keeps them as imports rather than a second copy
  deps: { neverBundle: ["zod", /^@codemirror\//] },
});

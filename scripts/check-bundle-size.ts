import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Checks the size of the renderer bundle after `npm run build`. Mermaid and MathJax are chunks the
 * app loads when a document needs them, so a change that imports one of them eagerly, or a second
 * copy of a dependency, shows up here as a jump long before a user notices a slow start. The
 * budgets are the 0.7.2 sizes with room for ordinary dependency updates; they are not a target to
 * shrink the bundle to.
 */

const ASSETS = "out/renderer/assets";

/** 15.40 MiB of JavaScript at 0.7.2. */
const TOTAL_BUDGET_BYTES = 17 * 1024 * 1024;

/** The largest chunk was 2.50 MiB (elkjs, which mermaid lays its diagrams out with) and the entry 2.32 MiB. */
const LARGEST_CHUNK_BUDGET_BYTES = 3 * 1024 * 1024;

/** How many of the largest chunks the report lists. */
const LISTED_CHUNKS = 8;

interface Chunk {
  name: string;
  bytes: number;
}

const MIB = 1024 * 1024;

function mib(bytes: number): string {
  return `${(bytes / MIB).toFixed(2)} MiB`;
}

function readChunks(): Chunk[] {
  let names: string[];
  try {
    names = readdirSync(ASSETS);
  } catch {
    console.error(`${ASSETS} is missing: run \`npm run build\` before \`npm run check:bundle\`.`);
    process.exit(1);
  }
  return names
    .filter((name) => name.endsWith(".js"))
    .map((name) => ({ name, bytes: statSync(join(ASSETS, name)).size }));
}

const chunks = readChunks().toSorted((a, b) => b.bytes - a.bytes);
const total = chunks.reduce((sum, chunk) => sum + chunk.bytes, 0);
const largest = chunks[0];

console.log(`${chunks.length} renderer chunks, ${mib(total)} in total`);
console.log(`Largest chunks:`);
for (const chunk of chunks.slice(0, LISTED_CHUNKS)) {
  console.log(`  ${mib(chunk.bytes).padStart(9)}  ${chunk.name}`);
}

const overBudget = [
  ...(total > TOTAL_BUDGET_BYTES
    ? [`The renderer is ${mib(total)}, over the ${mib(TOTAL_BUDGET_BYTES)} budget.`]
    : []),
  ...(largest !== undefined && largest.bytes > LARGEST_CHUNK_BUDGET_BYTES
    ? [
        `${largest.name} is ${mib(largest.bytes)}, over the ${mib(LARGEST_CHUNK_BUDGET_BYTES)} budget for one chunk.`,
      ]
    : []),
];

if (overBudget.length > 0) {
  for (const problem of overBudget) console.error(problem);
  console.error("A dependency that should load on demand was probably bundled eagerly.");
  process.exit(1);
}

console.log(
  `Within the budgets (${mib(TOTAL_BUDGET_BYTES)} total, ${mib(LARGEST_CHUNK_BUDGET_BYTES)} per chunk).`,
);

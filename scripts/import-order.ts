import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Orders the imports of every module in src: `node:` builtins, packages, `@shared/*`, `@/*`, then
 * relative paths, alphabetically inside each group. Imports for their side effects come first, in
 * the order they were written, since that order is the order they run in.
 *
 * `--check` reports the files that need it and exits non-zero, which is what `npm run lint` does;
 * without it the files are rewritten, which is what `npm run fix` does.
 */

const ROOT = "src";
const MODULE = /\.(?:ts|tsx)$/;
const SPECIFIER = /(?:\bfrom\s+|^import\s+)"([^"]+)"/;
const SIDE_EFFECT = /^import\s+"/;

interface ImportChunk {
  /** Comment lines written above the statement, which stay with it. */
  comments: string[];
  statement: string[];
  specifier: string;
  /** The module is imported for what evaluating it does, not for a name it exports. */
  sideEffect: boolean;
}

function sortKey(specifier: string): [group: number, name: string] {
  if (specifier.startsWith("node:")) return [0, specifier];
  if (specifier.startsWith("@shared/")) return [2, specifier];
  if (specifier.startsWith("@/")) return [3, specifier];
  if (specifier.startsWith(".")) return [4, specifier];
  return [1, specifier];
}

function compare(a: string, b: string): number {
  const [groupA, nameA] = sortKey(a);
  const [groupB, nameB] = sortKey(b);
  if (groupA !== groupB) return groupA - groupB;
  if (nameA === nameB) return 0;
  return nameA < nameB ? -1 : 1;
}

function isComment(line: string): boolean {
  const text = line.trim();
  return (
    text.startsWith("//") || text.startsWith("/*") || text.startsWith("*") || text.endsWith("*/")
  );
}

/** The comment lines of a block that may also hold blank lines. */
function commentsOf(pending: string[]): string[] {
  const first = pending.findIndex((line) => line.trim() !== "");
  if (first === -1) return [];
  const last = pending.findLastIndex((line) => line.trim() !== "");
  return pending.slice(first, last + 1);
}

/** The module with its imports ordered, or undefined when it imports nothing. */
function ordered(source: string): string | undefined {
  const lines = source.split("\n");
  const chunks: ImportChunk[] = [];
  let prefix: string[] = [];
  let pending: string[] = [];
  let pendingStart = 0;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line.startsWith("import ")) {
      const statement: string[] = [];
      do {
        statement.push(lines[i] ?? "");
        i += 1;
      } while (i < lines.length && !(statement.at(-1) ?? "").endsWith(";"));
      const text = statement.join("\n");
      const first = chunks.length === 0;
      chunks.push({
        comments: first ? [] : commentsOf(pending),
        statement,
        specifier: SPECIFIER.exec(text)?.[1] ?? "",
        sideEffect: SIDE_EFFECT.test(text),
      });
      // A comment above the first import describes the module, so it stays at the top
      if (first) prefix = pending;
      pending = [];
      pendingStart = i;
      continue;
    }
    if (line.trim() === "" || isComment(line)) {
      if (pending.length === 0) pendingStart = i;
      pending.push(line);
      i += 1;
      continue;
    }
    break;
  }
  if (chunks.length === 0) return undefined;

  const sideEffects = chunks.filter((chunk) => chunk.sideEffect);
  const sorted = chunks
    .filter((chunk) => !chunk.sideEffect)
    .toSorted((a, b) => compare(a.specifier, b.specifier));
  const statements = sideEffects
    .concat(sorted)
    .flatMap((chunk) => chunk.comments.concat(chunk.statement));
  return prefix.concat(statements, lines.slice(pendingStart)).join("\n");
}

function modules(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) return modules(path);
    return MODULE.test(entry.name) ? [path] : [];
  });
}

const check = process.argv.includes("--check");
const changed = modules(ROOT).filter((path) => {
  const source = readFileSync(path, "utf8");
  const next = ordered(source);
  if (next === undefined || next === source) return false;
  if (!check) writeFileSync(path, next);
  return true;
});

if (check && changed.length > 0) {
  for (const path of changed) console.error(`${path}: order the imports`);
  process.exit(1);
}

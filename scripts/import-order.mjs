// @ts-check
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

/** The order a specifier sorts in: its group, then its name. */
function sortKey(specifier) {
  if (specifier.startsWith("node:")) return [0, specifier];
  if (specifier.startsWith("@shared/")) return [2, specifier];
  if (specifier.startsWith("@/")) return [3, specifier];
  if (specifier.startsWith(".")) return [4, specifier];
  return [1, specifier];
}

function compare(a, b) {
  const [groupA, nameA] = sortKey(a);
  const [groupB, nameB] = sortKey(b);
  return groupA - groupB || (nameA < nameB ? -1 : nameA > nameB ? 1 : 0);
}

function isComment(line) {
  const text = line.trim();
  return (
    text.startsWith("//") || text.startsWith("/*") || text.startsWith("*") || text.endsWith("*/")
  );
}

/** Comment lines that sit directly above a statement stay with it. */
function commentsOf(pending) {
  const lines = [...pending];
  while (lines.length > 0 && (lines[0] ?? "").trim() === "") lines.shift();
  while (lines.length > 0 && (lines.at(-1) ?? "").trim() === "") lines.pop();
  return lines;
}

/** The module with its imports ordered, or undefined when it does not start with a comment or import. */
function ordered(source) {
  const lines = source.split("\n");
  /** @type {{ comments: string[], statement: string[], specifier: string, side: boolean }[]} */
  const chunks = [];
  let prefix = [];
  let pending = [];
  let pendingStart = 0;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("import ")) {
      const statement = [];
      do {
        statement.push(lines[i]);
        i += 1;
      } while (!(statement.at(-1) ?? "").endsWith(";"));
      const text = statement.join("\n");
      const first = chunks.length === 0;
      chunks.push({
        comments: first ? [] : commentsOf(pending),
        statement,
        specifier: SPECIFIER.exec(text)?.[1] ?? "",
        side: SIDE_EFFECT.test(text),
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

  const side = chunks.filter((chunk) => chunk.side);
  const sorted = chunks
    .filter((chunk) => !chunk.side)
    .toSorted((a, b) => compare(a.specifier, b.specifier));
  const statements = side.concat(sorted).flatMap((chunk) => chunk.comments.concat(chunk.statement));
  return prefix.concat(statements, lines.slice(pendingStart)).join("\n");
}

function modules(folder) {
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

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pandaConfig from "../panda.config.ts";
import { TOKEN_NAMES } from "../src/shared/design-tokens.ts";

/**
 * Checks the two promises the stylesheets make to themes:
 *
 * 1. A style rule in app.css or editor.css belongs to a cascade layer. Unlayered rules outrank
 *    every layer, so a theme could never override one. The only exceptions are the motion switch,
 *    which must beat utilities and inline transitions alike.
 * 2. A theme only reads tokens that exist. A mistyped `var(--ui-brand-hovr)` is otherwise silent:
 *    the property simply falls back to its initial value.
 *
 * Run by `npm run lint`, so a regression fails before it reaches a release.
 */

const APP_CSS = "src/renderer/app.css";
const EDITOR_CSS = "src/renderer/features/editor/editor.css";
const THEMES = "src/renderer/themes";

/** At-rules that are statements rather than style rules, so they may sit outside a layer. */
const TOP_LEVEL_AT_RULES = ["@import", "@property", "@layer", "@keyframes"];

/** The motion switch is the one rule that has to outrank every layer, `!important` and all. */
const MOTION_RULES = ["@media (prefers-reduced-motion: reduce)", ':root[data-motion="off"]'];

interface Problem {
  file: string;
  line: number;
  message: string;
}

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));
}

/** The style rules that are not inside a `@layer` block. */
function unlayeredRules(css: string): { selector: string; index: number }[] {
  const source = stripComments(css);
  const found: { selector: string; index: number }[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (char === "{") {
      if (depth === 0) {
        const selector = source.slice(start, index).trim().replace(/\s+/g, " ");
        const allowed =
          TOP_LEVEL_AT_RULES.some((rule) => selector.startsWith(rule)) ||
          MOTION_RULES.some((rule) => selector.startsWith(rule));
        if (!allowed) found.push({ selector, index });
      }
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0) start = index + 1;
    }
  }
  return found;
}

function definedTokens(css: string): Set<string> {
  const names = [...stripComments(css).matchAll(/(--[a-z0-9-]+)\s*:/gi)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  );
  return new Set(names);
}

/** Every custom property a value somewhere in an object refers to. */
function referencedTokens(value: unknown, found = new Set<string>()): Set<string> {
  if (typeof value === "string") {
    for (const match of value.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)) {
      if (match[1] !== undefined) found.add(match[1]);
    }
  } else if (Array.isArray(value)) {
    for (const item of value) referencedTokens(item, found);
  } else if (value !== null && typeof value === "object") {
    for (const item of Object.values(value)) referencedTokens(item, found);
  }
  return found;
}

function usedTokens(css: string): Map<string, number> {
  const used = new Map<string, number>();
  const source = stripComments(css);
  for (const match of source.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)) {
    const token = match[1];
    if (token !== undefined) used.set(token, lineOf(source, match.index ?? 0));
  }
  return used;
}

const problems: Problem[] = [];

const app = readFileSync(APP_CSS, "utf8");
const editor = readFileSync(EDITOR_CSS, "utf8");
for (const { file, css } of [
  { file: APP_CSS, css: app },
  { file: EDITOR_CSS, css: editor },
]) {
  for (const rule of unlayeredRules(css)) {
    problems.push({
      file,
      line: lineOf(css, rule.index),
      message: `\`${rule.selector}\` is outside every layer, so no theme can override it`,
    });
  }
}

const baseTokens = definedTokens(app);
const editorTokens = definedTokens(editor);
const known = new Set([...baseTokens, ...editorTokens]);

// A folder without an index.css is not a theme: lib/theme.ts finds a theme by that file, and a
// folder being written may not have one yet
const themeNames = readdirSync(THEMES).filter((name) =>
  existsSync(join(THEMES, name, "index.css")),
);
const themeTokens = new Map(
  themeNames.map((name) => [
    name,
    definedTokens(readFileSync(join(THEMES, name, "index.css"), "utf8")),
  ]),
);

for (const name of themeNames) {
  const file = join(THEMES, name, "index.css");
  const css = readFileSync(file, "utf8");
  const own = new Set([...known, ...(themeTokens.get(name) ?? [])]);
  for (const [token, line] of usedTokens(css)) {
    if (!own.has(token)) {
      problems.push({
        file,
        line,
        message: `\`${token}\` is not defined by the app or by this theme`,
      });
    }
  }
}

// Every token the renderer reads by name is declared, so renaming one in the stylesheets cannot
// leave a silent empty value behind in TypeScript.
const themeKnown = new Set<string>();
for (const tokens of themeTokens.values()) for (const token of tokens) themeKnown.add(token);
for (const token of TOKEN_NAMES) {
  if (token.startsWith("pref-")) continue;
  const name = `--${token}`;
  if (!known.has(name) && !themeKnown.has(name)) {
    problems.push({
      file: "src/shared/design-tokens.ts",
      line: 1,
      message: `\`${name}\` is read from TypeScript but no stylesheet declares it`,
    });
  }
}

// A token the Panda config aliases is declared too: a typo there would silently fall back
for (const token of referencedTokens(pandaConfig.theme.extend?.tokens)) {
  if (!known.has(token)) {
    problems.push({
      file: "panda.config.ts",
      line: 1,
      message: `\`${token}\` is aliased by a Panda token but no stylesheet declares it`,
    });
  }
}

if (problems.length > 0) {
  for (const problem of problems) {
    console.error(`${problem.file}:${problem.line}: ${problem.message}`);
  }
  process.exit(1);
}

console.log("CSS layers and theme tokens are sound.");

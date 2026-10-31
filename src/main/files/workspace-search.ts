import type { Dirent } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type {
  WorkspaceFileMatches,
  WorkspaceMatch,
  WorkspaceSearchOptions,
  WorkspaceSearchResponse,
} from "@shared/desktop-api";
import { nameCollator } from "@shared/name-collator";
import { decodeBestEffort } from "./encoding";
import { isWorkspaceDocument, isWorkspaceFolder, relativeTo } from "./workspace-files";

/**
 * A folder is searched while the user types, so its size must not decide how long the window
 * waits: this many matches over this many files already fill a panel several screens long, and
 * past them the answer is slower rather than more useful. A file above the size limit is not a
 * document anyone reads in a Markdown editor, and reading it would hold up everything after it.
 */
const MAX_MATCHES = 500;
const MAX_FILES = 100;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

/** A word as CodeMirror's own search counts one, so whole-word means the same in both searches. */
const WORD_CHARACTER = /[\p{L}\p{N}_]/u;

/** One search: where it started, what it looks for, and what it has found so far. */
interface Search {
  root: string;
  pattern: RegExp;
  wholeWord: boolean;
  files: WorkspaceFileMatches[];
  matches: number;
}

/** Whether the panel already holds everything it can show. */
function isFull(search: Search): boolean {
  return search.files.length >= MAX_FILES || search.matches >= MAX_MATCHES;
}

/** The query as a global pattern, or undefined when the user wrote a regular expression that is not one. */
function searchPattern(query: string, options: WorkspaceSearchOptions): RegExp | undefined {
  const source = options.regexp ? query : RegExp.escape(query);
  try {
    return new RegExp(source, options.caseSensitive ? "g" : "gi");
  } catch {
    return undefined;
  }
}

/** Whether the character at `index` is part of a word; text outside the line is an edge. */
function isWordCharacter(text: string, index: number): boolean {
  if (index < 0 || index >= text.length) return false;
  return WORD_CHARACTER.test(text.slice(index, index + 1));
}

function isWholeWord(text: string, from: number, to: number): boolean {
  return !isWordCharacter(text, from - 1) && !isWordCharacter(text, to);
}

/**
 * Every match of `pattern` on one line of a file, at most `limit` of them. Lines are matched one
 * at a time so that a row can show the line it belongs to, and so that a match never spans two of
 * them, which is what a list of results can show.
 */
function matchesInText(
  text: string,
  pattern: RegExp,
  wholeWord: boolean,
  limit: number,
): WorkspaceMatch[] {
  const matches: WorkspaceMatch[] = [];
  let line = 1;
  let lineStart = 0;
  while (matches.length < limit) {
    const lineBreak = text.indexOf("\n", lineStart);
    const lineEnd = lineBreak === -1 ? text.length : lineBreak;
    const lineText = text.slice(lineStart, lineEnd);
    for (const match of lineText.matchAll(pattern)) {
      // A pattern that matches no character selects nothing to show or jump to
      if (match[0] === "") continue;
      const from = match.index;
      const to = from + match[0].length;
      if (wholeWord && !isWholeWord(lineText, from, to)) continue;
      matches.push({
        from: lineStart + from,
        to: lineStart + to,
        line,
        text: lineText,
        column: from,
      });
      if (matches.length >= limit) break;
    }
    if (lineBreak === -1) break;
    lineStart = lineBreak + 1;
    line++;
  }
  return matches;
}

/** The text of a document in a folder, or undefined for a file too large to read or not text at all. */
async function readSearchableFile(path: string): Promise<string | undefined> {
  try {
    if ((await stat(path)).size > MAX_FILE_BYTES) return undefined;
    return decodeBestEffort(await readFile(path));
  } catch {
    // A file that cannot be read only costs the matches it could have held
    return undefined;
  }
}

async function searchFile(search: Search, path: string): Promise<void> {
  const text = await readSearchableFile(path);
  if (text === undefined) return;
  const matches = matchesInText(
    text,
    search.pattern,
    search.wholeWord,
    MAX_MATCHES - search.matches,
  );
  if (matches.length === 0) return;
  search.matches += matches.length;
  search.files.push({ path, relative: relativeTo(search.root, path), matches });
}

/**
 * Searches the entries of one folder one after another, in the order a reader sees them and with
 * one document open at a time, whatever the folder holds.
 */
async function searchEntries(
  search: Search,
  folder: string,
  entries: readonly Dirent[],
  index: number,
): Promise<void> {
  const entry = entries[index];
  if (entry === undefined || isFull(search)) return;
  const path = join(folder, entry.name);
  if (isWorkspaceFolder(entry)) await searchFolder(search, path);
  else if (isWorkspaceDocument(entry)) await searchFile(search, path);
  return searchEntries(search, folder, entries, index + 1);
}

async function searchFolder(search: Search, folder: string): Promise<void> {
  // A folder that cannot be read only costs the documents it holds
  const entries = await readdir(folder, { withFileTypes: true }).catch(() => []);
  const ordered = entries.toSorted((a, b) => nameCollator.compare(a.name, b.name));
  return searchEntries(search, folder, ordered, 0);
}

/** Every match of `query` in the documents under `root`, grouped by the file holding them. */
export async function searchWorkspace(
  root: string,
  query: string,
  options: WorkspaceSearchOptions,
): Promise<WorkspaceSearchResponse> {
  if (query === "") return { kind: "ok", files: [] };
  const pattern = searchPattern(query, options);
  if (pattern === undefined) return { kind: "invalid-regexp" };
  const search: Search = {
    root,
    pattern,
    wholeWord: options.wholeWord,
    files: [],
    matches: 0,
  };
  await searchFolder(search, root);
  return { kind: "ok", files: search.files };
}

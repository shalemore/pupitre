import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

/**
 * Builds the large documents the performance notes are measured on from public sources. The
 * sources are downloaded into a folder that is not committed: the Markdown comes from GitHub's
 * documentation (CC BY 4.0), and the prose from Project Gutenberg (public domain in the US).
 *
 * Run `npm run perf:fixtures`, then point the manual probes at `.perf-fixtures/`.
 */

const run = promisify(execFile);
const output = resolve(process.argv[2] ?? ".perf-fixtures");
const sources = join(output, "sources");
const markdownRepository = join(sources, "docs");
const DOCS_URL = "https://github.com/github/docs.git";
const BOOK_URL = "https://www.gutenberg.org/files/2600/2600-0.txt";
const TAIL = "PERF-TAIL-MARKER";

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false,
  );
}

async function git(args: readonly string[], cwd?: string): Promise<string> {
  const { stdout } = await run("git", args, { cwd, maxBuffer: 16 * 1024 * 1024 });
  return stdout.trim();
}

async function markdownFiles(folder: string): Promise<string[]> {
  const entries = await readdir(folder, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => join(entry.parentPath, entry.name))
    .toSorted();
}

async function fetchMarkdown(): Promise<string> {
  if (!(await exists(markdownRepository))) {
    await git([
      "clone",
      "--depth",
      "1",
      "--filter=blob:none",
      "--no-checkout",
      DOCS_URL,
      markdownRepository,
    ]);
  }
  await git(["sparse-checkout", "init", "--no-cone"], markdownRepository);
  await git(["sparse-checkout", "set", "/content/**/*.md"], markdownRepository);
  await git(["checkout"], markdownRepository);

  const files = await markdownFiles(join(markdownRepository, "content"));
  const parts = await Promise.all(
    files.map(
      async (file) =>
        `\n\n<!-- ${file.slice(markdownRepository.length + 1)} -->\n\n${await readFile(file, "utf8")}`,
    ),
  );
  return parts.join("");
}

async function fetchProse(): Promise<string> {
  const response = await fetch(BOOK_URL);
  if (!response.ok) throw new Error(`${BOOK_URL}: ${response.status}`);
  return response.text();
}

function fill(corpus: string, bytes: number): string {
  if (corpus.length === 0) throw new Error("the source text is empty");
  let text = "";
  while (text.length < bytes) text += corpus;
  return `${text.slice(0, bytes)}\n\n${TAIL}\n`;
}

async function main(): Promise<void> {
  await mkdir(sources, { recursive: true });
  const [markdown, prose] = await Promise.all([fetchMarkdown(), fetchProse()]);
  const files = [
    ["markdown-100mb.md", fill(markdown, 100 * 1024 * 1024)],
    ["markdown-200mb.md", fill(markdown, 200 * 1024 * 1024)],
    ["prose-100mb.md", fill(prose, 100 * 1024 * 1024)],
  ] as const;
  await Promise.all(files.map(([name, text]) => writeFile(join(output, name), text)));

  const commit = await git(["rev-parse", "HEAD"], markdownRepository);
  const manifest = {
    generatedAt: new Date().toISOString(),
    tailMarker: TAIL,
    sources: [
      { name: "GitHub docs", url: DOCS_URL, commit, license: "CC BY 4.0" },
      {
        name: "Project Gutenberg, War and Peace",
        url: BOOK_URL,
        license: "Public domain in the US",
      },
    ],
    files: files.map(([name, text]) => ({ name, bytes: Buffer.byteLength(text) })),
  };
  await writeFile(join(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${files.length} documents to ${output}`);
}

await main();

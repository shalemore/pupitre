# Performance

Three measurements sit outside the default checks: the parser benchmark, the end-to-end timings and
the size of the renderer bundle. None of them runs in `npm test` or in the CI test step; the bundle
check is the only one CI runs, right after the build.

## The parser benchmark

```sh
npm run bench
```

Runs `bench/parse.bench.ts` with `vitest.bench.config.ts` in Node, for about a minute, and prints a
Vitest table of every case: the mean, the slowest sample and how many samples were taken. The document is parsed with
`markdownLanguage` from `src/renderer/features/editor/markdown-language.ts`, so the benchmark reads
GFM, front matter, math, footnotes, highlight, emoji and sub/superscript exactly as the editor does.

What it reads:

- **a megabyte of prose** — headings, lists, quotes, a code fence, links, math, footnotes and the
  inline markers, the mix a long note has;
- **a megabyte of tables** — the block the GFM extension adds and a lot of notes are made of;
- **one character typed into the prose** — the previous tree cut with `TreeFragment.applyChanges`,
  which leaves a gap of at least 128 characters around the edit, exactly what the editor's parse
  context hands the parser on a keystroke; everything outside the gap is reused.

It does not measure the editor around the parser: decorations, widgets, the outline or the word
count are not in it. What the live preview costs on top of the parse shows up in the end-to-end
timings below, indirectly, because the app has to draw a document to show it.

## The end-to-end spec

```sh
npm run build
npm run test:perf
```

`npm run test:perf` runs only `e2e/performance.spec.ts`, through `playwright.perf.config.ts`.
`npm run test:e2e` ignores it: it opens documents of megabytes and takes minutes, and what it says
belongs to the machine it ran on.

The script wraps Playwright in `offstage-windows`, which keeps the app's windows off the screen on
Windows — a real one would pop up over whatever else is open — and passes the command through on
macOS and Linux. `OFFSTAGE=0` in the environment puts the windows back on screen for a run you want
to watch. The same command without npm is:

```sh
npx offstage-windows npx playwright test --config=playwright.perf.config.ts
```

What it measures, on the built app:

- the cold start of the app to a new document's `.cm-content`;
- opening a generated 200 KB document up to its last line, then typing 20 characters, timed from
  each `keydown` to the first frame drawn after it, and reported as the median and the p95;
- opening generated 5 MB, 100 MB, 200 MB and 500 MB documents up to a marker on the last line,
  which means the window painted, the main process read the file and the renderer scrolled to the
  end;
- the time until the title bar shows a word count for each of them;
- typing 20 characters at the end of the 5 MB document, and the resident memory of the main
  process after every open;
- typing into the find field on the 100 MB document, then finding the next match.

A test run ends with the measurements as JSON. Its assertions are sanity limits only — 180 s for a
start or an open and 250 ms for the typing p95 — so a run that is merely slow still passes; the
report is the result, not the check mark. The 500 MB document is close to the largest JavaScript
string the renderer can hold (slightly under 512 MiB), which is why the spec stops there.

## Large documents

A few things keep a document of hundreds of megabytes usable, and none of them changes what is
stored on disk:

- **The parser follows the viewport.** CodeMirror parses the visible lines and a window ahead of
  them, and skips the rest until it is scrolled into view. Opening a document never parses all of
  it, and scrolling parses only the part that comes into view.
- **The editor owns the text.** A keystroke marks the tab as changed; the whole text is copied out
  of CodeMirror only when it is needed — on save, on a tab switch, or when the window closes. A
  large document is therefore not turned into a new string on every key.
- **The counts follow the edit, not the document.** Documents up to 512 KB are counted exactly with
  `Intl.Segmenter`. Larger ones are counted in slices without blocking the editor, and their words
  are counted by a linear scanner: `Intl.Segmenter` is native but its dictionary segmentation costs
  about 120 ms per megabyte, while the scanner is a few milliseconds. Above 512 KB the Markdown is
  counted as text rather than through the syntax tree, so markers and link addresses add a small
  amount to the total. The first total of a 200 MB document takes under two seconds; every
  keystroke afterwards recounts only the lines it touched, with no debounce.
- **The outline waits for a pause.** Its first version is collected as the editor opens; while
  typing, later changes are collected 150 ms after the last one, so a list of thousands of rows is
  never rebuilt between two keystrokes.
- **Drafts stop at 8 MB.** A draft copies the recovered text into the profile; above this size the
  document is not drafted at all, not even on close, because writing hundreds of megabytes would
  make quitting as slow as the session it is meant to save. Closing still asks to save a changed
  tab, and auto-save, if it is on, still writes the file itself.

None of these needs WebAssembly, a native addon or a worker: the expensive parts were work done on
the whole document synchronously, not the speed of the code doing it. A worker would add a copy of
the document and another build target without making the first count reach the title bar sooner; a
native scanner would still have to read the same bytes, and `Intl.Segmenter` is already native ICU.
The only change that would make a 200 MB file open appreciably sooner is to show part of it before
the rest has arrived, which would leave a document that cannot be scrolled, searched or saved as a
whole until loading finishes; that changes what the editor guarantees, so it is not done here.
Learned indexes, vector search and CRDTs solve different problems: exact find, local editing and
the file on disk are all served better by the rope and the viewport parser already in use.

## Startup

The window is split so that the welcome screen and the first document do not wait for code they
will not use. The main window stays in the entry, because a file opened at launch is delivered as
a command as soon as the page loads; the settings window, the sample documents and the editor
(CodeMirror) are separate chunks. The editor chunk is fetched in idle time while the welcome
screen is open, and the update check waits four seconds before it uses the network.

Measured by launching the built app on a fresh profile (one 5 MB document for the file case), from
`launch` to the welcome screen or to `.cm-content`:

| Startup                               |           Welcome |       New document |
| :------------------------------------ | ----------------: | -----------------: |
| first launch                          |            0.68 s |             0.97 s |
| second launch, same profile           |            0.63 s |             0.70 s |
| a document passed on the command line | 0.67 s to welcome | 1.00 s to its tail |

The welcome screen paints before the editor chunk is parsed; a new document then loads that chunk,
which is why the gap between the two columns is larger on the first launch. The second launch is
faster because the system has cached the files and Chromium has compiled the page.

## Real-world fixtures

The synthetic documents in the spec are uniform. Two sources exercise the shapes a real file has:
GitHub's documentation is Markdown with front matter, tables, fences, links and HTML, and
_War and Peace_ from Project Gutenberg is long prose. Both are downloaded, never committed:

```sh
npm run perf:fixtures
```

The script writes `markdown-100mb.md`, `markdown-200mb.md` and `prose-100mb.md` to
`.perf-fixtures/`, with a manifest naming the source, its commit and its license. GitHub docs is
CC BY 4.0; the Gutenberg text is public domain in the US. The measurements below are from those
files, opened to the tail on the same machine as the spec; `First screen`, `To the tail` and
`Count` are all measured from launch:

| Real document         | First screen | To the tail |  Count | Typing median / p95 | Find field | Main RSS |
| :-------------------- | -----------: | ----------: | -----: | ------------------: | ---------: | -------: |
| GitHub docs, 100 MB   |       1.81 s |      2.11 s | 3.02 s |          63 / 76 ms |      27 ms |  450 MiB |
| GitHub docs, 200 MB   |       2.55 s |      2.83 s | 5.42 s |          59 / 74 ms |      23 ms |  749 MiB |
| War and Peace, 100 MB |       2.04 s |      2.22 s | 3.85 s |          40 / 49 ms |      23 ms |  647 MiB |

The counts for these files take longer than the 100 MB synthetic one because the Markdown corpus
has more non-ASCII text and more lines to scan; typing and find stay in the same range.

## Bundle size

```sh
npm run build
npm run check:bundle
```

`scripts/check-bundle-size.ts` reads `out/renderer/assets/*.js`, prints the total and the largest
chunks, and fails when a budget is exceeded. The budgets are constants in the script:

- **17 MiB for the renderer JavaScript in total**;
- **3 MiB for any single chunk**.

They sit a little above what 0.7.2 builds (15.53 MiB in total, 2.50 MiB in the largest chunk,
0.77 MiB in the entry) so that ordinary dependency updates fit. The entry shrank when the settings
window, the sample documents and the editor moved into their own chunks; the editor chunk brings
its own CodeMirror and language data only when a document is shown. The check exists to catch a
change that pulls code into the entry which is meant to load on demand — Mermaid and MathJax are
the large ones, and an eager import of either shows up as a chunk growing past the limit. CI runs
the check after `npm run build`.

## Installer size

```sh
npm run dist
```

The Windows x64 NSIS installer of this build is **108 MiB**; the unpacked app is 357 MiB. Two
things are left out of the package: the browser demo in `out/web` (built for GitHub Pages, never
loaded by the desktop app) and the third-party notices that already travel as an extra resource
beside `app.asar`. Chromium's own locales are limited to the languages Pupitre speaks, which takes
the locales folder from 49 MiB to 24 MiB; the installer uses maximum compression.

Most of the remaining size is Electron and Chromium itself — the executable is 239 MiB unpacked,
`icudtl.dat` 11 MiB, the graphics DLLs tens of MiB more. Shrinking the installer by an order of
magnitude would mean replacing Electron with a system-webview shell such as Tauri, which changes
the process model, packaging and several native integrations; that is a rewrite, not a packaging
tweak.

## Baseline

Measured on 2026-10-27 on an AMD Ryzen 7 7840H, 28 GiB, Windows 11 x64, Node 26. These numbers are
this machine's, and neither another machine nor the same machine on another day will reproduce them
closely: use them to see a change against a run of your own, not as a target.

| Parser benchmark (`npm run bench`) |   Mean |
| :--------------------------------- | -----: |
| full parse of 1 MB of prose        | 328 ms |
| full parse of 1 MB of tables       | 231 ms |
| reparse after one typed character  | 4.2 ms |

| End-to-end (`npm run test:perf`) |   Result |
| :------------------------------- | -------: |
| cold start to `.cm-content`      |   1.37 s |
| open 200 KB to the tail          |   1.61 s |
| typing 200 KB, median            |    13 ms |
| typing 200 KB, p95               |    17 ms |
| open 5 MB to the tail            |   1.48 s |
| counts 5 MB, from launch         |   1.51 s |
| typing 5 MB, median              |    42 ms |
| typing 5 MB, p95                 |    51 ms |
| main-process RSS after 5 MB      |  150 MiB |
| open 100 MB to the tail          |   1.63 s |
| counts 100 MB, from launch       |   2.25 s |
| find typing 100 MB, median       |    19 ms |
| find typing 100 MB, p95          |    22 ms |
| find next 100 MB                 |    29 ms |
| main-process RSS after 100 MB    |  349 MiB |
| open 200 MB to the tail          |   1.89 s |
| counts 200 MB, from launch       |   3.77 s |
| main-process RSS after 200 MB    |  548 MiB |
| open 500 MB to the tail          |   3.36 s |
| counts 500 MB, from launch       |   8.07 s |
| main-process RSS after 500 MB    | 1148 MiB |

The count includes the launch and the open: subtracting them leaves about 0.03 s for 5 MB, 0.6 s
for 100 MB, 1.9 s for 200 MB and 4.7 s for 500 MB. That is one scan of the whole document; after
it, a keystroke updates the total from the lines it changed and does not wait for a timer. Find
counts the whole document only for small files now; on a large one it starts a background count
and says `…` until the first thousand matches are known. The end-to-end numbers vary between runs
of the same build: another run spent 1.5 s on the same 200 KB open and measured an 18 ms median
there, and an earlier one measured a 129 ms p95 while the outline was still being built, so compare
runs of the same machine rather than treating a single number as the app's speed.

The bundle of the same build had 251 chunks, 15.53 MiB in total, the largest 2.50 MiB (elkjs, which
Mermaid lays its diagrams out with), and the entry 0.77 MiB.

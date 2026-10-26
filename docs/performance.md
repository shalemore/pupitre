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
- opening a generated 5 MB document and a 20 MB one, up to a marker on the last line, which means
  the window painted, the main process read the file and the renderer scrolled to the end;
- the resident memory of the main process after each of those opens.

A test run ends with the measurements as JSON. Its assertions are sanity limits only — 180 s for a
start or an open and 500 ms for the typing p95 — so a run that is merely slow still passes; the
report is the result, not the check mark.

Typing at the end of the 5 MB document is much slower than in the 200 KB one, hundreds of
milliseconds a keystroke when it was measured, so the spec reads typing on the smaller document and
leaves the large ones to what opening them costs.

## Bundle size

```sh
npm run build
npm run check:bundle
```

`scripts/check-bundle-size.ts` reads `out/renderer/assets/*.js`, prints the total and the largest
chunks, and fails when a budget is exceeded. The budgets are constants in the script:

- **17 MiB for the renderer JavaScript in total**;
- **3 MiB for any single chunk**.

They sit a little above what 0.7.2 builds (15.40 MiB in total, 2.50 MiB in the largest chunk,
2.32 MiB in the entry) so that ordinary dependency updates fit. The check exists to catch a change
that pulls code into the entry which is meant to load on demand — Mermaid and MathJax are the large
ones, and an eager import of either shows up as a chunk growing past the limit. CI runs the check
after `npm run build`.

## Baseline

Measured on 2026-10-26 on an AMD Ryzen 7 7840H, 28 GiB, Windows 11 x64, Node 26. These numbers are
this machine's, and neither another machine nor the same machine on another day will reproduce them
closely: use them to see a change against a run of your own, not as a target.

| Parser benchmark (`npm run bench`) |   Mean |
| :--------------------------------- | -----: |
| full parse of 1 MB of prose        | 418 ms |
| full parse of 1 MB of tables       | 275 ms |
| reparse after one typed character  | 5.5 ms |

| End-to-end (`npm run test:perf`) |  Result |
| :------------------------------- | ------: |
| cold start to `.cm-content`      |  1.96 s |
| open 200 KB to the tail          |  1.84 s |
| typing latency, median           |   50 ms |
| typing latency, p95              |   63 ms |
| open 5 MB to the tail            |  2.14 s |
| main-process RSS after 5 MB      | 148 MiB |
| open 20 MB to the tail           |  1.48 s |
| main-process RSS after 20 MB     | 179 MiB |

The end-to-end numbers vary a lot between runs of the same build: an earlier run on this machine
spent 1.33 s on the cold start, 2.22 s on the 5 MB document and 4.22 s on the 20 MB one, and another
measured a typing p95 of 133 ms. The 20 MB document loading faster than the 5 MB one in the run
above is disk cache and CPU state, not the app.

The bundle of the same build had 212 chunks, 15.40 MiB in total, the largest 2.50 MiB (elkjs, which
Mermaid lays its diagrams out with), and the entry 2.32 MiB.

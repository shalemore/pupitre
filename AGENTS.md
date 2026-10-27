# Pupitre — Agent Guide

Pupitre is a desktop Markdown editor built with Electron, SolidJS, Tailwind CSS 4 and TypeScript.
This file is the single source of project conventions for humans and coding agents.

## Commands

| Command                 | Purpose                                              |
| :---------------------- | :--------------------------------------------------- |
| `npm run dev`           | Start Electron with the Vite dev server (HMR)        |
| `npm run build`         | Bundle main, preload and renderer into `out/`        |
| `npm run check:bundle`  | Fail when a renderer chunk passes its size budget    |
| `npm run dev:web`       | Serve the web demo (renderer on the browser host)    |
| `npm run build:web`     | Build the web demo into `out/web`                    |
| `npm run dist`          | Build and package installers into `release/`         |
| `npm test`              | Run the unit tests (Vitest)                          |
| `npm run test:coverage` | Run the unit tests with coverage and check its floor |
| `npm run test:e2e`      | Drive the built app with Playwright (`build` first)  |
| `npm run test:perf`     | Time the built app by hand, minutes long (`build`)   |
| `npm run bench`         | Benchmark the parser by hand, a minute long          |
| `npm run typecheck`     | Type-check every project (`tsrs -b`)                 |
| `npm run lint`          | Check formatting (oxfmt) and lint (oxlint)           |
| `npm run knip`          | Find dead files, unused exports and dependencies     |
| `npm run fix`           | Apply formatting and safe lint fixes                 |

Before considering a change done, `lint`, `typecheck`, `knip`, `test`, `build` and `check:bundle`
must all pass. Run `npm run test:e2e` as well once the change touches the main process, the IPC
contract or a flow it covers. Keep the coverage floor: it only catches a suite that shrank, and goes
up as more of the app is covered. `bench` and `test:perf` report numbers that belong to the machine
they ran on: run them for a change that could move them, not on every pull request. `test:perf`
wraps itself in `offstage-windows`, so its windows stay off the screen on Windows.

## Tests

- Unit tests sit next to what they test (`*.test.ts`). `vitest.config.ts` runs the main process and
  the shared code in Node, and the renderer in jsdom; the renderer project loads `src/web/host.ts`
  as `window.desktop`, so modules that reach for the host still import. Pure functions are the first
  thing to cover; a test that needs layout or a native dialog belongs in the E2E suite.
- `src/renderer/features/editor/testing.ts` builds the editor's state and tree for tests. A document
  is written with `|` marking the cursor and with two of them around a selection, so the test reads
  the way the text looks in the editor.
- `e2e/` drives the built app (`out/main/index.js`) over Playwright, after `npm run build`. Each
  launch gets its own `--user-data-dir`, so a run does not touch the settings, drafts or lock of a
  dev instance. Send commands through `window.desktop.invoke("app:dispatch", …)`: native menu
  shortcuts do not fire from CDP key events. Native message boxes are stubbed in the main process
  (`answerDialogs`), because a real one would block the run.
- On Linux the E2E suite needs a display: CI runs it under `xvfb-run -a`. On Windows, run it with
  `npx offstage-windows npx playwright test` to keep the windows off the screen.
- `patches/@lezer+markdown+1.8.1.patch` fixes an upstream incremental-parse bug: a block that a
  table ended (a paragraph, a footnote definition, a math block) is reused with its old end when
  the table stops parsing, which splits it in two. `patch-package` applies the patch on install; the
  dependency is pinned to 1.8.1 so the patch and the package cannot drift apart. The property test
  includes tables and `reads a paragraph back together…` fails if the patch stops applying. Remove
  both when the fix is in the version we use.

## Testing the running app

Check UI changes in the real app instead of reasoning about them. `playwright-core` is a dev
dependency (it downloads no browsers) and drives Electron over the Chrome DevTools Protocol, so
nothing touches the system mouse or keyboard. Write throwaway scripts outside the repository, in
the scratchpad, and import `playwright-core` by absolute path or run them from the repository root.

A window takes the focus when it opens, so a plain launch keeps popping up over whatever the user
is doing. Run the launcher on a hidden Windows desktop instead: `npx offstage-windows node
script.mjs`. The script itself does not change, the app renders and screenshots as usual, and its
windows never reach the screen. `OFFSTAGE=0` puts them back on screen for a run you want to watch,
and on macOS or Linux the wrapper only passes the command through. It builds a small helper with
the C# compiler that ships with Windows on first use, so endpoint protection may comment on it.

A full `npm run build` for every tweak is slow and rarely needed. For renderer work, `npm run
dev:web` serves the same renderer with HMR, and the installed Chrome can be driven against it with
`chromium.launch({ channel: "chrome" })`; `npm run typecheck` and `npm run lint` are the quick
checks in between. Build when the main process, the IPC contract or the packaged app is what
changed, and once at the end.

```js
import { _electron as electron } from "playwright-core";

// Run `npm run build` first. A separate user data dir avoids the single-instance lock, so this
// works while the user's own `npm run dev` is open; the last argument is the file to open.
const app = await electron.launch({
  args: [
    "out/main/index.js",
    "--user-data-dir=<temp dir>",
    // A window Chromium believes is covered stops its timers and animations
    "--disable-features=CalculateNativeWinOcclusion",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    "--disable-background-timer-throttling",
    "README.md",
  ],
});
const page = await app.firstWindow();
await page.locator(".cm-content").waitFor();
await page.screenshot({ path: "<temp dir>/shot.png" }); // then look at the image
await app.close();
```

- To attach to a running dev server with HMR instead, start `npx offstage-windows npm run
  dev:debug` (port 9222) and use `chromium.connectOverCDP("http://127.0.0.1:9222")`; it needs the
  user's own dev app closed.
- Main-process state is reachable with `app.evaluate`, the page with `page.evaluate`/locators.
- Native menu shortcuts (`Ctrl+S`, `Ctrl+,`) do not fire from CDP key events. Send the command the
  menu would: `page.evaluate(() => window.desktop.invoke("app:dispatch", { id: "file.save" }))`
  (the ids are `AppCommand` in `shared/desktop-api.ts`).
- Native message boxes block the app and cannot be clicked, so a test would hang. Replace
  `dialog.showMessageBox` in the main process before the step that opens one: record the call and
  return the button to press. File pickers (`showOpenDialog`, `showSaveDialog`) can be stubbed the
  same way.

```js
await app.evaluate(({ dialog }) => {
  globalThis.__dialogs = [];
  dialog.showMessageBox = async (...args) => {
    globalThis.__dialogs.push(args.at(-1).message);
    return { response: 1, checkboxChecked: false }; // index of the button to press
  };
});
// ...later: await app.evaluate(() => globalThis.__dialogs)
```

## Process Layout

```
src/
  main/       Electron main process: windows, menus, dialogs, file IO, settings, updates
  preload/    contextBridge that exposes the typed `window.desktop` API
  shared/     Code used by both sides: IPC contract, settings schema, i18n dictionaries
  renderer/   SolidJS UI (one bundle, the window kind is picked from `location.hash`)
    main.tsx        entry: applies appearance, then renders the window for the hash
    windows/        one top-level component per window (main window, settings window)
    features/<x>/   components, state and helpers used by one feature (editor, outline, …)
    components/     components shared by several features; components/ui holds primitives
    lib/            helpers and state shared across features (desktop API, settings, theme,
                    fonts, text stats, the document session)
    themes/<name>/  theme folders, see "Themes"
web/          the web demo: an index.html and `host.ts`, a browser `window.desktop` (GitHub Pages)
build/        icons and other electron-builder resources
docs/         design notes and mockups
scripts/      helpers for the build and the release, run by node as they are (a .ts file is
              stripped of its types, not compiled)
```

- `src/shared/desktop-api.ts` is the IPC contract. Every channel is declared there once and both
  `ipcMain.handle` and `window.desktop.invoke` are typed from it. Never call `ipcRenderer` or
  Node APIs from the renderer.
- The renderer only talks to its host through `window.desktop`, so another host can run it. The web
  demo (`src/web/host.ts`) keeps files in memory and settings in localStorage; a new channel in
  `InvokeChannels` has to be given a handler there too, which the compiler enforces.
- `lib/document-session.ts` owns the open tabs and the life cycle of the document in each: the
  `savedMarkdown` decides whether a tab is dirty, `diskContent` what the file held when it was last
  read, so a save can tell the file changed elsewhere. The editor only holds the text of the tab on
  show.
- The renderer builds write `THIRD-PARTY-NOTICES.txt` with the license of every package that was
  bundled (`scripts/third-party-notices.ts`); electron-builder ships it in `resources/` and the web
  demo serves it. A license that asks for more than its text gets a note in `NOTES` there.
- The main process owns all privileged work: file system access, native dialogs, menus, the
  settings file and auto updates. The renderer asks for it through IPC.
- `main/history.ts` keeps the version a save overwrites, in a folder of its own under `userData`,
  so that File › Version History can bring one back.
- Windows run with `sandbox: true` and `contextIsolation: true`. External URLs open in the system
  browser through `setWindowOpenHandler`; never load remote content into an app window.
- Settings live in the main process (`settings.json` in `userData`) and are validated with the zod
  schema in `src/shared/settings.ts`. Every window receives the same snapshot through the
  `settings:changed` broadcast, including the window that made the change.
- A folder can have its own settings in `.pupitre/settings.json` (`WORKSPACE_FILE`), in the format
  of the global file. Its values are laid over the global ones key by key, and resetting one in a
  folder gives it back to the global value. Every setting can be given one except `APP_KEYS`,
  which are read before a folder is open or have nothing to do with one. The file is created by the
  first change made while it is in use, never by switching to it. Whatever else a folder gets later,
  such as its own themes, belongs under `.pupitre/` too.

## Code Style

Write code a person can read and navigate in an IDE. Do not trade readability for shortcuts that
only make code generation easier.

- **Keep Tailwind classes where they are used.** Write static class names directly in the JSX
  `class` attribute (string literals inside `cn()` are fine). Do not move them into variables,
  constants, lookup tables or helper functions that return class strings: that breaks
  IntelliSense, sorting and the Tailwind lint rules. Use `class-variance-authority` only for real
  reusable component variants in `components/ui`.
- **Prefer declarative UI.** Build DOM with JSX components rather than `document.createElement`
  chains or HTML strings, except inside third-party extension points that require raw DOM.
- **Avoid indirection that hides intent:** no generic factories, registries or config-driven
  renderers for something that is used once, no stringly-typed dispatch where a typed function
  call works, no deeply nested ternaries for branching UI.
- **Do not reinvent the wheel.** Before writing a utility, check (in order) the platform
  (Electron, DOM, `Intl`, CSS), the existing dependencies, and then mature, maintained libraries.
  Write custom code only when nothing fits, and explain the trade-off in the commit message.
- **Keep it simple (KISS) and do not repeat yourself (DRY).** Extract shared pure functions and
  components once there is a second real use; do not abstract for hypothetical ones.
- **Minimise side effects.** Derive values with plain functions or `createMemo` instead of
  syncing state with `createEffect`. Use effects only to talk to the outside world (DOM APIs,
  IPC, timers) and always clean up listeners.
- **Use the design scales.** Sizes, radii, durations and curves come from the scales documented
  in `app.css` (`text-2xs`…, `rounded-sm`…, `duration-fast`…`duration-slow`, `ease-*`) and
  colors from the semantic tokens; no arbitrary values such as `text-[11px]`, `duration-200` or
  hex colors in components. Build on the `components/ui` primitives (`Button`, `Input`,
  `ListItem`, `SegmentedControl`, `Callout`, `Kbd`, `ScrollView`, …) before styling a raw
  element, and keep one closed border per surface: controls inside a bordered panel use fills.

## TypeScript

- The project extends `@tsconfig/strictest`. Do not weaken it.
- Never use type assertions (`as`) or non-null assertions (`!`) to silence an error. Narrow with
  `typeof`, `in`, discriminated unions or a type predicate instead. A minimal assertion is only
  acceptable when the structure guarantees the type but TypeScript cannot express it; never use
  double assertions.
- Treat external data (files, IPC payloads from other processes, user settings, network) as
  `unknown` and validate it with a zod schema or a type guard.
- Use `import type` for type-only imports and inline `type` for mixed imports.

## Naming and Files

- File and folder names use `kebab-case` (`find-bar.tsx`, `settings-store.ts`). Components are
  `PascalCase`, hooks/primitives are `useXxx`/`createXxx`, constants are `UPPER_SNAKE_CASE`.
- Organise the renderer by feature: `features/<feature>` holds the components, state and helpers
  that only that feature uses. Generic UI primitives live in `components/ui`, cross-feature
  helpers in `lib`. Do not create folders just to group a single file.
- Import internal modules directly. Barrel files (`index.ts`) are only for deliberate public
  boundaries such as `components/ui`.
- Imports are ordered by `scripts/import-order.ts`, which `npm run lint` checks and `npm run fix`
  applies: `node:` builtins, packages, `@shared/*`, `@/*`, then relative paths, alphabetically
  inside each group. Imports for their side effects come first, in the order they run.
- Remove dead code instead of leaving it around "for later".

## Comments and Language

- User-facing text never appears as a literal in components. Add it to every dictionary in
  `src/shared/i18n/locales/` (all locales, typed by `TranslationSchema`). The app is called
  `Pupitre` in every language: the name is never translated, transliterated or spelled in another
  script, whatever grammar does around it. How a dictionary is written, which sources settle a
  term and what not to invent are in `docs/translation-guide.md`.
- The project uses English for code, comments, documentation and commit messages.
- Comments explain _why_ the code is the way it is (constraints, platform quirks, non-obvious
  decisions). Do not write changelog-style comments such as "added X" or "changed Y to Z";
  that belongs in commit messages.
- Commits follow Conventional Commits and are atomic: one logical change per commit. Never
  rewrite commits that have already been pushed.

## Window Chrome

- An immersive window folds its title bar and its sidebars away once the user types or scrolls, and
  unfolds them while the pointer is near the top or near the edge they belong to
  (`lib/immersive-chrome.ts`). Besides the pointer, only a push up at the top of the document
  brings it back, and only once that push covers `PULL_DISTANCE`: scrolling up to the top folds it
  and leaves it there. A window too narrow to leave the document room folds the sidebars as
  well, the outline before the folder, and gives them back when it widens; a pinned sidebar keeps
  its place. Only that module decides this, from the pointer position, the window width and what is
  pinned; a control does not measure the pointer for it.
- The title bar drops its parts as the window narrows rather than letting them wrap: the word
  counts, then the app name, then the menu bar's own items clip. `GIVE_WAY` in
  `components/title-bar.tsx` sets the order and the windows mark those parts with `data-bar-part`;
  a part added to the bar without a mark never gives way.
- A window with one document keeps the menu bar and names the document in the title bar. With
  several, the tabs move into the title bar and the menus fold into one button beside them, so the
  tabs unfold with the bar instead of sitting below it, where reaching for them would unfold it.
- A control that hangs below the title bar and is used with the pointer below the top — the menu
  bar today, a dropdown or a popover on the bar later — has to keep the bar out through
  `titleBarPinned`, and anything hanging out of a sidebar through that sidebar's pin. Such a panel
  sits past the 48 px that count as being near the top, so without the pin the bar folds away under
  the pointer and leaves the panel floating, detached from the button it belongs to.

## Editor

- The editor is [CodeMirror 6](https://codemirror.net) with `@codemirror/lang-markdown`. The
  document is the Markdown text itself: every marker is a real character, copying copies
  Markdown, and files are saved exactly as they were edited. Never add a serializer.
- All syntax comes from one Lezer tree (`@lezer/markdown` with GFM, subscript, superscript and emoji, plus the
  extensions in `front-matter.ts`, `highlight.ts`, `math.ts` and `footnotes.ts`). Support a new syntax by adding a Lezer
  `MarkdownConfig`, then render it with the one rule every construct follows: its markers (or,
  for a rendered block, its source) are hidden unless a selection touches it. Inline syntax and
  line styles live in `features/editor/live-preview.ts`; blocks that replace whole lines (tables,
  math, diagrams, HTML, `<details>`) in `rendered-blocks.ts`, because CodeMirror only takes block
  decorations from a state field. Do not hand-roll Markdown parsing.
- `features/editor/markdown-editor.tsx` owns the `EditorView` and exposes a small imperative
  handle (`getMarkdown`, `replaceDocument`, search, scrolling, formatting, `persistImages`,
  `prepareForPrint`, `toHtml`, `toHtmlFragment`). Formatting commands edit the source text
  (`format-commands.ts`); the Markdown style settings only decide the syntax they insert.
- Styles use cascade layers declared at the top of `app.css`:
  `editor` (editor defaults, `editor.css`) < `document-theme` (the active theme) < `preferences`
  (user font, size, line height and width). CodeMirror's own styles are injected outside any
  layer, so properties the layers must control are handed back with `revert-layer`
  (`layeredStyles` in `markdown-editor.tsx`). Never fight specificity with `!important`; put the rule in the
  right layer instead. The only exception is the global motion switch in `app.css`, which must
  beat utilities, library styles and inline transitions alike.

## Themes

- A theme is a folder `src/renderer/themes/<name>/` with an `index.css`; the folder name is the
  name shown in settings. Fonts or images used by a theme live in the same folder and are
  referenced with relative `url()`s. `themes/pupitre` is the default and documents the contract.
- `lib/theme.ts` discovers themes with `import.meta.glob` and injects the active one into the
  `document-theme` layer at runtime. Every window (main and settings) loads the same theme.
- Themes style the whole app through the `--ui-*` design tokens (surfaces, text, accent) and the
  document through the `md-*` classes inside `.md-document` and `--syntax-*` colors. Document
  lines are spaced with padding, never margins, because CodeMirror measures line boxes.
- Scrolling areas get the `.scroll-fade` class when the Edge Fade setting is on (`app.css` has the
  default look). A theme restyles it with a plain rule: its CSS sits in the `document-theme` layer,
  so it wins over the default without `!important`. Keep the `[data-overflow~="top"]` and
  `[data-overflow~="bottom"]` selectors when setting `--scroll-fade-top` or `--scroll-fade-bottom`,
  so the fade only shows on an edge that has more content.
- A theme declares the color schemes it supports with `color-scheme` on `:root`. A `light dark`
  theme overrides its dark values in `@media (prefers-color-scheme: dark)`; a single-scheme theme
  is applied as is and can be paired with another theme through the `darkTheme` setting.
- Body font size, line height and content width belong to the user. Themes set the default body
  font through `--font-document`, use `em` for sizes inside the document and logical properties
  (`padding-inline-start`) so right-to-left documents mirror correctly.

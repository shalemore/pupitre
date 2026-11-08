# Architecture

Pupitre is one SolidJS bundle in four places: the three parts of an Electron app and, for the browser
demo, a plain web page. [AGENTS.md](../AGENTS.md) has the conventions; this note maps the parts and
the data between them.

## The processes

| Part     | Source                         | What it is                                                               |
| :------- | :----------------------------- | :----------------------------------------------------------------------- |
| Main     | `apps/desktop/src/main/`       | The privileged half: windows, menus, dialogs, files, settings, updates   |
| Preload  | `apps/desktop/src/preload/`    | The only bridge between the other two, exposing `window.desktop`         |
| Renderer | `apps/desktop/src/renderer/`   | The UI of both windows and the editor, one bundle                        |
| Web host | `apps/desktop/src/web/host.ts` | `window.desktop` written for a browser, backing the demo on GitHub Pages |

The main process owns everything privileged: files with their encoding and line endings, drafts and
version history, watched files and folders, settings, the native menu, the spellchecker and auto
updates. A single-instance lock hands a second launch's arguments to the window already open.

The preload script holds no logic: it exposes `window.desktop` through `contextBridge`, forwards a
channel and its arguments and returns the answer, and subscribes the renderer to the events pushed
back. Its initial state is fetched synchronously, so the first paint has the right language.

`apps/desktop/src/renderer/main.tsx` picks the window from `location.hash`: `#settings` renders the settings
window, anything else the document window. Both are the same bundle, theme and settings snapshot.

The web host answers the same `DesktopApi` over memory — documents in the tab, settings in
`localStorage`, the calls a browser cannot serve answered empty — for the demo and the tests, which
load it as `window.desktop`.

## The IPC contract

`packages/desktop-api/src/desktop-api.ts` declares the contract once: `InvokeChannels` for the requests and what
they carry, handled with `ipcMain.handle` in `apps/desktop/src/main/ipc.ts`; `RendererEvents` for what is pushed
back; and `DesktopApi`, the object the preload exposes, typed from both. `window.desktop.invoke` and
`ipcMain.handle` take their types from those declarations, so a channel cannot drift, and a new one
also has to be answered in `apps/desktop/src/web/host.ts`.

The renderer cannot reach Node at all: `sandbox: true`, `contextIsolation: true`, no Node
integration, and the narrow object above is all the page gets. A document is untrusted text, and a
page that could start a process or read a path would turn it into a way into the machine, so
anything touching the disk is a channel and every payload back is data to validate.

## The folder layout

```
apps/desktop/
  src/
    main/        Electron main process: the entry, the IPC hub and the helpers they share
      menus/         the native menus and the About dialog
      files/         opening, reading, watching and writing documents and folders
      windows/       the app's windows, their state, zoom and spellcheck
      document/      the drafts, versions and pins kept for a document
      settings/      the settings file and the themes it lists
      export/        the image and PDF export
      diagnostics/   the log and the issue report
    preload/     contextBridge that exposes the typed `window.desktop` API
    shared/      Code both sides use that is not part of a published contract
    renderer/    SolidJS UI, one bundle for both windows
      windows/       one component per window
      features/<x>/  one feature's components, state and helpers
      components/    what several features share; the primitives come from @pupitre/ui
      lib/           helpers and state shared across features
      lib/document/  the open tabs and the document in each
      themes/<x>/    one folder per theme
    web/         the browser demo: an index.html and its `window.desktop`
  e2e/         Playwright specs, run against the built app
  scripts/     helpers the build and the release run as they are
  bench/       the parser benchmark
  build/       icons and other electron-builder resources
packages/
  desktop-api/   the IPC contract: channels, events, commands and menu descriptors
  i18n/          the locale dictionaries and the translation schema
  settings/      the settings schema, defaults and workspace rules
  markdown/      the Markdown model, its Lezer syntax and the page renderers
  panda-preset/  the tokens, text styles and keyframes both Panda configs read
  utils/         pure helpers for text, HTML, file URLs and colors
  ui/            the Solid primitives, generated from the shared preset
  plugin-sdk/    the contract a plugin author builds against
plugins/
  writing-modes/ focus mode and typewriter mode
  source-mode/   the rendered document: preview, tables, images, widgets
patches/       the pnpm patches applied on install
docs/          these notes and the mockups
```

## The document session

`apps/desktop/src/renderer/lib/document/session.ts` owns the open tabs and the life of the document in each. The
editor is given the text of the tab that is shown and never owns it:

- `markdown` is the text being edited and `savedMarkdown` what the tab last held; the tab is dirty
  while the two differ, which is all "unsaved changes" means.
- `diskContent` is what the file is known to contain; a save raises the same change event as an edit
  made elsewhere, and comparing against it separates the tab's write from someone else's.
- `missingOnDisk` marks a file deleted outside the app: until the tab is saved again its text exists
  nowhere else.
- A draft is the unsaved text of one tab, written by `apps/desktop/src/main/document/drafts.ts` a moment after typing
  stops, so a crash leaves something to offer back.
- `apps/desktop/src/main/document/history.ts` keeps the version a save overwrites, under `userData`: 20 versions per
  document, 200 MB in total, for File › Version History.

Switching tabs rebuilds the `EditorView` around the tab's text rather than replacing that text, and
the tab id the editor carries grows with it, so undo history never crosses into another document.

## One tree, no serializer

The document is the Markdown text itself. `@codemirror/lang-markdown` and the Lezer configurations
in `@pupitre/markdown` — `front-matter.ts`, `math.ts`, `footnotes.ts`, `highlight.ts` — parse
it into a single tree, and a file is saved exactly as it was typed, whatever the editor drew. There
is no serializer, and adding one would make a second source of truth for the document.

Rendering is decorations over that tree. An inline construct hides its markers unless a selection
touches it, in `plugins/source-mode/src/preview/`; a block that replaces whole lines — a table, a
formula, a diagram, HTML — does it from a state field in its `rendered-blocks.ts`, because
CodeMirror takes block decorations from nowhere else. A new syntax is a Lezer `MarkdownConfig` and
a rule over it; the HTML export reads the same source and shares the model in `@pupitre/markdown`,
so it depends on the document rather than on the editor.

## Built-in plugins

Focus mode, typewriter mode and the rendered document are plugins under `plugins/`. Each package
exports a `TrustedPlugin` from `@pupitre/plugin-sdk/trusted`: it is compiled into the app, reads the
app's settings and returns the CodeMirror extensions those settings ask for.
`apps/desktop/src/renderer/plugins/registry.ts` is the only place that lists them and the only place
that knows what they need from the app. A plugin that draws with the app's chrome asks through a
small host interface, such as `plugins/source-mode/src/host.ts`, rather than importing it.

Plugins are leaves like packages: `check:architecture` keeps them from reaching into the app or into
one another, and the app's Panda config scans their source, so the app's stylesheet stays the only
one that defines their classes.

## Themes and settings

A theme is a folder `apps/desktop/src/renderer/themes/<name>/` with an `index.css`, and the folder name is the
name in settings. `apps/desktop/src/renderer/lib/theme.ts` finds them with `import.meta.glob` and injects the
active one into the `document-theme` layer at runtime, so a theme needs no build step. How to write
one is in the `theming-pupitre` skill.

Settings live in the main process, in `settings.json` under `userData`, validated with the zod
schema in `packages/settings/src/settings.ts`. Every window gets the same snapshot through `settings:changed`,
including the window that changed it. An open folder can carry its own `.pupitre/settings.json`,
laid over the global values key by key and written by the first change made while it is open.

## Building, testing, releasing

`pnpm run build` runs electron-vite over three targets into `apps/desktop/out/main`,
`apps/desktop/out/preload` and `apps/desktop/out/renderer`; the renderer configuration is shared with
the demo, which `pnpm run build:web` writes to `apps/desktop/out/web`, and it emits
`THIRD-PARTY-NOTICES.txt` from what it bundled.

`pnpm test` runs the main process and the shared code in Node and the renderer in jsdom, while
`pnpm run test:e2e` drives the built app from `apps/desktop/e2e/`, the only place a native dialog or a real window
is checked. Lint, the CSS and layer-boundary checks, typecheck, knip, the tests, the bundle size
check and both builds run on CI.

A release is a version bump on `main`: `release.yml` builds the three platforms' installers into a
draft release, attests them and publishes. [CONTRIBUTING.md](../CONTRIBUTING.md) has the steps.

## Where to read next

[AGENTS.md](../AGENTS.md) for the conventions; [docs/performance.md](performance.md) for the
benchmark, the timings and the bundle size; [docs/supply-chain.md](supply-chain.md) for the
attestations and the code scanning; [docs/signing.md](signing.md) for signing and the fuses;
[docs/diagnostics.md](diagnostics.md) for the log.

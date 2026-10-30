# Architecture

Pupitre is one SolidJS bundle in four places: the three parts of an Electron app and, for the browser
demo, a plain web page. [AGENTS.md](../AGENTS.md) has the conventions; this note maps the parts and
the data between them.

## The processes

| Part     | Source            | What it is                                                               |
| :------- | :---------------- | :----------------------------------------------------------------------- |
| Main     | `src/main/`       | The privileged half: windows, menus, dialogs, files, settings, updates   |
| Preload  | `src/preload/`    | The only bridge between the other two, exposing `window.desktop`         |
| Renderer | `src/renderer/`   | The UI of both windows and the editor, one bundle                        |
| Web host | `src/web/host.ts` | `window.desktop` written for a browser, backing the demo on GitHub Pages |

The main process owns everything privileged: files with their encoding and line endings, drafts and
version history, watched files and folders, settings, the native menu, the spellchecker and auto
updates. A single-instance lock hands a second launch's arguments to the window already open.

The preload script holds no logic: it exposes `window.desktop` through `contextBridge`, forwards a
channel and its arguments and returns the answer, and subscribes the renderer to the events pushed
back. Its initial state is fetched synchronously, so the first paint has the right language.

`src/renderer/main.tsx` picks the window from `location.hash`: `#settings` renders the settings
window, anything else the document window. Both are the same bundle, theme and settings snapshot.

The web host answers the same `DesktopApi` over memory — documents in the tab, settings in
`localStorage`, the calls a browser cannot serve answered empty — for the demo and the tests, which
load it as `window.desktop`.

## The IPC contract

`src/shared/desktop-api.ts` declares the contract once: `InvokeChannels` for the requests and what
they carry, handled with `ipcMain.handle` in `src/main/ipc.ts`; `RendererEvents` for what is pushed
back; and `DesktopApi`, the object the preload exposes, typed from both. `window.desktop.invoke` and
`ipcMain.handle` take their types from those declarations, so a channel cannot drift, and a new one
also has to be answered in `src/web/host.ts`.

The renderer cannot reach Node at all: `sandbox: true`, `contextIsolation: true`, no Node
integration, and the narrow object above is all the page gets. A document is untrusted text, and a
page that could start a process or read a path would turn it into a way into the machine, so
anything touching the disk is a channel and every payload back is data to validate.

## The folder layout

```
src/
  main/        Electron main process: windows, menus, dialogs, file IO, settings, updates
  preload/     contextBridge that exposes the typed `window.desktop` API
  shared/      Code both sides use: IPC contract, settings schema, i18n dictionaries
  renderer/    SolidJS UI, one bundle for both windows
    windows/       one component per window
    features/<x>/  one feature's components, state and helpers
    components/    what several features share; components/ui holds the primitives
    lib/           helpers and state shared across features
    lib/markdown/  the Markdown model the editor and the export both read
    themes/<x>/    one folder per theme
  web/         the browser demo: an index.html and its `window.desktop`
build/         icons and other electron-builder resources
docs/          these notes and the mockups
scripts/       helpers the build and the release run as they are
e2e/           Playwright specs, run against the built app
```

## The document session

`src/renderer/lib/document-session.ts` owns the open tabs and the life of the document in each. The
editor is given the text of the tab that is shown and never owns it:

- `markdown` is the text being edited and `savedMarkdown` what the tab last held; the tab is dirty
  while the two differ, which is all "unsaved changes" means.
- `diskContent` is what the file is known to contain; a save raises the same change event as an edit
  made elsewhere, and comparing against it separates the tab's write from someone else's.
- `missingOnDisk` marks a file deleted outside the app: until the tab is saved again its text exists
  nowhere else.
- A draft is the unsaved text of one tab, written by `src/main/drafts.ts` a moment after typing
  stops, so a crash leaves something to offer back.
- `src/main/history.ts` keeps the version a save overwrites, under `userData`: 20 versions per
  document, 200 MB in total, for File › Version History.

Switching tabs rebuilds the `EditorView` around the tab's text rather than replacing that text, and
the tab id the editor carries grows with it, so undo history never crosses into another document.

## One tree, no serializer

The document is the Markdown text itself. `@codemirror/lang-markdown` and the Lezer configurations
beside it in `lib/markdown/` — `front-matter.ts`, `math.ts`, `footnotes.ts`, `highlight.ts` — parse
it into a single tree, and a file is saved exactly as it was typed, whatever the editor drew. There
is no serializer, and adding one would make a second source of truth for the document.

Rendering is decorations over that tree. An inline construct hides its markers unless a selection
touches it, in `features/editor/live-preview.ts`; a block that replaces whole lines — a table, a
formula, a diagram, HTML — does it from a state field in `rendered-blocks.ts`, because CodeMirror
takes block decorations from nowhere else. A new syntax is a Lezer `MarkdownConfig` and a rule over
it; the HTML export reads the same source and shares the model in `lib/markdown/`, so it depends on
the document rather than on the editor.

## Themes and settings

A theme is a folder `src/renderer/themes/<name>/` with an `index.css`, and the folder name is the
name in settings. `src/renderer/lib/theme.ts` finds them with `import.meta.glob` and injects the
active one into the `document-theme` layer at runtime, so a theme needs no build step. How to write
one is in the `theming-pupitre` skill.

Settings live in the main process, in `settings.json` under `userData`, validated with the zod
schema in `src/shared/settings.ts`. Every window gets the same snapshot through `settings:changed`,
including the window that changed it. An open folder can carry its own `.pupitre/settings.json`,
laid over the global values key by key and written by the first change made while it is open.

## Building, testing, releasing

`npm run build` runs electron-vite over three targets into `out/main`, `out/preload` and
`out/renderer`; the renderer configuration is shared with the demo, which `npm run build:web` writes
to `out/web`, and it emits `THIRD-PARTY-NOTICES.txt` from what it bundled.

`npm test` runs the main process and the shared code in Node and the renderer in jsdom, while
`npm run test:e2e` drives the built app from `e2e/`, the only place a native dialog or a real window
is checked. Lint, typecheck, knip, the tests, the bundle size check and both builds run on CI.

A release is a version bump on `main`: `release.yml` builds the three platforms' installers into a
draft release, attests them and publishes. [CONTRIBUTING.md](../CONTRIBUTING.md) has the steps.

## Where to read next

[AGENTS.md](../AGENTS.md) for the conventions; [docs/performance.md](performance.md) for the
benchmark, the timings and the bundle size; [docs/supply-chain.md](supply-chain.md) for the
attestations and the code scanning; [docs/signing.md](signing.md) for signing and the fuses;
[docs/diagnostics.md](diagnostics.md) for the log.

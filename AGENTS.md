# Pupitre — Agent Guide

Pupitre is a desktop Markdown editor built with Electron, SolidJS, Tailwind CSS 4 and TypeScript.
This file is the single source of project conventions for humans and coding agents.

## Commands

| Command             | Purpose                                       |
| :------------------ | :-------------------------------------------- |
| `bun run dev`       | Start Electron with the Vite dev server (HMR) |
| `bun run build`     | Bundle main, preload and renderer into `out/` |
| `bun run dist`      | Build and package installers into `release/`  |
| `bun run typecheck` | Type-check every project (`tsc -b`)           |
| `bun run lint`      | Check formatting (oxfmt) and lint (oxlint)    |
| `bun run fix`       | Apply formatting and safe lint fixes          |

Before considering a change done, `lint`, `typecheck` and `build` must all pass.

## Process Layout

```
src/
  main/       Electron main process: windows, menus, dialogs, file IO, settings, updates
  preload/    contextBridge that exposes the typed `window.desktop` API
  shared/     Code used by both sides: IPC contract, settings schema, i18n dictionaries
  renderer/   SolidJS UI (one bundle, the window kind is picked from `location.hash`)
```

- `src/shared/desktop-api.ts` is the IPC contract. Every channel is declared there once and both
  `ipcMain.handle` and `window.desktop.invoke` are typed from it. Never call `ipcRenderer` or
  Node APIs from the renderer.
- The main process owns all privileged work: file system access, native dialogs, menus, the
  settings file and auto updates. The renderer asks for it through IPC.
- Windows run with `sandbox: true` and `contextIsolation: true`. External URLs open in the system
  browser through `setWindowOpenHandler`; never load remote content into an app window.
- Settings live in the main process (`settings.json` in `userData`) and are validated with the zod
  schema in `src/shared/settings.ts`. Every window receives the same snapshot through the
  `settings:changed` broadcast, including the window that made the change.

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
- Remove dead code instead of leaving it around "for later".

## Comments and Language

- User-facing text never appears as a literal in components. Add it to every dictionary in
  `src/shared/i18n/locales/` (all locales, typed by `TranslationSchema`).
- The project uses English for code, comments, documentation and commit messages.
- Comments explain _why_ the code is the way it is (constraints, platform quirks, non-obvious
  decisions). Do not write changelog-style comments such as "added X" or "changed Y to Z";
  that belongs in commit messages.
- Commits follow Conventional Commits and are atomic: one logical change per commit. Never
  rewrite commits that have already been pushed.

## Editor

- The editor is [Milkdown Crepe](https://milkdown.dev) (ProseMirror + remark). Do not hand-roll
  Markdown parsing, rendering or live-preview decorations; configure Crepe features, extend its
  schemas through Milkdown ctx (`editor.config`) or add ProseMirror plugins with `$prose`.
- `features/editor/markdown-editor.tsx` owns the Crepe instance and exposes a small imperative
  handle (`getMarkdown`, search, scrolling). Documents are serialized only when saved, and the
  dirty state compares the serialized Markdown with the last saved version.
- Keep Markdown output stable: serialization options live in one place (`MARKDOWN_STYLE`) and
  schema overrides must round-trip standard Markdown without losing information.
- Styles use cascade layers declared at the top of `app.css`:
  `crepe` (library defaults) < `document-theme` (the active theme) < `preferences` (user font,
  size, line height and width). Never fight specificity with `!important`; put the rule in the
  right layer instead.

## Themes

- A theme is a folder `src/renderer/themes/<name>/` with an `index.css`; the folder name is the
  name shown in settings. Fonts or images used by a theme live in the same folder and are
  referenced with relative `url()`s. `themes/pupitre` is the default and documents the contract.
- `lib/theme.ts` discovers themes with `import.meta.glob` and injects the active one into the
  `document-theme` layer at runtime. Every window (main and settings) loads the same theme.
- Themes style the whole app through the `--ui-*` design tokens (surfaces, text, accent) and the
  document through `.milkdown .ProseMirror` selectors and `--syntax-*` colors. Always provide
  both light values and `@media (prefers-color-scheme: dark)` overrides.
- Font family, body font size, line height and content width belong to the user. Themes may set
  defaults, but sizes inside the document should use `em` so they scale with the user setting.

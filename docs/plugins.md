# Plugins

A plugin is a folder the user installs from the Plugins page. It holds a `manifest.json`, the code
the host runs, and whatever files that code loads. The app never runs a plugin in its own renderer:
each enabled plugin gets a hidden window of its own, without Node, without `window.desktop`, and
with an in-memory session. What it can reach is what its manifest asks for and the user grants.

The contract is `@pupitre/plugin-sdk`. It is small on purpose: a manifest shape, the permission
names, the settings definition and the surface definitions. The runtime that executes a plugin
belongs to the app, so a plugin only ships JavaScript and assets.

## Layout

```
my-plugin/
  manifest.json
  main.js          the module the host runs
  style.css        optional: stylesheet for the document
  background.js    optional: canvas behind the document
  pointer.js       optional: canvas over the window
  icon.png         whatever the module loads
```

Paths in the manifest are relative to the plugin folder and may not leave it. Installation rejects
symbolic links, copies the folder to `userData/plugins/<id>/`, and uninstalling puts it in the
system trash.

## Manifest

```json
{
  "id": "word-count",
  "name": { "en": "Word Count", "zh-CN": "字数统计" },
  "version": "1.0.0",
  "description": { "en": "Counts the words in the open document" },
  "author": "you",
  "license": "MIT",
  "homepage": "https://example.com/word-count",
  "engines": { "pupitre": ">=0.9" },
  "main": "main.js",
  "styles": "style.css",
  "surfaces": { "background": "background.js", "pointer": "pointer.js" },
  "permissions": ["document:read", "notifications", "ui:styles"]
}
```

| Field         | Meaning                                                                                      |
| :------------ | :------------------------------------------------------------------------------------------- |
| `id`          | Names the plugin and its folder. Lowercase letters, digits, dots and hyphens; never changes. |
| `name`        | `LocalizedText`: a string, or English plus any locales the plugin translates.                |
| `version`     | Semantic version. Any version change asks for consent again.                                 |
| `engines`     | Optional; the Pupitre versions the plugin supports, as a semver range.                       |
| `main`        | The classic script the host page loads. Optional for a plugin that only styles.              |
| `styles`      | A CSS file the app injects for the document. Needs `ui:styles`.                              |
| `surfaces`    | The modules drawing the background and the pointer layer.                                    |
| `permissions` | Everything the plugin may reach beyond drawing on its own canvas.                            |

A third-party module is a classic IIFE bundle, not an ES module: the host page loads it with a
`<script>` tag and the bundle calls `definePlugin` (or `defineBackground`/`definePointer`) as it
executes. A typical build is Vite's library mode:

```js
// vite.config.js
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: { entry: "src/main.js", formats: ["iife"], name: "WordCount", fileName: () => "main.js" },
    outDir: "dist",
  },
});
```

The SDK and zod are bundled into that file; the host provides neither.

## A plugin

```js
import { definePlugin, defineSettings } from "@pupitre/plugin-sdk";
import { z } from "zod";

const settings = defineSettings({
  schema: z.object({
    suffix: z.string().default(""),
    notify: z.boolean().default(true),
  }),
  title: { en: "Word Count", "zh-CN": "字数统计" },
  fields: {
    suffix: {
      title: { en: "Suffix", "zh-CN": "后缀" },
      description: { en: "Appended to the count", "zh-CN": "附加在计数后面" },
    },
    notify: { title: { en: "Notify", "zh-CN": "通知" } },
  },
});

export default definePlugin({
  settings,
  commands: [
    {
      id: "count",
      title: { en: "Count Words", "zh-CN": "统计字数" },
      async run(context) {
        const text = await context.document.read();
        const count = text.trim().split(/\s+/u).filter(Boolean).length;
        const suffix = (await context.storage.get("suffix")) ?? "";
        context.notifications.show({ en: `${count} words${suffix}` });
      },
    },
  ],
  async activate(context, values) {
    await context.storage.set("suffix", values.suffix);
  },
});
```

`activate` runs when the plugin starts. A settings change calls `deactivate`, then `activate` with
the new values; disabling the plugin closes its window. Commands appear in the command palette.

The context is the whole runtime API:

| Field           | Methods                           | Permission                           |
| :-------------- | :-------------------------------- | :----------------------------------- |
| `document`      | `read`, `replace`, `insert`       | `document:read` / `document:write`   |
| `document`      | `selection`                       | `editor:selection`                   |
| `editor`        | `scrollToLine`                    | `editor:scroll`                      |
| `clipboard`     | `read`, `write`                   | `clipboard:read` / `clipboard:write` |
| `notifications` | `show`                            | `notifications`                      |
| `storage`       | `get`, `set`, `delete`            | `storage`                            |
| `network`       | `fetch` (HTTPS only, 5 MiB, 10 s) | `network`                            |

Each call is checked in the main process against the sender, the plugin's enabled state and the
granted permissions before it runs. `document.replace` and `document.insert` edit the document
through CodeMirror transactions, so undo keeps working.

## Settings

`defineSettings` takes a zod object, the text around it, and optional titles per field. The host
converts the schema to JSON Schema and the Plugins page draws a form for the fields it can draw:
booleans, numbers, strings and string enums. Everything the user sees for a plugin's settings comes
from the plugin, in its own `LocalizedText`; the app's dictionaries only hold the page around it.

Values live in `userData/plugins/<id>/settings.json`, globally for the user. The host parses them
against the plugin's schema before every `activate`, with the schema's defaults filled in.

## Commands

A command is `{ id, title, run(context) }`. The id is unique inside the plugin; the palette groups
its commands under the plugin's localized name. Commands run in the plugin's hidden window, not in
the window showing the document, and reach the editor only through the `document` and `editor`
brokers.

## Surfaces

A plugin may contribute three kinds of visual surface. All of them are owned by the app: the plugin
supplies a stylesheet or a module, never HTML, and never the page's DOM.

### Styles

```json
{ "styles": "style.css", "permissions": ["ui:styles"] }
```

The stylesheet is wrapped in the `plugin` cascade layer and scoped to `.md-document`, so it can
style the document and nothing around it. The user's preferences sit above that layer and win. A
relative `url()` is inlined as a data URL; the stylesheet is refused if it uses `@import`,
`!important`, `@property`, `expression()` or a URL the host does not inline. Keyframes belong
outside the app's layers, so a plugin that defines one shares its name with the page.

### Background

```json
{
  "surfaces": { "background": "background.js" },
  "permissions": ["ui:background"]
}
```

```js
import { defineBackground } from "@pupitre/plugin-sdk";

defineBackground({
  setup({ canvas, size, theme, onTheme, onResize }) {
    const context = canvas.getContext("2d");
    const draw = () => {
      context.fillStyle = theme().colors.background;
      context.fillRect(0, 0, size().width, size().height);
    };
    draw();
    onTheme(draw);
    onResize(draw);
    return () => {};
  },
});
```

The canvas fills the editor area and sits under the text. The app already sized it for the device
pixel ratio and applies the matching transform, so draw in CSS pixels. `theme()` gives the active
theme's semantic colors and whether motion is reduced.

### Pointer

```json
{
  "surfaces": { "pointer": "pointer.js" },
  "permissions": ["ui:pointer"]
}
```

```js
import { definePointer } from "@pupitre/plugin-sdk";

definePointer({
  setup({ canvas, onPointer }) {
    const context = canvas.getContext("2d");
    onPointer(({ type, x, y }) => {
      if (type !== "move") return;
      context.fillStyle = "rgba(255, 0, 0, 0.5)";
      context.fillRect(x - 2, y - 2, 4, 4);
    });
  },
});
```

The pointer canvas covers the window, sits above the app's content and never takes a pointer event.
The app forwards `move`, `down`, `up` and `leave` samples with CSS pixel coordinates. Drawing is up
to the plugin; the layer is created and destroyed by the app.

Only one enabled plugin draws the background and one draws the pointer layer. Both run in a
sandboxed iframe with `sandbox="allow-scripts"`, without `allow-same-origin`, so the frame is an
opaque origin: it cannot read the window, call `window.desktop`, or reach the network. The app posts
the theme and pointer samples in, and the surface posts `ready` back. A window that has lost focus
or a user who asked for reduced motion still gets the same messages; the plugin decides whether to
animate.

### Turning effects off

The Plugins page has a **Plugin Effects** switch. It removes the plugin stylesheets and both canvas
layers without stopping the plugins: commands, settings and storage keep working. It is the way out
when a plugin's CSS or canvas misbehaves.

## Trusted plugins

The app's own features under `plugins/` are compiled into the app. They export a `TrustedPlugin`
from `@pupitre/plugin-sdk/trusted`, may return CodeMirror extensions, and read the app's settings
directly. They do not go through the sandbox or the permission check: they are part of the app's
source and are reviewed with it. A third-party plugin never gets this entry point.

## Security model

- The plugin host window runs with `sandbox: true`, `contextIsolation: true`, `nodeIntegration:
  false`, `webviewTag: false` and `devTools: false`, in an in-memory session of its own.
- The only API is `window.__pupitre` from `preload/plugin.ts`: `invoke`, `onSettings` and
  `onCommand`. Nothing from `window.desktop` reaches the page.
- Every `invoke` is checked for the sending window, the plugin's enabled state, its manifest and
  the permissions the user granted, and its parameters are validated with zod.
- Network access is HTTPS only, goes through the main process and is capped at 5 MiB per response.
  The plugin page's CSP keeps `connect-src 'none'`.
- Plugin files are served by a custom scheme from the plugin's own session. Every path is resolved
  with `realpath` and must stay inside the plugin folder.
- A plugin's settings and storage are capped (64 KiB of settings, 1 MiB of storage) and live under
  `userData/plugins/<id>/`.

## Limits

This first version installs from a local folder; there is no marketplace, zip import or automatic
update. A plugin cannot add arbitrary UI: side panels, Solid components and status bar items are
not surfaces yet. Plugin settings are per user, not per folder, and a plugin's stylesheet styles the
document only.

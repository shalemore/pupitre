# @pupitre/plugin-sdk

The contract a [Pupitre](https://github.com/shalemore/pupitre) plugin is written against: the
manifest shape, the permission names, settings defined with zod, command and document access, and
the background and pointer surfaces.

```sh
pnpm add @pupitre/plugin-sdk zod
```

A plugin is a folder with a `manifest.json` and an IIFE bundle. The bundle registers its definition
as it loads:

```js
import { definePlugin, defineSettings } from "@pupitre/plugin-sdk";
import { z } from "zod";

export default definePlugin({
  settings: defineSettings({
    schema: z.object({ greeting: z.string().default("Hello") }),
    fields: { greeting: { title: { en: "Greeting" } } },
  }),
  commands: [
    {
      id: "greet",
      title: { en: "Greet" },
      async run(context) {
        const text = await context.document.read();
        context.notifications.show({ en: `${text.length} characters` });
      },
    },
  ],
  async activate() {},
});
```

A stylesheet named by `manifest.styles` reaches the document through the `plugin` cascade layer. A
module named by `manifest.surfaces.background` or `manifest.surfaces.pointer` draws on a canvas the
host owns, through `defineBackground` and `definePointer`.

The full guide — manifest fields, every permission, the runtime API, the surface contexts and the
security model — is in [docs/plugins.md](https://github.com/shalemore/pupitre/blob/main/docs/plugins.md).

`@pupitre/plugin-sdk/trusted` is the entry point for the plugins compiled into Pupitre itself. It
needs `@codemirror/state` and `@codemirror/view`, which are peer dependencies; third-party plugins
never use it.

MIT.

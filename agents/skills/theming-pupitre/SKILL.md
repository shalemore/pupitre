---
name: theming-pupitre
description: How to write a Pupitre theme: where it lives, its color schemes, the tokens and document selectors it can change, custom fonts, the text cursor, floating panels and the barebone starting point. Use when creating or changing a theme's CSS.
---

# Writing a Pupitre theme

A theme is CSS. It styles the window and the document; the user's settings still win over it.

## The folder

- The app reads three places:
  - the built-in `src/renderer/themes/<name>/`;
  - the global themes folder, `themes/` under the app's user data;
  - the open project's `.pupitre/themes/<name>/`.
- The last two are watched while the app runs: adding, changing or removing a folder updates the
  theme list and, when it is the active one, the window, without a restart. A folder that appears
  later is picked up too.
- The folder name is the theme's identity. Two folders with the same name in different places are
  two themes, not one overwriting the other. Settings show a Global or This Folder tag for an
  imported theme, and add the folder after the name when two themes share a name.
- A theme is `index.css` plus an optional `theme.json`. Fonts and images live in the same folder
  and are referenced with relative `url("./…")`s; the app inlines them so the stylesheet still
  works when it is applied outside its folder.
- The build inlines the built-in themes, and the active one is injected into the `document-theme`
  layer at runtime: above the app defaults, below the user's preferences. Every window uses the
  same theme.
- `themes/pupitre` is the default. Start a new theme from `barebone/index.css` next to this skill:
  the app with its own look taken away.
- The bundled themes write colors in OKLCH, but any CSS color works.

## Display name and description

The name shown in settings, and the description kept for later use, come from an optional
`theme.json` next to `index.css`:

```json
{
  "$schema": "../../../../agents/skills/theming-pupitre/theme.schema.json",
  "name": {
    "en-US": "Academic",
    "zh-CN": "学术"
  },
  "description": {
    "en-US": "Serif type, warm paper and centered section titles for long-form writing.",
    "zh-CN": "衬线字体、暖色纸张和居中的章节标题，适合长篇写作。"
  }
}
```

`theme.schema.json`, next to this guide, validates the file. The relative path above works inside
this repository; a theme kept elsewhere can use its raw GitHub URL once the repository is public.

Use the app's locale codes (`src/shared/i18n/types.ts`). A language the theme leaves out falls back
to the app's default locale (`DEFAULT_LOCALE`, currently `en-US`); if that is missing too, the first
text in the file is used. A plain string covers every language. Without `theme.json`, the folder
name is shown. The setting itself stores the folder name, so changing a display name never breaks
a user's choice.

The description follows the same rules. The settings do not show it yet; it is there for a later
theme browser or picker.

The themes shipped in `src/renderer/themes` must name and describe every locale. A theme installed
from outside the app may leave languages out and use the fallback.

## Color schemes

Declare the schemes the theme supports with the standard `color-scheme` property on `:root`:

```css
:root {
  color-scheme: light dark;
  /* light values */
}

@media (prefers-color-scheme: dark) {
  :root {
    /* what differs */
  }
}
```

`light dark` means the theme works in both schemes. A theme that declares only `light` or `dark`
is applied as is, and users can pair it with another theme for the other scheme in settings.

## What a theme controls

### Interface colors — `--ui-*`

- `--ui-surface-0..3`: window chrome (title bar, sidebar), document canvas, cards, popovers.
- `--ui-text-primary`, `--ui-text-secondary`, `--ui-text-muted`.
- `--ui-brand`, `--ui-brand-hover`: the accent used by the caret, links and the current item.
- `--brand-foreground`: text and icons drawn on the accent; set it dark when the accent is light.
- `--ui-danger`, `--ui-success`, `--ui-knob`, `--ui-segmented-thumb`.
- `--ui-selection`: the wash painted over selected text.
- `--ui-field`, `--ui-alpha-1..3`, `--ui-ring-color`: derived values; override only when needed.
- `--color-window-close`: the native close button's hover red.

### Interface shape and type

- `--ui-radius-scale`: multiplies every corner radius (0 gives square corners).
- `--ui-border-width`: the hairlines that separate controls and blocks.
- `--ui-shadow-near`, `--ui-shadow-far`, `--ui-shadow-float`, or a whole recipe
  (`--ui-shadow-sm`, `--ui-shadow-md`, `--ui-shadow-popover`, `--ui-focus-shadow`) when the color
  is not enough.
- `--radius-xs` … `--radius-2xl`: individual corner radii.
- `--text-2xs`, `--text-xs` … `--text-xl`: the type scale. It resizes the whole interface, so change
  it only on purpose.
- `--font-sans` (interface) and `--font-mono` (code).

A theme may add tokens of its own, under its folder name: `--hongxing-band` in `themes/hongxing`.
`npm run check:css` accepts those, the tokens the app declares, `--alert-*`, `--md-*`,
`--font-document` and `--font-display`; anything else fails, so a mistyped `--ui-brandd` cannot
silently do nothing.

### The document — `md-*` inside `.md-document`

- Headings `md-heading`, `md-h1`…`md-h6`; lines and paragraphs; quotes `md-quote`; lists; links
  `md-link`; inline code `md-code`; code blocks `md-code-block`; tables `md-table-view`; images
  `md-image-*`; footnotes; front matter `md-front-matter`; HTML tags shown as source
  `md-html-mark`.
- Document defaults are tokens, so a theme need not restate the rule:
  `--md-page-padding-block`, `--md-link-underline`, `--md-heading-weight`,
  `--md-heading-line-height`, `--md-strong-weight`, `--md-h1-size`…`--md-h6-size`,
  `--md-code-padding`, `--md-code-radius`, `--md-code-block-size`, `--md-table-heading-weight`,
  `--md-footnote-underline-offset`. The `md-*` rules still win over them.
- Code colors: `--syntax-*`.
- Alert colors: `--alert-note`, `--alert-tip`, `--alert-important`, `--alert-warning`,
  `--alert-caution`. Draw a quote bar with `var(--alert-color, <quote color>)` so GitHub alerts
  keep their color.
- Diagram colors: `--diagram-fill`, `--diagram-stroke`, `--diagram-line`, `--diagram-text`,
  `--diagram-accent`.
- `--font-document`: the default body font. Set `--font-stack-intent: mono` when it is monospaced,
  so the user's fallback font sits after the generic families instead of breaking the grid.
- Space lines with padding, never margins: CodeMirror measures line boxes.
- Use `em` inside the document, and logical properties (`padding-inline-start`, not `padding-left`)
  so right-to-left documents mirror correctly.

### The text cursor

`.md-text-cursor` draws the cursor. A theme replaces the whole rule, image and hotspot: a cursor
has no parts to set one by one.

### Scrolling

`.scroll-fade` is added when the Edge Fade setting is on. Keep the `[data-overflow~="top"]` and
`[data-overflow~="bottom"]` selectors when setting `--scroll-fade-top` or `--scroll-fade-bottom`,
so the fade only shows on an edge with more content.

### Widget parts

Components mark their parts with `data-slot` (`select-trigger`, `select-content`,
`combobox-content`, `sheet`, `scroll-thumb`, …), so one part can be restyled without matching
Kobalte's own attributes.

### Floating panels

Dropdowns, menus and sheets share the `.floating-panel` class and its animation: every panel
fades in with a two-pixel rise, the same whichever edge it opens from, and leaves at once, so a
menu swapped for the one beside it never shows next to its successor. A menu that takes another's
place arrives without the rise, through `data-instant`, since replaying it under the pointer reads
as a flicker. A theme that redefines the keyframes keeps the panel's own `translate`, as the
default does, so a centred sheet rises in place instead of sliding in from its uncentred corner.
`[data-menu-panel]` carries the transform origin of the button a menu hangs from, for a theme that
replaces the keyframes with a scale. One rule restyles them all.

## Motion

The document's animations take their length and curve from six token pairs, one for each thing
that moves. They are set with the app's own motion scales, and a theme writes them in its layer,
which sits above the app's, so nothing needs `!important`:

| Token pair                                       | What it times                                  | Default                  |
| :----------------------------------------------- | :--------------------------------------------- | :----------------------- |
| `--motion-enter-duration`, `--motion-enter-ease` | a marker or a quote's bar appearing            | 120ms, `--ease-enter`    |
| `--motion-block-duration`, `--motion-block-ease` | a formula, a diagram or a table arriving       | 200ms, `--ease-enter`    |
| `--motion-line-duration`, `--motion-line-ease`   | a line of a code block growing                 | 120ms, `--ease-out-expo` |
| `--motion-leave-duration`, `--motion-leave-ease` | a block fading out where the text replaced it  | 120ms, `--ease-out-expo` |
| `--motion-fold-duration`, `--motion-fold-ease`   | a details section opening or closing           | 300ms, `--ease-out-expo` |
| `--motion-view-duration`, `--motion-view-ease`   | the window cross-fading a theme or a view swap | 300ms, `--ease-enter`    |

```css
:root {
  --motion-enter-duration: 200ms;
  --motion-fold-ease: cubic-bezier(0.2, 0.8, 0.2, 1);
}
```

The interface's own transitions (menus, hover, the fold gutter, the triangle of a details summary)
keep the app's motion scale, and the user's Animation setting turns everything off above the
theme.

## What to leave alone

- Body font size, line height and content width belong to the user. They are applied above themes.
- `--spacing` scales every padding, gap and control size at once; leave it, like the layout it
  computes.
- Window geometry is not a theme decision: the title bar height is shared with the main process,
  and the sidebar widths, tab layout and icon set belong to the app.
- Do not use `!important`. Put the rule in the theme and let the cascade do its work.

## Custom fonts

```css
@font-face {
  font-family: "Source Serif";
  src: url("./source-serif.woff2") format("woff2");
}

:root {
  --font-document: "Source Serif", serif;
}
```

Check that the font's license allows redistribution. A theme can also point at installed fonts.

## Checking a theme

- `npm run dev:web` serves the renderer with HMR; `npm run dev` opens the app.
- `npm run check:css` fails on a rule outside a cascade layer or a token the app does not define.
- The theme reaches every export: PDF and print use the window's CSS; HTML and PNG build a page
  from the same theme and document rules.

## References

- `barebone/index.css`: the starting point for a new theme.
- `themes/pupitre/index.css`: the default theme, with one comment for each part it styles.

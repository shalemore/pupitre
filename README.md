<p align="center">
  <img src="src/renderer/public/logo.svg" width="96" height="96" alt="Pupitre" />
</p>

<h1 align="center">Pupitre</h1>

A desktop Markdown editor for Windows, macOS and Linux, built with Electron, SolidJS and
[Milkdown](https://milkdown.dev). Documents are plain `.md` files, rendered in place while you
write; the Markdown syntax of the heading or format under the cursor is shown and stays editable.

## Features

- Live rendering of CommonMark and GFM, plus front matter, GitHub alerts, raw HTML (`<kbd>`,
  `<sub>`, `<details>`, ...), math (KaTeX), Mermaid diagrams and footnotes
- Formatting from menus and Typora-style shortcuts; no floating toolbars
- Focus and typewriter writing modes
- Classic and immersive window styles
- Themes as CSS folders, with separate themes for light and dark mode
- Right-to-left and mixed-direction text
- Find and replace, outline, word count, PDF export with the active theme
- Per-setting reset to defaults, 12 interface languages

The in-app guide (Help › Example Markdown Document) shows the supported Markdown and explains writing
themes.

## Development

Requires Node.js 22 or later.

```sh
npm install
npm run dev
```

| Command             | Purpose                                       |
| :------------------ | :-------------------------------------------- |
| `npm run dev`       | Start Electron with the Vite dev server (HMR) |
| `npm run build`     | Bundle main, preload and renderer into `out/` |
| `npm run dist`      | Build and package installers into `release/`  |
| `npm run typecheck` | Type-check every project                      |
| `npm run lint`      | Check formatting and lint                     |
| `npm run fix`       | Apply formatting and safe lint fixes          |

Project conventions are in [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE)

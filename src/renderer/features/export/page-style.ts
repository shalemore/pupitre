import type { AlertType } from "@/features/editor/alerts";
import { toHex } from "@/lib/theme";

/**
 * The stylesheet of an exported page. The app's document CSS cannot be reused: it styles
 * CodeMirror's `.cm-line` elements, while an export is ordinary HTML (`h1`, `p`, `ul`, `pre`).
 * The colors and the typography are read from the theme the window is showing, so an export looks
 * like the page it was made from rather than like a browser default.
 */

/** Whether the theme's canvas is dark, which the page tells the browser for form controls. */
function isDark(hex: string): boolean {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((start) =>
    Number.parseInt(hex.slice(start, start + 2), 16),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
}

/** The colors, fonts and measures of the page, taken from the variables the theme and the settings set. */
function readTokens() {
  const root = getComputedStyle(document.documentElement);
  const raw = (name: string) => root.getPropertyValue(name).trim();
  const hex = (name: string, fallback = "") => toHex(raw(name) || fallback || "#000000");
  return {
    page: hex("--ui-surface-1"),
    card: hex("--ui-surface-0"),
    text: hex("--ui-text-primary"),
    soft: hex("--ui-text-secondary"),
    faint: hex("--ui-text-muted"),
    accent: hex("--ui-brand"),
    danger: hex("--ui-danger"),
    note: hex("--alert-note", raw("--ui-brand")),
    tip: hex("--alert-tip", raw("--ui-success")),
    important: hex("--alert-important", raw("--ui-brand")),
    warning: hex("--alert-warning", raw("--ui-danger")),
    caution: hex("--alert-caution", raw("--ui-danger")),
    bodyFont: raw("--pref-font-family") || raw("--font-document") || "system-ui, sans-serif",
    codeFont: raw("--pref-code-font") || raw("--font-mono") || "ui-monospace, monospace",
    fontSize: raw("--pref-font-size") || "16px",
    lineHeight: raw("--pref-line-height") || "1.7",
    contentWidth: raw("--pref-content-width") || "52rem",
  };
}

/** The colors of the GitHub alerts, each from the theme token of its own name. */
const ALERT_TYPES: readonly AlertType[] = ["note", "tip", "important", "warning", "caution"];

/**
 * The icons of the GitHub alerts, drawn as masks so they take the color of their title, the same
 * paths the document shows in the app.
 */
const ALERT_ICONS: Readonly<Record<AlertType, string>> = {
  note: "%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='M12 16v-4M12 8h.01'/%3E",
  tip: "%3Cpath d='M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5M9 18h6M10 22h4'/%3E",
  important:
    "%3Cpath d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM12 7v2M12 13h.01'/%3E",
  warning:
    "%3Cpath d='m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4M12 17h.01'/%3E",
  caution:
    "%3Cpath d='M12 16h.01M12 8v4M15.312 2a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586l-4.688-4.688A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2z'/%3E",
};

function alertIcon(path: string): string {
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E${path}%3C/svg%3E")`;
}

/** The whole stylesheet of an exported document, as the text of a `<style>` element. */
export function pageStyle(): string {
  const tokens = readTokens();
  return `
:root {
  color-scheme: ${isDark(tokens.page) ? "dark" : "light"};
  --page: ${tokens.page};
  --card: ${tokens.card};
  --text: ${tokens.text};
  --soft: ${tokens.soft};
  --faint: ${tokens.faint};
  --accent: ${tokens.accent};
  --danger: ${tokens.danger};
  --note: ${tokens.note};
  --tip: ${tokens.tip};
  --important: ${tokens.important};
  --warning: ${tokens.warning};
  --caution: ${tokens.caution};
  --hairline: color-mix(in oklab, var(--text) 14%, transparent);
  --hairline-strong: color-mix(in oklab, var(--text) 30%, transparent);
  --accent-line: color-mix(in oklab, var(--accent) 40%, transparent);
  --wash: color-mix(in oklab, var(--accent) 9%, transparent);
  --body-font: ${tokens.bodyFont};
  --code-font: ${tokens.codeFont};
  --page-width: ${tokens.contentWidth};
  font-size: ${tokens.fontSize};
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  -webkit-text-size-adjust: 100%;
}

body {
  margin: 0;
  background: var(--page);
  color: var(--text);
  font-family: var(--body-font);
  font-size: 1rem;
  line-height: ${tokens.lineHeight};
  -webkit-font-smoothing: antialiased;
}

/* The page: one column of text, wide enough to read and narrow enough to scan */
.md-document {
  max-width: var(--page-width);
  margin-inline: auto;
  padding: clamp(1.5rem, 6vw, 4rem) clamp(1.1rem, 5vw, 3.5rem) 6rem;
  overflow-wrap: break-word;
}

.md-document > :first-child {
  margin-block-start: 0;
}

:where(p, ul, ol, dl, blockquote, pre, table, details, figure) {
  margin-block: 0 1.05em;
}

/* Headings */
h1,
h2,
h3,
h4,
h5,
h6 {
  margin-block: 1.7em 0.55em;
  font-weight: 650;
  line-height: 1.25;
}

h1 {
  font-size: 2.05em;
  font-weight: 700;
  letter-spacing: -0.01em;
}

h2 {
  padding-block-end: 0.2em;
  border-block-end: 1px solid var(--accent-line);
  font-size: 1.5em;
}

h3 {
  font-size: 1.25em;
}

h4 {
  font-size: 1.08em;
}

h5,
h6 {
  color: var(--accent);
  font-size: 1em;
}

/* Inline formats */
a {
  color: var(--accent);
  text-decoration: underline;
  text-decoration-color: var(--accent-line);
  text-decoration-thickness: 1px;
  text-underline-offset: 0.18em;
}

a:hover {
  text-decoration-color: currentColor;
}

strong,
b {
  font-weight: 650;
}

del,
s {
  color: var(--faint);
}

mark {
  padding: 0.05em 0.2em;
  border-radius: 3px;
  background: color-mix(in oklab, var(--accent) 24%, transparent);
  color: inherit;
}

kbd {
  padding: 0.1em 0.4em;
  border: 1px solid var(--hairline-strong);
  border-block-end-width: 2px;
  border-radius: 5px;
  background: var(--card);
  font-family: var(--code-font);
  font-size: 0.85em;
}

img {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  vertical-align: bottom;
}

/* Lists; a bullet or a number takes the accent ink, as in the editor */
ul,
ol {
  padding-inline-start: 1.5em;
}

li {
  margin-block: 0.25em;
}

li::marker {
  color: var(--accent);
}

:is(ul, ol) :is(ul, ol) {
  margin-block: 0.35em 0;
}

li > p {
  margin-block: 0 0.5em;
}

/*
 * The checkbox of a task takes the place of the bullet, so the text lines up with the others. It is
 * drawn here rather than by the browser, whose checkbox follows the system color scheme and greys
 * out with its disabled state instead of taking the theme's colors.
 */
li.md-task {
  list-style: none;
}

li.md-task input {
  appearance: none;
  position: relative;
  width: 1em;
  height: 1em;
  margin: 0;
  margin-inline-end: 0.45em;
  vertical-align: -0.1em;
  border: 1px solid var(--hairline-strong);
  border-radius: 3px;
}

li.md-task input:checked {
  border-color: var(--accent);
  background: var(--accent);
}

li.md-task input:checked::after {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--page);
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6 9 17l-5-5'/%3E%3C/svg%3E")
    center / 0.62em no-repeat;
}

li.md-task-checked {
  color: var(--faint);
}

/* Quotes; an alert (> [!NOTE] and the like) colors its bar and its title */
blockquote {
  padding-inline-start: 1em;
  border-inline-start: 3px solid var(--hairline-strong);
  color: var(--soft);
}

blockquote > :last-child {
  margin-block-end: 0;
}

blockquote.md-alert {
  --alert-color: var(--accent);
  --alert-icon: none;
  border-inline-start-color: var(--alert-color);
}

${ALERT_TYPES.map(
  (type) => `blockquote.md-alert[data-alert="${type}"] {
  --alert-color: var(--${type});
  --alert-icon: ${alertIcon(ALERT_ICONS[type])};
}`,
).join("\n\n")}

p.md-alert-title {
  margin-block-end: 0.5em;
  color: var(--alert-color);
  font-weight: 650;
}

p.md-alert-title::before {
  content: "";
  display: inline-block;
  width: 1em;
  height: 1em;
  margin-inline-end: 0.45em;
  vertical-align: -0.125em;
  background: currentColor;
  mask: var(--alert-icon) center / contain no-repeat;
}

hr {
  height: 1px;
  margin-block: 2em;
  border: 0;
  background: var(--hairline-strong);
}

/* Code: a card for a block, a faint wash for what sits in a line */
code,
pre {
  direction: ltr;
  text-align: start;
}

code {
  font-family: var(--code-font);
  font-size: 0.9em;
}

:not(pre) > code {
  padding: 0.12em 0.32em;
  border-radius: 4px;
  background: var(--wash);
}

pre {
  padding: 0.9em 1.1em;
  border: 1px solid var(--hairline);
  border-radius: 10px;
  background: var(--card);
  line-height: 1.55;
  overflow-x: auto;
}

pre code {
  font-size: 0.9em;
}

/* Tables, scrolling sideways when the page is too narrow for their columns */
.md-table-scroll {
  margin-block: 0 1.05em;
  overflow-x: auto;
}

table {
  border-collapse: collapse;
  font-size: 0.95em;
}

th,
td {
  padding: 0.45em 0.85em;
  border: 1px solid var(--hairline);
  text-align: start;
  vertical-align: top;
}

thead th {
  border-block-end: 1.5px solid var(--accent-line);
  background: var(--card);
  font-weight: 650;
}

/* Math and diagrams; MathJax draws its glyphs in currentColor, so they follow the text color */
mjx-container {
  display: inline-block;
  max-width: 100%;
}

mjx-container[display="true"] {
  display: block;
}

.md-math,
.md-math-block,
.md-mermaid {
  direction: ltr;
}

/* A formula or a diagram wider than the page scrolls inside it instead of widening the page */
.md-math-block,
.md-mermaid {
  display: flex;
  justify-content: safe center;
  padding-block: 0.35em;
  overflow-x: auto;
}

.md-math-block svg {
  max-width: none;
}

.md-mermaid svg {
  display: block;
  max-width: 100%;
  height: auto;
}

.md-math-error {
  color: var(--danger);
  font-family: var(--code-font);
  font-size: 0.9em;
}

/* A collapsible section, its content written in Markdown */
details {
  padding-inline: 1em;
  border: 1px solid var(--hairline);
  border-radius: 10px;
}

summary {
  padding-block: 0.5em;
  cursor: pointer;
  font-weight: 650;
}

details[open] > summary {
  margin-block-end: 0.75em;
  border-block-end: 1px solid var(--hairline);
}

details > :last-child {
  margin-block-end: 0.75em;
}

/* Footnotes: references in superscript, definitions gathered at the foot of the page */
sup.md-footnote-ref {
  font-size: 0.75em;
  line-height: 0;
  vertical-align: super;
}

sup.md-footnote-ref a {
  text-decoration: none;
}

.md-footnotes {
  margin-block-start: 3em;
  padding-block-start: 1.2em;
  border-block-start: 1px solid var(--hairline);
  color: var(--soft);
  font-size: 0.9em;
}

.md-footnotes ol {
  padding-inline-start: 1.4em;
}

.md-footnotes li {
  margin-block: 0.4em;
  padding-inline: 0.25em;
}

.md-footnotes li:target {
  border-radius: 4px;
  background: var(--wash);
}

.md-footnote-back {
  text-decoration: none;
}

/* A printed page keeps its blocks whole */
@media print {
  .md-document {
    max-width: none;
    padding: 0;
  }

  h1,
  h2,
  h3,
  h4 {
    break-after: avoid;
  }

  pre,
  table,
  blockquote,
  details,
  img,
  .md-math-block,
  .md-mermaid {
    break-inside: avoid;
  }
}
`.trimStart();
}

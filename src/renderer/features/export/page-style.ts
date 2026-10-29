import type { AlertType } from "@/features/editor/alerts";
import { CODE_COLOR_TOKENS, codeHighlightStyle } from "@/features/editor/code-highlight";
import editorCss from "@/features/editor/editor.css?raw";
import { activeThemeCss, isDarkColor, toHex } from "@/lib/theme";

/**
 * The stylesheet of an exported page. An export is ordinary HTML (`h1`, `p`, `ul`, `pre`), so the
 * document's own line layout does not apply to it; the markup carries the editor's `md-*` classes
 * instead, and the page takes the rules that style those classes: the editor's own and the active
 * theme's, with the tokens resolved from the window. An export then looks like the page it was
 * made from rather than like a browser default.
 */

/** The colors, fonts and measures of the page, taken from the variables the theme and the settings set. */
function readTokens() {
  const root = getComputedStyle(document.documentElement);
  const raw = (name: string) => root.getPropertyValue(name).trim();
  /*
   * A host without a canvas (a test, or a renderer that never draws) still gets a page: a color
   * that cannot be converted stays as the theme wrote it, and CSS reads both forms.
   */
  const hex = (name: string, fallback = "") => {
    const color = raw(name) || fallback || "#000000";
    try {
      return toHex(color);
    } catch {
      return color;
    }
  };
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
    /** The code colors, under the names the highlighter reads them by (code-highlight.ts). */
    syntax: CODE_COLOR_TOKENS.map((token) => ({
      name: `--syntax-${token}`,
      color: hex(`--syntax-${token}`),
    })),
  };
}

/** The colors of the GitHub alerts, each from the theme token of its own name. */
const ALERT_TYPES: readonly AlertType[] = ["note", "tip", "important", "warning", "caution"];

/**
 * The icons of the GitHub alerts, drawn as masks so they take the color of their title, the same
 * paths the document shows in the app.
 */
const ALERT_ICONS: Readonly<Record<AlertType, string>> = {
  note: "<circle cx='12' cy='12' r='10'/><path d='M12 16v-4M12 8h.01'/>",
  tip: "<path d='M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5M9 18h6M10 22h4'/>",
  important:
    "<path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM12 7v2M12 13h.01'/>",
  warning:
    "<path d='m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4M12 17h.01'/>",
  caution:
    "<path d='M12 16h.01M12 8v4M15.312 2a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586l-4.688-4.688A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2z'/>",
};

function alertIcon(path: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>${path}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** The custom properties the editor and a theme read; a theme's own tokens come with its CSS. */
const TOKEN_NAME = /^--(?:ui|md|font|radius|syntax|alert|diagram|shadow|brand)-/;

/** The rules the exported markup can use, which all carry the `md-` classes the editor renders with. */
const MD_SELECTOR = /\.md-/;

/** The custom properties a computed style carries, when they are ones the document rules read. */
function customPropertyNames(style: CSSStyleDeclaration): Set<string> {
  const names = new Set<string>();
  for (let index = 0; index < style.length; index++) {
    const name = style.item(index);
    if (TOKEN_NAME.test(name)) names.add(name);
  }
  return names;
}

/**
 * The tokens as the window resolved them, including the theme and the color scheme in use. The
 * export has no theme of its own, so it carries these values rather than the layers that derive
 * them; a name with no value is one no rule of the page reads.
 */
function themeVariables(): string {
  const root = getComputedStyle(document.documentElement);
  const pageElement = document.querySelector(".md-document");
  const page = pageElement === null ? undefined : getComputedStyle(pageElement);
  const names = customPropertyNames(root);
  if (page) for (const name of customPropertyNames(page)) names.add(name);
  const declarations: string[] = [];
  for (const name of names) {
    // The --md-* indents live on the document element rather than on the root
    const value = root.getPropertyValue(name).trim() || page?.getPropertyValue(name).trim() || "";
    if (value !== "") declarations.push(`  ${name}: ${value};`);
  }
  return declarations.join("\n");
}

/** The rules of a stylesheet list that an exported element can match, wrapped as they were. */
function mdRules(rules: CSSRuleList): string {
  const parts: string[] = [];
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      if (MD_SELECTOR.test(rule.selectorText)) parts.push(rule.cssText);
    } else if (rule instanceof CSSMediaRule) {
      const inner = mdRules(rule.cssRules);
      if (inner !== "") parts.push(`@media ${rule.conditionText} {\n${inner}\n}`);
    } else if (rule instanceof CSSSupportsRule) {
      const inner = mdRules(rule.cssRules);
      if (inner !== "") parts.push(`@supports ${rule.conditionText} {\n${inner}\n}`);
    }
  }
  return parts.join("\n");
}

/** The rules of a stylesheet list that belong to the editor layer and can match exported markup. */
function editorRules(rules: CSSRuleList): string {
  const layers: string[] = [];
  const visit = (list: CSSRuleList): void => {
    for (const rule of Array.from(list)) {
      if (rule instanceof CSSLayerBlockRule) {
        if (rule.name === "editor") layers.push(mdRules(rule.cssRules));
        else visit(rule.cssRules);
      } else if (rule instanceof CSSGroupingRule) {
        visit(rule.cssRules);
      }
    }
  };
  visit(rules);
  return layers.filter((layer) => layer !== "").join("\n");
}

/**
 * The editor-layer rules the exported markup needs: the layout of a quote, a marker, a code card
 * or a table sits there, not in the theme, so a theme alone would not draw them. They are parsed
 * from the editor's own text rather than read from the window, because a packaged app loads its
 * stylesheet from a file and the CSSOM of such a sheet cannot be read.
 */
function editorStyle(): string {
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(editorCss);
    return editorRules(sheet.cssRules);
  } catch {
    // Without the editor layer the page falls back to the defaults written here
    return "";
  }
}

/**
 * The active theme's CSS, with its color-scheme queries settled for the scheme of the exported
 * page: a file opened elsewhere has no way to know the Color Scheme the app is set to.
 */
function themeRules(dark: boolean): string {
  const css = activeThemeCss();
  if (css === "") return "";
  return css.replace(
    /@media\s*\(\s*prefers-color-scheme:\s*(dark|light)\s*\)/gi,
    (_query, scheme: string) =>
      (scheme.toLowerCase() === "dark") === dark ? "@media all" : "@media not all",
  );
}

/** The whole stylesheet of an exported document, as the text of a `<style>` element. */
export function pageStyle(): string {
  const tokens = readTokens();
  const dark = isDarkColor(tokens.page);
  const theme = themeRules(dark);
  const editor = editorStyle();
  return `
@layer export-base, editor, document-theme, export-page;

@layer export-base {
:root {
  color-scheme: ${dark ? "dark" : "light"};
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
${tokens.syntax.map((syntax) => `  ${syntax.name}: ${syntax.color};`).join("\n")}
${themeVariables()}
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

/*
 * The defaults the editor layer gives the document. The exported markup carries the editor's
 * classes, so its quote bar, marker indent and quote indent are custom properties here too; the
 * editor layer, where this window exposes it, replaces these with the same values.
 */
.md-document {
  --md-quote-indent: 1em;
  --md-quote-bar: var(--alert-color, var(--hairline-strong));
  --md-quote-bar-width: 3px;
  --md-list-indent: 1.6em;
  --md-block-indent: 0px;
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
  font-weight: var(--md-heading-weight, 650);
  line-height: var(--md-heading-line-height, 1.25);
  text-wrap: balance;
}

p,
li,
dd,
blockquote {
  text-wrap: pretty;
}

h1 {
  font-size: 2.05em;
  font-weight: var(--md-heading-weight, 650);
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
  font-weight: var(--md-strong-weight, 650);
}

del,
s {
  color: var(--faint);
}

mark {
  padding: 0.05em 0.2em;
  border-radius: var(--radius-xs);
  background: var(--md-highlight, color-mix(in oklab, var(--accent) 24%, transparent));
  color: inherit;
}

kbd {
  padding: 0.1em 0.4em;
  border: 1px solid var(--hairline-strong);
  border-block-end-width: 2px;
  border-radius: var(--radius-sm);
  background: var(--card);
  font-family: var(--code-font);
  font-size: 0.85em;
}

img {
  max-width: 100%;
  height: auto;
  border-radius: var(--md-image-radius, 0);
  vertical-align: bottom;
}

/* A picture sharing its line is inline, as in the editor, and takes no rounded corners */
img[data-inline] {
  border-radius: 0;
}

/*
 * Lists. A marked-up page draws the bullet or the number itself, with the same span the editor
 * uses, so a theme's marker shape and color reach it; a fragment for another application keeps the
 * browser's own markers, since no stylesheet follows it there.
 */
ul,
ol {
  padding-inline-start: var(--md-list-indent, 1.5em);
}

li {
  margin-block: 0.25em;
}

li::marker {
  color: var(--accent);
}

.md-list-item {
  list-style: none;
  text-indent: calc(-1 * var(--md-list-indent, 1.6em));
}

.md-list-bullet,
.md-list-mark {
  display: inline-block;
  min-width: var(--md-list-indent, 1.6em);
  text-indent: 0;
  color: var(--accent);
}

.md-list-bullet::before {
  content: "•";
}

[data-list-depth="2"] .md-list-bullet::before {
  content: "◦";
}

[data-list-depth="3"] .md-list-bullet::before {
  content: "▪";
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
  border-radius: var(--radius-xs);
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
  --md-quote-bar: var(--alert-color);
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
  font-weight: var(--md-strong-weight, 650);
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

/*
 * A rule on the page is a line like the others, and a theme paints it with a background as tall
 * as its own motif; give it a line's height so that motif is not clipped to the base line.
 */
hr.md-hr {
  height: 1.5em;
  background: linear-gradient(var(--hairline-strong), var(--hairline-strong)) center / 100% 1px
    no-repeat;
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
  border-radius: var(--md-code-radius, var(--radius-xs));
  background: var(--wash);
}

pre {
  padding: 0.9em 1.1em;
  border: 1px solid var(--hairline);
  border-radius: var(--radius-lg);
  background: var(--card);
  font-size: 0.9em;
  line-height: 1.55;
  overflow-x: auto;
}

/* The block sets the size of its code; a second reduction would make the text smaller than the editor's */
pre code {
  font-size: inherit;
}

/*
 * The colors of a highlighted code block: the classes the editor's highlighter puts on its tokens,
 * in the editor's own rules (code-highlight.ts), which read the --syntax-* colors above.
 */
${codeHighlightStyle.module?.getRules() ?? ""}

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
  font-weight: var(--md-table-heading-weight, 650);
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
  border-radius: var(--radius-lg);
}

summary {
  padding-block: 0.5em;
  cursor: pointer;
  font-weight: var(--md-strong-weight, 650);
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
  text-decoration: underline;
  text-underline-offset: 0.15em;
}

sup.md-footnote-ref::before {
  content: "[";
}

sup.md-footnote-ref::after {
  content: "]";
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
  border-radius: var(--radius-sm);
  background: var(--wash);
}

.md-footnote-back {
  text-decoration: none;
}

/* A printed page keeps its blocks whole */
@media print {
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
}
${theme}
${editor === "" ? "" : `@layer editor {\n${editor}\n}`}
@layer export-page {
:root {
  color-scheme: ${dark ? "dark" : "light"};
}

/* The page: one column of text, wide enough to read and narrow enough to scan */
.md-document {
  max-width: var(--page-width);
  margin-inline: auto;
  padding: clamp(1.5rem, 6vw, 4rem) clamp(1.1rem, 5vw, 3.5rem) 6rem;
}

/*
 * The editor draws a code block as a card around its lines; an exported block is the card itself,
 * so it keeps the room its lines would have had instead of the editor's line padding.
 */
.md-code-block {
  padding: 0.9em 1.1em;
}

@media print {
  .md-document {
    max-width: none;
    padding: 0;
  }
}
}
`.trimStart();
}

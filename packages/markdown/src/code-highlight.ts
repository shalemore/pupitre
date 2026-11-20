import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

/**
 * Highlighting of the languages inside code blocks. It only references CSS variables; the colors
 * come from the theme's `--syntax-*`, so nothing needs rebuilding when the theme or color scheme
 * changes. Markdown's own tags (headings, emphasis, links) are left out on purpose: the document
 * itself is styled by the live preview (live-preview.ts), not by syntax highlighting.
 */
export const codeHighlightStyle = HighlightStyle.define([
  { tag: [tags.keyword, tags.controlKeyword, tags.moduleKeyword], color: "var(--syntax-keyword)" },
  { tag: tags.operatorKeyword, color: "var(--syntax-keyword)" },
  { tag: [tags.string, tags.regexp], color: "var(--syntax-string)" },
  { tag: tags.special(tags.string), color: "var(--syntax-special-string)" },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], color: "var(--syntax-number)" },
  { tag: tags.variableName, color: "var(--syntax-variable)" },
  { tag: tags.definition(tags.variableName), color: "var(--syntax-definition)" },
  { tag: tags.function(tags.variableName), color: "var(--syntax-function)" },
  { tag: [tags.typeName, tags.className, tags.namespace], color: "var(--syntax-type)" },
  { tag: [tags.propertyName, tags.attributeName], color: "var(--syntax-property)" },
  { tag: tags.tagName, color: "var(--syntax-keyword)" },
  { tag: [tags.comment, tags.meta], color: "var(--syntax-comment)", fontStyle: "italic" },
  // Markdown markers are tagged processingInstruction, a kind of meta; the live preview styles them
  { tag: tags.processingInstruction, color: "inherit", fontStyle: "inherit" },
  { tag: tags.operator, color: "var(--syntax-operator)" },
  { tag: tags.punctuation, color: "var(--syntax-punctuation)" },
  { tag: tags.invalid, color: "var(--syntax-invalid)" },
]);

/**
 * The theme tokens the style reads, by the end of their names. An exported page carries no theme
 * of its own, so its stylesheet sets them from the window that wrote it (see page-style.ts): a
 * color a token holds has to be listed here to reach the page.
 */
export const CODE_COLOR_TOKENS: readonly string[] = [
  "keyword",
  "string",
  "special-string",
  "number",
  "variable",
  "definition",
  "function",
  "type",
  "property",
  "comment",
  "operator",
  "punctuation",
  "invalid",
];

/** The editor extension that colors a code block by the style above. */
export const codeHighlight = syntaxHighlighting(codeHighlightStyle);

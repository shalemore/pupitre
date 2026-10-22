import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

/**
 * Code block highlighting only references CSS variables; the colors come from the theme's `--syntax-*`,
 * so CodeMirror does not need rebuilding when the theme or color scheme changes.
 */
const highlightStyle = HighlightStyle.define([
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
  { tag: tags.operator, color: "var(--syntax-operator)" },
  { tag: tags.punctuation, color: "var(--syntax-punctuation)" },
  { tag: tags.heading, color: "var(--syntax-keyword)", fontWeight: "600" },
  { tag: tags.strong, fontWeight: "600" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.link, color: "var(--syntax-string)", textDecoration: "underline" },
  { tag: tags.invalid, color: "var(--syntax-invalid)" },
]);

// CodeMirror's built-in styles are in no style layer and would beat the theme, so the editor's appearance is declared here with CSS variables too
const editorChrome = EditorView.theme({
  "&": { backgroundColor: "transparent", color: "var(--syntax-variable)" },
  ".cm-gutters": {
    backgroundColor: "transparent",
    border: "none",
    color: "var(--ui-text-muted)",
  },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "var(--ui-alpha-1)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "oklch(from var(--ui-brand) l c h / 25%)",
  },
  ".cm-cursor": { borderLeftColor: "var(--ui-brand)" },
});

export const codeHighlight: Extension = [syntaxHighlighting(highlightStyle), editorChrome];

import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

/**
 * Universal Lezer HighlightStyle driven entirely by CSS custom properties.
 * All theme token colors are defined in src/themes/editor.css, enabling
 * instantaneous dark/light mode switching and full CSS customization.
 */
export const cssDrivenHighlightStyle = HighlightStyle.define([
  { tag: t.heading, fontWeight: "600", color: "var(--editor-heading-color)" },
  { tag: t.strong, fontWeight: "600", color: "var(--editor-heading-color)" },
  { tag: t.emphasis, fontStyle: "italic", color: "var(--editor-text)" },
  { tag: t.strikethrough, textDecoration: "line-through", color: "var(--editor-text-muted)" },
  { tag: t.link, color: "var(--editor-link-color)", textDecoration: "underline" },
  { tag: t.url, color: "var(--editor-link-color)" },

  { tag: t.keyword, color: "var(--syntax-keyword)", fontWeight: "600" },
  { tag: t.controlKeyword, color: "var(--syntax-keyword)", fontWeight: "600" },
  { tag: t.operatorKeyword, color: "var(--syntax-keyword)" },
  { tag: t.string, color: "var(--syntax-string)" },
  { tag: t.special(t.string), color: "var(--syntax-special-string)" },
  { tag: t.number, color: "var(--syntax-number)" },
  { tag: t.bool, color: "var(--syntax-number)" },
  { tag: t.variableName, color: "var(--syntax-variable)" },
  { tag: t.definition(t.variableName), color: "var(--syntax-definition)" },
  { tag: t.function(t.variableName), color: "var(--syntax-function)" },
  { tag: t.typeName, color: "var(--syntax-type)", fontWeight: "600" },
  { tag: t.className, color: "var(--syntax-type)" },
  { tag: t.propertyName, color: "var(--syntax-property)" },
  { tag: t.attributeName, color: "var(--syntax-property)" },
  { tag: t.comment, color: "var(--syntax-comment)", fontStyle: "italic" },
  { tag: t.meta, color: "var(--syntax-comment)" },
  { tag: t.operator, color: "var(--syntax-operator)" },
  { tag: t.punctuation, color: "var(--syntax-punctuation)" },
]);

export const editorCursorTheme = EditorView.theme({
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "var(--editor-cursor)",
    borderLeftWidth: "2.5px",
  },
  "& .cm-dropCursor": {
    borderLeftColor: "var(--editor-cursor)",
    borderLeftWidth: "2.5px",
  },
  ".cm-content": {
    caretColor: "var(--editor-cursor)",
  },
});

export function getThemeExtension(): Extension {
  return [syntaxHighlighting(cssDrivenHighlightStyle), editorCursorTheme];
}

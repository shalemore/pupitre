import { foldGutter, HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { ChevronDown, ChevronRight } from "lucide-solid";
import { createComponent } from "solid-js";
import { render } from "solid-js/web";

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

// The fold gutter that comes with Crepe's basicSetup draws text glyphs and cannot be configured, so a second one with
// icon markers is added and the first one is hidden (only the gutter containing `.cm-fold-icon` stays visible)
const foldIcons = foldGutter({
  markerDOM: (open) => {
    const marker = document.createElement("span");
    marker.className = "cm-fold-icon";
    render(() => createComponent(open ? ChevronDown : ChevronRight, { size: 14 }), marker);
    return marker;
  },
});

// CodeMirror's built-in styles are in no style layer and would beat the theme, so the editor's appearance is declared here with CSS variables too
const editorChrome = EditorView.theme({
  "&": { backgroundColor: "transparent", color: "var(--syntax-variable)" },
  // CodeMirror's `.cm-gutter` forces `display: flex !important`, so the built-in gutter is collapsed instead of hidden
  ".cm-foldGutter:not(:has(.cm-fold-icon))": { width: 0, overflow: "hidden" },
  ".cm-foldGutter span": {
    display: "flex",
    height: "100%",
    alignItems: "center",
    cursor: "pointer",
  },
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

export const codeHighlight: Extension = [
  syntaxHighlighting(highlightStyle),
  foldIcons,
  editorChrome,
];

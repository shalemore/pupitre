import { EditorView } from "@codemirror/view";
import { css } from "@/styled-system/css";

export const scrollArea = css({
  width: "full",
  height: "full",
  overflowX: "hidden",
  _print: { height: "auto", overflow: "visible" },
});

/**
 * CodeMirror injects its base styles outside every cascade layer, where they would beat the editor
 * layer, the theme and the preferences alike. `revert-layer` hands these properties back to the
 * layers (app.css), so the document is styled by CSS like the rest of the app.
 */
export const layeredStyles = EditorView.theme({
  "&.cm-focused": { outline: "revert-layer" },
  ".cm-scroller": {
    fontFamily: "revert-layer",
    lineHeight: "revert-layer",
    overflowX: "revert-layer",
  },
  "&.cm-editor .cm-content": {
    boxSizing: "revert-layer",
    margin: "revert-layer",
    padding: "revert-layer",
    caretColor: "revert-layer",
  },
  ".cm-placeholder": { color: "revert-layer" },
  // A hidden heading marker is a zero-width replacement; the buffer CodeMirror puts there is 1em
  // tall, which would make the line grow when the marker shows or hides
  ".md-heading .cm-widgetBuffer": { height: "0px" },
  // The fold gutter is not a column of its own (editor.css), so it wears neither of CodeMirror's
  // color schemes: its surface comes from the layers, where a theme can give it one
  "&.cm-editor .cm-gutters": {
    backgroundColor: "revert-layer",
    color: "revert-layer",
    border: "revert-layer",
  },
  ".cm-line": { padding: "revert-layer" },
  // A rendering fills the top of a code card, and a picture the top of the line its source stands
  // in (editor.css), so the buffers that stand around the widget would leave a line box above it
  ".cm-line:is(.md-code-render, .md-image-source) > .cm-widgetBuffer": { display: "revert-layer" },
  "&.cm-editor .cm-searchMatch, &.cm-editor .cm-searchMatch-selected": {
    backgroundColor: "revert-layer",
  },
  // The search panel only switches match highlighting on; the find bar is the app's own
  ".cm-panels": { display: "none" },
});

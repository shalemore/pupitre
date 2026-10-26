import { codeFolding, foldCode, foldGutter, unfoldCode } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import type { KeyBinding } from "@codemirror/view";

/** The words a fold is announced with: the marker in the gutter and the placeholder it leaves. */
export interface FoldLabels {
  fold: string;
  unfold: string;
  foldedText: string;
}

function foldMarker(labels: FoldLabels, open: boolean): HTMLElement {
  const marker = document.createElement("span");
  marker.className = "md-fold-marker";
  // The chevron points down while the section is open and towards the text once it is folded
  if (!open) marker.dataset["folded"] = "";
  marker.title = open ? labels.fold : labels.unfold;
  return marker;
}

function foldPlaceholder(labels: FoldLabels, onclick: (event: Event) => void): HTMLElement {
  const placeholder = document.createElement("span");
  placeholder.className = "md-fold-placeholder";
  placeholder.textContent = "…";
  placeholder.setAttribute("aria-label", labels.foldedText);
  placeholder.title = labels.unfold;
  placeholder.addEventListener("click", onclick);
  return placeholder;
}

/**
 * The shortcuts that fold the section at the caret and open it again. `foldKeymap` binds them to
 * Ctrl-Shift-[ and Ctrl-Shift-], which the app already gives to the ordered and bullet lists
 * (format.ts), and folding every section at once is no way to read a document of headings, so
 * folding takes the two chords the library keeps for the whole document.
 */
export const foldingKeymap: KeyBinding[] = [
  { key: "Mod-Alt-[", run: foldCode },
  { key: "Mod-Alt-]", run: unfoldCode },
];

/**
 * Folds in the editor. The Markdown language already says what can be folded — the section of a
 * heading down to the line before the next heading of the same or higher level, a fenced code
 * block, the rest of a paragraph — so this adds the machinery that shows and drives those folds:
 * a gutter of its own (editor.css gives it no room, see there) and the marker and placeholder that
 * carry the app's words and colors.
 */
export function folding(labels: FoldLabels): Extension {
  return [
    codeFolding({ placeholderDOM: (_view, onclick) => foldPlaceholder(labels, onclick) }),
    foldGutter({
      markerDOM: (open) => foldMarker(labels, open),
      domEventHandlers: {
        // The gutter sits outside the document, and a press on it would take the focus away from
        // the text it folds; the press keeps the caret where it was and lets the click fold
        mousedown: (view, _line, event) => {
          event.preventDefault();
          view.focus();
          return false;
        },
      },
    }),
  ];
}

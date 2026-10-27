import { codeFolding, foldCode, foldGutter, unfoldCode } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { type EditorView, type KeyBinding, ViewPlugin } from "@codemirror/view";

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

/**
 * Keeps the margin quiet: the marker of a heading only shows while the pointer is on that heading,
 * or once its section is folded and the marker is the way back to the text. The pointer can cross
 * from the heading into the margin, where the marker lies, without the marker going away.
 */
function revealOnHover(): Extension {
  return ViewPlugin.fromClass(
    class {
      private frame: number | undefined;

      constructor(private readonly view: EditorView) {
        view.dom.addEventListener("pointermove", this.move);
        view.dom.addEventListener("pointerleave", this.clear);
      }

      private readonly move = (event: PointerEvent) => {
        if (this.frame !== undefined) return;
        const y = event.clientY;
        this.frame = requestAnimationFrame(() => {
          this.frame = undefined;
          this.reveal(y);
        });
      };

      private readonly clear = () => {
        if (this.frame !== undefined) cancelAnimationFrame(this.frame);
        this.frame = undefined;
        for (const element of this.markers()) element.removeAttribute("data-revealed");
      };

      private reveal(y: number) {
        for (const element of this.markers()) {
          const rect = element.getBoundingClientRect();
          element.toggleAttribute("data-revealed", y >= rect.top && y < rect.bottom);
        }
      }

      private markers(): readonly HTMLElement[] {
        return [...this.view.dom.querySelectorAll<HTMLElement>(".cm-foldGutter .cm-gutterElement")];
      }

      destroy() {
        this.clear();
        this.view.dom.removeEventListener("pointermove", this.move);
        this.view.dom.removeEventListener("pointerleave", this.clear);
      }
    },
  );
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
    revealOnHover(),
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

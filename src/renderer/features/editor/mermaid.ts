import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import { type EditorView, WidgetType } from "@codemirror/view";

let renderCount = 0;
/** Rendered diagrams by source and color scheme; widgets are rebuilt while scrolling and editing. */
const cache = new Map<string, Promise<string>>();

/** Mermaid is large, so it is loaded the first time a diagram is shown. */
function renderDiagram(source: string, dark: boolean): Promise<string> {
  const key = `${dark ? "dark" : "light"}\n${source}`;
  let svg = cache.get(key);
  if (!svg) {
    svg = (async () => {
      const { default: mermaid } = await import("mermaid");
      mermaid.initialize({ startOnLoad: false, theme: dark ? "dark" : "default" });
      const result = await mermaid.render(`md-mermaid-${renderCount++}`, source);
      return result.svg;
    })();
    cache.set(key, svg);
  }
  return svg;
}

function prefersDark(): boolean {
  return matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Renders every diagram of the document ahead of printing; the page is laid out at once, before
 * a diagram rendered on demand could arrive.
 */
export async function prerenderDiagrams(state: EditorState): Promise<void> {
  const sources: string[] = [];
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name !== "FencedCode") return true;
      const info = node.node.getChild("CodeInfo");
      const code = node.node.getChild("CodeText");
      if (info && code && state.sliceDoc(info.from, info.to).trim().toLowerCase() === "mermaid") {
        sources.push(state.sliceDoc(code.from, code.to));
      }
      return false;
    },
  });
  await Promise.allSettled(sources.map((source) => renderDiagram(source, prefersDark())));
}

export class MermaidWidget extends WidgetType {
  constructor(readonly source: string) {
    super();
  }

  override eq(other: MermaidWidget): boolean {
    return other.source === this.source;
  }

  toDOM(view: EditorView): HTMLElement {
    const element = document.createElement("div");
    element.className = "md-mermaid";
    renderDiagram(this.source, prefersDark()).then(
      (svg) => {
        // Mermaid's default strict security level sanitizes the diagram source it renders
        element.innerHTML = svg;
        view.requestMeasure();
      },
      (error: unknown) => {
        element.classList.add("is-invalid");
        element.textContent = error instanceof Error ? error.message : String(error);
        view.requestMeasure();
      },
    );
    return element;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

import { syntaxTree } from "@codemirror/language";
import { type EditorState, Facet } from "@codemirror/state";
import { fencedText } from "./block-text";

/** Mermaid's theme variables; only hex colors work, since Mermaid derives shades from them. */
export type DiagramTheme = Readonly<Record<string, string | boolean>>;

/** The diagram colors of the document's theme; changing it redraws the diagrams. */
export const diagramTheme = Facet.define<DiagramTheme, DiagramTheme>({
  combine: (values) => values[0] ?? {},
  compare: (a, b) => JSON.stringify(a) === JSON.stringify(b),
});

let renderCount = 0;
/** Rendered diagrams by theme and source; widgets are rebuilt while scrolling and editing. */
const cache = new Map<string, Promise<string>>();

/** Mermaid is large, so it is loaded the first time a diagram is shown. */
export function renderDiagram(source: string, theme: DiagramTheme): Promise<string> {
  const key = `${JSON.stringify(theme)}\n${source}`;
  let svg = cache.get(key);
  if (!svg) {
    svg = (async () => {
      const { default: mermaid } = await import("mermaid");
      mermaid.initialize({
        startOnLoad: false,
        theme: "base",
        themeVariables: theme,
        // Mermaid fades the box behind an edge label to half of a color it parses itself, so the
        // box is colored in CSS, after the styles Mermaid writes: it takes the surface the diagram
        // stands on (--md-diagram-label, see editor.css) and hides the edge it names
        themeCSS: `.edgeLabel, .edgeLabel p, .labelBkg {
            background-color: var(--md-diagram-label, transparent);
          }
          .edgeLabel rect {
            fill: var(--md-diagram-label, transparent);
            opacity: 1;
          }`,
      });
      const result = await mermaid.render(`md-mermaid-${renderCount++}`, source);
      return result.svg;
    })();
    cache.set(key, svg);
  }
  return svg;
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
      if (info && state.sliceDoc(info.from, info.to).trim().toLowerCase() === "mermaid") {
        sources.push(fencedText(state, node.node));
      }
      return false;
    },
  });
  const theme = state.facet(diagramTheme);
  await Promise.allSettled(sources.map((source) => renderDiagram(source, theme)));
}

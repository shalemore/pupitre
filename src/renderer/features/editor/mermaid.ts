import { syntaxTree } from "@codemirror/language";
import { type EditorState, Facet } from "@codemirror/state";
import { type EditorView, WidgetType } from "@codemirror/view";
import { messageOf } from "@/lib/errors";
import { toHex } from "@/lib/theme";
import { fencedText } from "./block-text";
import { onReveal, onScrollbar } from "./widget-events";

/** Mermaid's theme variables; only hex colors work, since Mermaid derives shades from them. */
export type DiagramTheme = Readonly<Record<string, string | boolean>>;

function isDark(hex: string): boolean {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((start) =>
    Number.parseInt(hex.slice(start, start + 2), 16),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
}

/**
 * Reads the active theme's diagram colors (the --diagram-* tokens in app.css) into Mermaid's
 * `base` theme. Whether the diagram is dark follows the canvas color rather than the system
 * scheme, because a light-only theme can be used in dark mode.
 */
export function readDiagramTheme(): DiagramTheme {
  const style = getComputedStyle(document.documentElement);
  const color = (name: string) => toHex(style.getPropertyValue(name));
  const canvas = color("--ui-surface-1");
  const fill = color("--diagram-fill");
  const stroke = color("--diagram-stroke");
  const line = color("--diagram-line");
  const text = color("--diagram-text");
  const accent = color("--diagram-accent");
  return {
    darkMode: isDark(canvas),
    fontFamily:
      style.getPropertyValue("--pref-font-family") || style.getPropertyValue("--font-document"),
    background: canvas,
    primaryColor: fill,
    primaryTextColor: text,
    primaryBorderColor: stroke,
    mainBkg: fill,
    nodeBorder: stroke,
    textColor: text,
    titleColor: text,
    lineColor: line,
    tertiaryColor: canvas,
    clusterBkg: canvas,
    clusterBorder: stroke,
    edgeLabelBackground: canvas,
    noteBkgColor: fill,
    noteTextColor: text,
    noteBorderColor: accent,
    actorBkg: fill,
    actorBorder: stroke,
    actorTextColor: text,
    signalColor: line,
    signalTextColor: text,
    pie1: accent,
    // Mermaid's light gray shadow turns into a glow on a dark canvas
    dropShadow: "none",
  };
}

/** The diagram colors of the document's theme; changing it redraws the diagrams. */
export const diagramTheme = Facet.define<DiagramTheme, DiagramTheme>({
  combine: (values) => values[0] ?? {},
  compare: (a, b) => JSON.stringify(a) === JSON.stringify(b),
});

let renderCount = 0;
/** Rendered diagrams by theme and source; widgets are rebuilt while scrolling and editing. */
const cache = new Map<string, Promise<string>>();

/** Mermaid is large, so it is loaded the first time a diagram is shown. */
function renderDiagram(source: string, theme: DiagramTheme): Promise<string> {
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

export class MermaidWidget extends WidgetType {
  constructor(
    readonly source: string,
    readonly theme: DiagramTheme,
    /** End of the source this diagram stands for, where a click on it puts the cursor. */
    readonly end?: number,
  ) {
    super();
  }

  override eq(other: MermaidWidget): boolean {
    return other.source === this.source && other.theme === this.theme && other.end === this.end;
  }

  toDOM(view: EditorView): HTMLElement {
    const element = document.createElement("div");
    element.className = "md-mermaid";
    onReveal(element, view, this.end);
    renderDiagram(this.source, this.theme).then(
      (svg) => {
        // Mermaid's default strict security level sanitizes the diagram source it renders
        element.innerHTML = svg;
        view.requestMeasure();
      },
      (error: unknown) => {
        element.classList.add("is-invalid");
        element.textContent = messageOf(error);
        view.requestMeasure();
      },
    );
    return element;
  }

  // As with math, the scrollbar of a diagram wider than the line must scroll it, not select text
  override ignoreEvent(event: Event): boolean {
    return onScrollbar(event);
  }
}

import type { EditorState } from "@codemirror/state";
import type { WidgetType } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { fencedText } from "@pupitre/markdown";

export interface BlockRenderer {
  readonly nodeType: string;
  render(state: EditorState, node: SyntaxNode, editing: boolean): WidgetType | undefined;
}

export interface FenceRenderer {
  render(
    language: string,
    code: string,
    state: EditorState,
    node: SyntaxNode,
  ): WidgetType | undefined;
}

const blockRenderers = new Map<string, BlockRenderer[]>();
const fenceRenderers: FenceRenderer[] = [];

/** Registers a block widget renderer for a Lezer syntax node type. */
export function registerBlockRenderer(renderer: BlockRenderer): () => void {
  const list = blockRenderers.get(renderer.nodeType) ?? [];
  list.push(renderer);
  blockRenderers.set(renderer.nodeType, list);
  return () => {
    const entries = blockRenderers.get(renderer.nodeType);
    if (entries === undefined) return;
    const index = entries.indexOf(renderer);
    if (index >= 0) entries.splice(index, 1);
  };
}

/** Registers a renderer for fenced code blocks (matched before default code highlighting). */
export function registerFenceRenderer(renderer: FenceRenderer): () => void {
  fenceRenderers.push(renderer);
  return () => {
    const index = fenceRenderers.indexOf(renderer);
    if (index >= 0) fenceRenderers.splice(index, 1);
  };
}

export function resolveBlockWidget(
  state: EditorState,
  node: SyntaxNode,
  editing: boolean,
): WidgetType | undefined {
  const candidates = blockRenderers.get(node.name);
  if (candidates !== undefined) {
    for (const renderer of candidates) {
      const widget = renderer.render(state, node, editing);
      if (widget !== undefined) return widget;
    }
  }
  if (node.name !== "FencedCode") return undefined;
  const info = node.getChild("CodeInfo");
  const language = info ? state.sliceDoc(info.from, info.to).trim() : "";
  const code = fencedText(state, node);
  for (const renderer of fenceRenderers) {
    const widget = renderer.render(language, code, state, node);
    if (widget !== undefined) return widget;
  }
  return undefined;
}

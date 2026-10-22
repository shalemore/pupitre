import { htmlSchema } from "@milkdown/kit/preset/commonmark";
import { InputRule } from "@milkdown/kit/prose/inputrules";
import type { Node } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import { $inputRule, $prose, $remark } from "@milkdown/kit/utils";
import type { Root } from "mdast";
import { visit } from "unist-util-visit";

/**
 * GitHub alerts: a quote whose first line is `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` or
 * `[!CAUTION]`.
 *
 * As plain text the marker would be saved as `\[!NOTE]`, because `[` can start a link, and the
 * quote would stop being an alert. The marker is therefore kept as an html node, which the
 * serializer writes verbatim, and the quote is styled through a decoration.
 */
const ALERT_MARKER = /^\[!(note|tip|important|warning|caution)\]/i;

function markAlerts(tree: Root): void {
  visit(tree, "blockquote", (quote) => {
    const paragraph = quote.children[0];
    if (paragraph?.type !== "paragraph") return;
    const text = paragraph.children[0];
    const marker = text?.type === "text" ? ALERT_MARKER.exec(text.value)?.[0] : undefined;
    if (text?.type !== "text" || marker === undefined) return;
    const rest = text.value.slice(marker.length);
    paragraph.children.splice(
      0,
      1,
      { type: "html", value: marker },
      ...(rest === "" ? [] : [{ type: "text" as const, value: rest }]),
    );
  });
}

const remarkAlerts = $remark("githubAlerts", () => () => markAlerts);

function alertType(quote: Node): string | undefined {
  const marker = quote.firstChild?.firstChild;
  if (marker?.type.name !== "html") return undefined;
  return ALERT_MARKER.exec(marker.textContent)?.[1]?.toLowerCase();
}

function alertDecorations(doc: Node): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    const type = node.type.name === "blockquote" ? alertType(node) : undefined;
    if (type) {
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, { class: "md-alert", "data-alert": type }),
      );
    }
    return !node.isTextblock;
  });
  return DecorationSet.create(doc, decorations);
}

const alertsKey = new PluginKey<DecorationSet>("github-alerts");

const alertsPlugin = new Plugin<DecorationSet>({
  key: alertsKey,
  state: {
    init: (_config, state) => alertDecorations(state.doc),
    apply: (tr, previous) => (tr.docChanged ? alertDecorations(tr.doc) : previous),
  },
  props: { decorations: (state) => alertsKey.getState(state) },
});

/** Typing a marker at the start of a quote turns it into an alert. */
const alertInputRule = $inputRule(
  (ctx) =>
    new InputRule(/^\[!(note|tip|important|warning|caution)\]$/i, (state, match, start, end) => {
      const $start = state.doc.resolve(start);
      const quote = $start.node(-1);
      if (quote.type.name !== "blockquote" || $start.index(-1) !== 0) return null;
      const marker = htmlSchema.type(ctx).create(null, state.schema.text(match[0]));
      return state.tr.replaceWith(start, end, marker);
    }),
);

export const githubAlerts = [remarkAlerts, $prose(() => alertsPlugin), alertInputRule].flat();

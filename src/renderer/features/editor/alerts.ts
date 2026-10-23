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
 * `[!CAUTION]`, alone on that line.
 *
 * As plain text the marker would be saved as `\[!NOTE]`, because `[` can start a link, and the
 * quote would stop being an alert. The marker is therefore kept as an html node, which the
 * serializer writes verbatim, and the quote is styled through a decoration. While the cursor is
 * away from the marker, the stylesheet replaces it with an icon and a localized title.
 */
const ALERT_MARKER = /^\[!(note|tip|important|warning|caution)\]/i;

export interface AlertTitles {
  note: string;
  tip: string;
  important: string;
  warning: string;
  caution: string;
}

function isAlertType(value: string | undefined): value is keyof AlertTitles {
  return (
    value === "note" ||
    value === "tip" ||
    value === "important" ||
    value === "warning" ||
    value === "caution"
  );
}

/**
 * GitHub only treats a quote as an alert when the marker is alone on its line. The line break may
 * still be text or already a break node, depending on whether Milkdown's line break plugin ran.
 */
function endsLine(rest: string, next: { type: string } | undefined): boolean {
  return rest === "" ? next === undefined || next.type === "break" : rest.startsWith("\n");
}

function markAlerts(tree: Root): void {
  visit(tree, "blockquote", (quote) => {
    const paragraph = quote.children[0];
    if (paragraph?.type !== "paragraph") return;
    const text = paragraph.children[0];
    const marker = text?.type === "text" ? ALERT_MARKER.exec(text.value)?.[0] : undefined;
    if (text?.type !== "text" || marker === undefined) return;
    const rest = text.value.slice(marker.length);
    if (!endsLine(rest, paragraph.children[1])) return;
    paragraph.children.splice(
      0,
      1,
      { type: "html", value: marker },
      ...(rest === "" ? [] : [{ type: "text" as const, value: rest }]),
    );
  });
}

const remarkAlerts = $remark("githubAlerts", () => () => markAlerts);

function alertType(quote: Node): keyof AlertTitles | undefined {
  const paragraph = quote.firstChild;
  const marker = paragraph?.firstChild;
  if (marker?.type.name !== "html") return undefined;
  const next = paragraph?.maybeChild(1);
  if (next && next.type.name !== "hardbreak" && !(next.isText && next.text?.startsWith("\n"))) {
    return undefined;
  }
  const type = ALERT_MARKER.exec(marker.textContent)?.[1]?.toLowerCase();
  return isAlertType(type) ? type : undefined;
}

function alertDecorations(doc: Node, titles: AlertTitles): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    const type = node.type.name === "blockquote" ? alertType(node) : undefined;
    if (type) {
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, {
          class: "md-alert",
          "data-alert": type,
          // A CSS string token; JSON escaping is valid CSS escaping for quotes and backslashes
          style: `--alert-title: ${JSON.stringify(titles[type])}`,
        }),
      );
    }
    return !node.isTextblock;
  });
  return DecorationSet.create(doc, decorations);
}

function alertsPlugin(titles: AlertTitles): Plugin<DecorationSet> {
  const key = new PluginKey<DecorationSet>("github-alerts");
  return new Plugin<DecorationSet>({
    key,
    state: {
      init: (_config, state) => alertDecorations(state.doc, titles),
      apply: (tr, previous) => (tr.docChanged ? alertDecorations(tr.doc, titles) : previous),
    },
    props: { decorations: (state) => key.getState(state) },
  });
}

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

export function githubAlerts(titles: AlertTitles) {
  return [remarkAlerts, $prose(() => alertsPlugin(titles)), alertInputRule].flat();
}

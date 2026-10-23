import type { Node } from "@milkdown/kit/prose/model";
import { Plugin, TextSelection } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";

/**
 * Clicking a footnote reference moves the cursor into its definition, and clicking the label of a
 * definition moves it back to the first reference, like the links GitHub renders for footnotes.
 */
function findNode(doc: Node, typeName: string, label: string): number | undefined {
  let found: number | undefined;
  doc.descendants((node, pos) => {
    if (found !== undefined) return false;
    if (node.type.name === typeName && node.attrs["label"] === label) found = pos;
    return found === undefined;
  });
  return found;
}

function moveCursor(view: EditorView, pos: number): void {
  const { tr, doc } = view.state;
  view.dispatch(tr.setSelection(TextSelection.near(doc.resolve(pos))).scrollIntoView());
  view.focus();
}

function jump(view: EditorView, target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const { doc } = view.state;
  const reference = target.closest('sup[data-type="footnote_reference"]');
  if (reference) {
    const pos = findNode(doc, "footnote_definition", reference.getAttribute("data-label") ?? "");
    if (pos === undefined) return false;
    moveCursor(view, pos + 1);
    return true;
  }
  const label = target.closest('dl[data-type="footnote_definition"] > dt');
  if (!label) return false;
  const pos = findNode(
    doc,
    "footnote_reference",
    label.parentElement?.getAttribute("data-label") ?? "",
  );
  if (pos === undefined) return false;
  const node = doc.nodeAt(pos);
  moveCursor(view, pos + (node?.nodeSize ?? 1));
  return true;
}

export const footnoteLinks = $prose(
  () =>
    new Plugin({
      props: { handleDOMEvents: { click: (view, event) => jump(view, event.target) } },
    }),
);

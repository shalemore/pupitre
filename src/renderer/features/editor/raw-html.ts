import type { Ctx } from "@milkdown/kit/ctx";
import { htmlSchema } from "@milkdown/kit/preset/commonmark";
import { InputRule } from "@milkdown/kit/prose/inputrules";
import type { Node } from "@milkdown/kit/prose/model";
import {
  type EditorState,
  Plugin,
  TextSelection,
  type Transaction,
} from "@milkdown/kit/prose/state";
import {
  Decoration,
  DecorationSet,
  type EditorView,
  type NodeView,
} from "@milkdown/kit/prose/view";
import { $inputRule, $prose, $remark, $view } from "@milkdown/kit/utils";
import DOMPurify from "dompurify";
import type { Html, Parent, Root } from "mdast";
import { visit } from "unist-util-visit";

/**
 * Raw HTML in Markdown, edited the way Typora does it: an element such as `<kbd>Ctrl</kbd>` is
 * shown rendered, and its source appears in place while the cursor is on it.
 *
 * Milkdown keeps HTML as an atom that only prints the source. Here the html node holds its source
 * as text content instead, so it can be edited like code and is written back byte for byte. The
 * rendering is sanitized with DOMPurify and only shown for complete elements; comments and
 * fragments of a larger structure (an opening `<details>` whose content is Markdown) stay as
 * source.
 */

/** Inline HTML that Markdown splits around its content (`<kbd>`, text, `</kbd>`) is joined again. */
const PHRASING_PARENTS = new Set([
  "paragraph",
  "heading",
  "tableCell",
  "emphasis",
  "strong",
  "delete",
  "link",
]);
const OPENING_TAG = /^<([a-z][\w-]*)(?:\s[^>]*)?>$/i;
const VOID_ELEMENT = /^<(?:area|br|hr|img|input|wbr)\b[^>]*>$/i;
const COMPLETE_ELEMENT = /^<([a-z][\w-]*)\b[^>]*>[^]*<\/\1\s*>$/i;
/** An element or comment with plain text before or after it: the text is not part of the HTML. */
const STRAY_TEXT =
  /^([^<]*)(<!--[^]*-->|<([a-z][\w-]*)\b[^>]*>[^]*<\/\3\s*>|<(?:area|br|hr|img|input|wbr)\b[^>]*>)([^>]*)$/i;

function closingTagIndex(children: Parent["children"], start: number, name: string): number {
  const opening = new RegExp(`^<${name}[\\s>]`, "i");
  const closing = new RegExp(`^</${name}\\s*>$`, "i");
  let depth = 0;
  for (let index = start; index < children.length; index++) {
    const child = children[index];
    if (child?.type !== "html") continue;
    if (opening.test(child.value)) depth++;
    else if (closing.test(child.value) && --depth === 0) return index;
  }
  return -1;
}

function joinInlineHtml(tree: Root, source: string): void {
  visit(tree, (node) => {
    if (!PHRASING_PARENTS.has(node.type) || !("children" in node)) return;
    const { children } = node;
    for (let index = 0; index < children.length; index++) {
      const child = children[index];
      if (child?.type !== "html" || VOID_ELEMENT.test(child.value)) continue;
      const name = OPENING_TAG.exec(child.value)?.[1];
      if (name === undefined) continue;
      const end = closingTagIndex(children, index, name);
      const from = child.position?.start.offset;
      const to = children[end]?.position?.end.offset;
      if (end < 0 || from === undefined || to === undefined) continue;
      const joined: Html = { type: "html", value: source.slice(from, to) };
      children.splice(index, end - index + 1, joined);
    }
  });
}

const remarkInlineHtml = $remark(
  "joinInlineHtml",
  () => () => (tree: Root, file) => joinInlineHtml(tree, String(file.value)),
);

/** The html node keeps its source as editable text instead of an attribute. */
export function editableHtmlSchema(ctx: Ctx): void {
  ctx.update(htmlSchema.key, (getSchema) => (innerCtx) => {
    const { atom: _atom, attrs: _attrs, ...schema } = getSchema(innerCtx);
    return {
      ...schema,
      content: "text*",
      marks: "",
      code: true,
      parseDOM: [{ tag: "span[data-type='html']", preserveWhitespace: "full" }],
      toDOM: () => ["span", { "data-type": "html" }, 0],
      parseMarkdown: {
        match: ({ type }) => type === "html",
        runner: (state, node, type) => {
          state.openNode(type);
          if (typeof node["value"] === "string" && node["value"] !== "") {
            state.addText(node["value"]);
          }
          state.closeNode();
        },
      },
      toMarkdown: {
        match: (node) => node.type.name === "html",
        runner: (state, node) => {
          state.addNode("html", undefined, node.textContent);
        },
      },
    };
  });
}

function isRenderable(source: string): boolean {
  return COMPLETE_ELEMENT.test(source) || VOID_ELEMENT.test(source);
}

function renderPreview(target: HTMLElement, source: string, resolveUrl: (url: string) => string) {
  if (!isRenderable(source)) {
    target.replaceChildren();
    return;
  }
  // Styles from a document must not restyle the app around it
  const fragment = DOMPurify.sanitize(source, {
    RETURN_DOM_FRAGMENT: true,
    FORBID_TAGS: ["style"],
  });
  for (const image of fragment.querySelectorAll("img")) {
    const src = image.getAttribute("src");
    if (src) image.src = resolveUrl(src);
  }
  target.replaceChildren(fragment);
}

function htmlView(resolveUrl: (url: string) => string) {
  return (initial: Node, view: EditorView, getPos: () => number | undefined): NodeView => {
    let source = initial.textContent;
    const dom = document.createElement("span");
    dom.className = "md-html";
    dom.dataset["type"] = "html";
    const contentDOM = document.createElement("span");
    contentDOM.className = "md-html-source";
    contentDOM.spellcheck = false;
    const preview = document.createElement("span");
    preview.className = "md-html-preview";
    preview.contentEditable = "false";
    dom.append(contentDOM, preview);

    const render = () => {
      dom.classList.toggle("is-rendered", isRenderable(source));
      renderPreview(preview, source, resolveUrl);
    };
    render();

    // Clicking the rendering opens its source with the cursor after the opening tag, where the
    // element's text starts
    preview.addEventListener("mousedown", (event) => {
      const pos = getPos();
      if (pos === undefined) return;
      event.preventDefault();
      const offset = Math.min(source.indexOf(">") + 1, source.length);
      const selection = TextSelection.create(view.state.doc, pos + 1 + offset);
      view.dispatch(view.state.tr.setSelection(selection));
      view.focus();
    });

    return {
      dom,
      contentDOM,
      update: (node) => {
        if (node.type !== initial.type) return false;
        if (node.textContent !== source) {
          source = node.textContent;
          render();
        }
        return true;
      },
      // The rendered preview is not part of the document
      ignoreMutation: (mutation) => preview.contains(mutation.target),
      stopEvent: (event) =>
        event.target instanceof globalThis.Node && preview.contains(event.target),
    };
  };
}

/**
 * Text typed right before or after a rendered element can land inside its source, because the
 * browser puts the caret at the edge of the element's DOM. Such text is moved out of the node.
 */
function moveStrayText(state: EditorState): Transaction | null {
  const { $head } = state.selection;
  const node = $head.parent;
  if (node.type.name !== "html") return null;
  const match = STRAY_TEXT.exec(node.textContent);
  const [, before = "", element = "", , after = ""] = match ?? [];
  if (!match || (before === "" && after === "")) return null;
  const pos = $head.before();
  const cursor = $head.parentOffset;
  const text = (value: string) => (value === "" ? [] : [state.schema.text(value)]);
  const tr = state.tr.replaceWith(pos, pos + node.nodeSize, [
    ...text(before),
    node.type.create(null, state.schema.text(element)),
    ...text(after),
  ]);
  // Keep the cursor next to the same character; text after the element follows its closing node
  const elementEnd = before.length + element.length;
  const target =
    cursor <= before.length
      ? pos + cursor
      : cursor >= elementEnd
        ? pos + cursor + 2
        : pos + cursor + 1;
  return tr.setSelection(TextSelection.create(tr.doc, target));
}

/** Shows the source of the html node the cursor is in or next to. */
const editingPlugin = new Plugin({
  appendTransaction: (transactions, _previous, state) =>
    transactions.some((tr) => tr.docChanged) ? moveStrayText(state) : null,
  props: {
    decorations: ({ doc, selection }) => {
      const { $head } = selection;
      const decorations: Decoration[] = [];
      const mark = (from: number, node: Node | null | undefined) => {
        if (node?.type.name !== "html") return;
        decorations.push(Decoration.node(from, from + node.nodeSize, { class: "is-editing" }));
      };
      if ($head.parent.type.name === "html") {
        mark($head.before(), $head.parent);
      } else {
        mark($head.pos - ($head.nodeBefore?.nodeSize ?? 0), $head.nodeBefore);
        mark($head.pos, $head.nodeAfter);
      }
      return DecorationSet.create(doc, decorations);
    },
  },
});

/** Typing the end of an element (`</kbd>`, `<br>`, `-->`) turns the typed source into HTML. */
const typedHtmlRule = $inputRule(
  (ctx) =>
    new InputRule(
      /(?:<([a-z][\w-]*)(?:\s[^<>]*)?>(?:(?!<\1[\s>])[^])*?<\/\1>|<(?:br|hr|img|wbr)\b[^<>]*>|<!--[^]*?-->)$/i,
      (state, match, start, end) => {
        const source = match[0];
        const type = htmlSchema.type(ctx);
        // The last character is being typed and not yet in the document
        const node = type.create(null, state.schema.text(source));
        const tr = state.tr.replaceWith(start, end, node);
        return tr.setSelection(TextSelection.create(tr.doc, start + node.nodeSize));
      },
    ),
);

/** Use together with `editor.config(editableHtmlSchema)`. */
export function rawHtml(resolveUrl: (url: string) => string) {
  return [
    remarkInlineHtml,
    $view(htmlSchema.node, () => htmlView(resolveUrl)),
    $prose(() => editingPlugin),
    typedHtmlRule,
  ].flat();
}

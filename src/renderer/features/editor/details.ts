import type { Node } from "@milkdown/kit/prose/model";
import type { NodeView } from "@milkdown/kit/prose/view";
import { $nodeSchema, $remark, $view } from "@milkdown/kit/utils";
import type { Parent, Root } from "mdast";

/**
 * Collapsible `<details>` sections whose content is Markdown.
 *
 * CommonMark ends an HTML block at the first blank line, so `<details>` with `<summary>` and the
 * closing `</details>` reach the parser as two unrelated html nodes with the Markdown content
 * between them. They are paired into one container node here, and written back as the same two
 * html nodes around the content. Anything that does not match this shape stays raw HTML, see
 * raw-html.ts.
 */
interface Details extends Parent {
  type: "details";
  /** Attributes of the opening tag, including the leading space, so unknown ones survive a save. */
  attributes: string;
  /** The text between `<summary>` and `</summary>`, kept as written. */
  summary: string;
  children: Parent["children"];
}

declare module "mdast" {
  interface RootContentMap {
    details: Details;
  }
}

const OPENING = /^<details((?:\s[^>]*)?)>\s*<summary>([^]*?)<\/summary>\s*$/i;
const OPENING_TAG = /^<details[\s>]/i;
const CLOSING = /^<\/details\s*>\s*$/i;
const OPEN_ATTRIBUTE = /\sopen(?:[\s=]|$)/i;

/** Milkdown's own transformer wraps block-level html in a paragraph, so both shapes are read. */
function htmlSource(node: Parent["children"][number] | undefined): string | undefined {
  if (node?.type === "html") return node.value;
  const [only] = node?.type === "paragraph" ? node.children : [];
  return node?.type === "paragraph" && node.children.length === 1 && only?.type === "html"
    ? only.value
    : undefined;
}

function closingIndex(children: Parent["children"], start: number): number {
  let depth = 0;
  for (let index = start; index < children.length; index++) {
    const source = htmlSource(children[index]);
    if (source === undefined) continue;
    if (OPENING_TAG.test(source)) depth++;
    else if (CLOSING.test(source) && --depth === 0) return index;
  }
  return -1;
}

function pairDetails(parent: Parent): void {
  for (let index = 0; index < parent.children.length; index++) {
    const child = parent.children[index];
    if (child === undefined) continue;
    const source = htmlSource(child);
    const match = source === undefined ? null : OPENING.exec(source);
    const end = match ? closingIndex(parent.children, index) : -1;
    if (!match || end < 0) {
      if ("children" in child) pairDetails(child);
      continue;
    }
    const details: Details = {
      type: "details",
      attributes: match[1] ?? "",
      summary: match[2] ?? "",
      children: parent.children.slice(index + 1, end),
    };
    pairDetails(details);
    parent.children.splice(index, end - index + 1, details);
  }
}

const remarkDetails = $remark("details", () => () => (tree: Root) => pairDetails(tree));

const summarySchema = $nodeSchema("details_summary", () => ({
  content: "text*",
  marks: "",
  defining: true,
  parseDOM: [{ tag: "div.md-details-summary", preserveWhitespace: "full" }],
  toDOM: () => ["div", { class: "md-details-summary" }, 0],
  parseMarkdown: {
    match: () => false,
    runner: () => undefined,
  },
  toMarkdown: {
    match: () => false,
    runner: () => undefined,
  },
}));

const detailsSchema = $nodeSchema("details", () => ({
  group: "block",
  content: "details_summary block+",
  defining: true,
  attrs: { attributes: { default: "", validate: "string" } },
  parseDOM: [
    {
      tag: "div.md-details",
      getAttrs: (dom) => ({ attributes: dom.dataset["attributes"] ?? "" }),
    },
  ],
  toDOM: (node) => ["div", { class: "md-details", "data-attributes": node.attrs["attributes"] }, 0],
  parseMarkdown: {
    match: ({ type }) => type === "details",
    runner: (state, node, type) => {
      const summary = type.schema.nodes["details_summary"];
      if (!summary) throw new Error("The details_summary node is not registered");
      state.openNode(type, { attributes: node["attributes"] });
      state.openNode(summary);
      if (typeof node["summary"] === "string" && node["summary"] !== "") {
        state.addText(node["summary"]);
      }
      state.closeNode();
      state.next(node.children);
      state.closeNode();
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === "details",
    runner: (state, node) => {
      const attributes = node.attrs["attributes"];
      state.addNode(
        "html",
        undefined,
        `<details${typeof attributes === "string" ? attributes : ""}>\n<summary>${node.firstChild?.textContent ?? ""}</summary>`,
      );
      node.forEach((child, _offset, index) => {
        if (index > 0) state.next(child);
      });
      state.addNode("html", undefined, "</details>");
    },
  },
}));

/** The section starts collapsed unless it is written with `open`, like in a browser. Toggling it is not an edit. */
function detailsView(initial: Node): NodeView {
  const dom = document.createElement("div");
  dom.className = "md-details";
  dom.classList.toggle(
    "is-collapsed",
    typeof initial.attrs["attributes"] === "string" &&
      !OPEN_ATTRIBUTE.test(initial.attrs["attributes"]),
  );
  const toggle = document.createElement("span");
  toggle.className = "md-details-toggle";
  toggle.contentEditable = "false";
  toggle.addEventListener("mousedown", (event) => {
    event.preventDefault();
    dom.classList.toggle("is-collapsed");
  });
  const contentDOM = document.createElement("div");
  contentDOM.className = "md-details-body";
  dom.append(toggle, contentDOM);
  return {
    dom,
    contentDOM,
    update: (node) => node.type === initial.type,
    ignoreMutation: (mutation) => toggle.contains(mutation.target) || mutation.target === dom,
    stopEvent: (event) => event.target === toggle,
  };
}

export const details = [
  remarkDetails,
  summarySchema,
  detailsSchema,
  $view(detailsSchema.node, () => detailsView),
].flat();

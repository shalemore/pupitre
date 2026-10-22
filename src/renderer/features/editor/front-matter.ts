import { $nodeSchema, $remark } from "@milkdown/kit/utils";
import remarkFrontmatter from "remark-frontmatter";

/**
 * YAML (`---`) and TOML (`+++`) front matter at the top of a document. CommonMark alone reads the
 * YAML fences as a thematic break and a setext heading, which rewrites the metadata on save, so
 * the block is parsed with remark-frontmatter and kept as plain text that is written back as is.
 */
const KINDS = ["yaml", "toml"] as const;
type FrontMatterKind = (typeof KINDS)[number];

function isFrontMatterKind(value: unknown): value is FrontMatterKind {
  return KINDS.some((kind) => kind === value);
}

const remarkFrontMatter = $remark("frontMatter", () => remarkFrontmatter, [...KINDS]);

const frontMatterSchema = $nodeSchema("front_matter", () => ({
  group: "block",
  content: "text*",
  marks: "",
  code: true,
  defining: true,
  attrs: { kind: { default: "yaml", validate: "string" } },
  parseDOM: [
    {
      tag: "pre[data-type='front-matter']",
      preserveWhitespace: "full",
      getAttrs: (dom) => ({ kind: dom.dataset["kind"] ?? "yaml" }),
    },
  ],
  toDOM: (node) => [
    "pre",
    { "data-type": "front-matter", "data-kind": node.attrs["kind"], spellcheck: "false" },
    ["code", 0],
  ],
  parseMarkdown: {
    match: ({ type }) => isFrontMatterKind(type),
    runner: (state, node, type) => {
      state.openNode(type, { kind: node.type });
      if (typeof node["value"] === "string" && node["value"] !== "") state.addText(node["value"]);
      state.closeNode();
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === "front_matter",
    runner: (state, node) => {
      const kind = node.attrs["kind"];
      state.addNode(isFrontMatterKind(kind) ? kind : "yaml", undefined, node.textContent);
    },
  },
}));

export const frontMatter = [remarkFrontMatter, frontMatterSchema].flat();

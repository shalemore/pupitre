import type { SyntaxNode } from "@lezer/common";
import { parser as htmlParser } from "@lezer/html";

/**
 * A simple HTML element written as raw HTML in a Markdown document, read with its source ranges so
 * the live preview can render it in place, the way it renders the Markdown it stands for. A Lezer
 * parser, like the Markdown one the editor is built on, reads a half-typed element instead of
 * rejecting the block, so a heading still reads as a heading while its closing tag is being
 * written. Only the shapes that map onto a Markdown construct are read; anything else keeps the
 * rendered HTML block (`html.ts`).
 */

/** The block tags the live preview draws as their Markdown counterpart. */
const BLOCK_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p"]);

/** Inline tags a supported block may hold; they are drawn as their Markdown counterpart. */
const INLINE_TAGS = new Set([
  "a",
  "b",
  "code",
  "del",
  "em",
  "i",
  "ins",
  "kbd",
  "mark",
  "s",
  "small",
  "strong",
  "sub",
  "sup",
  "u",
]);

type HtmlAlignment = "left" | "right" | "center" | "justify";

/** A tag or the content between two tags, as offsets into the source the element was read from. */
export interface HtmlRange {
  from: number;
  to: number;
}

/** An element of a supported HTML block, or an inline element inside one. */
export interface HtmlElement {
  tag: string;
  startTag: HtmlRange;
  /** Absent while a closing tag is still being written. */
  endTag: HtmlRange | undefined;
  content: HtmlRange;
  alignment: HtmlAlignment | undefined;
  href: string | undefined;
  children: readonly HtmlElement[];
}

export interface HtmlBlock {
  element: HtmlElement;
}

function textOf(source: string, node: SyntaxNode | null): string {
  return node === null ? "" : source.slice(node.from, node.to);
}

/** The end of a source once the whitespace after its last visible character, such as its newline, is left out. */
function trimmedEnd(source: string, end: number): number {
  while (end > 0 && /\s/.test(source[end - 1] ?? "")) end -= 1;
  return end;
}

/** The alignment an `align` attribute asks for; a value the browser would ignore is ignored too. */
function alignmentOf(value: string | undefined): HtmlAlignment | undefined {
  const alignment = value?.toLowerCase();
  if (
    alignment === "left" ||
    alignment === "right" ||
    alignment === "center" ||
    alignment === "justify"
  ) {
    return alignment;
  }
  return undefined;
}

/** The attributes a tag may carry, so an element with styling of its own keeps the rendered block. */
function allowedAttributes(tag: string): ReadonlySet<string> {
  if (BLOCK_TAGS.has(tag)) return new Set(["align"]);
  if (tag === "a") return new Set(["href", "title"]);
  return new Set();
}

/** The name and value of each attribute of an open tag, or undefined for markup not understood. */
function attributesOf(
  source: string,
  openTag: SyntaxNode,
): ReadonlyMap<string, string> | undefined {
  const attributes = new Map<string, string>();
  for (let child = openTag.firstChild; child; child = child.nextSibling) {
    if (child.name === "TagName" || child.name === "StartTag" || child.name === "EndTag") {
      continue;
    }
    if (child.name !== "Attribute") return undefined;
    const name = child.getChild("AttributeName");
    if (name === null) return undefined;
    const value = child.getChild("AttributeValue") ?? child.getChild("UnquotedAttributeValue");
    const raw = textOf(source, value);
    attributes.set(
      textOf(source, name).toLowerCase(),
      raw.replace(/^["']/, "").replace(/["']$/, ""),
    );
  }
  return attributes;
}

/** Nodes inside an element that are text rather than an inline element. */
function isTextNode(name: string): boolean {
  return (
    name === "Text" ||
    name === "EntityReference" ||
    name === "IncompleteTag" ||
    name === "IncompleteCloseTag"
  );
}

function elementOf(source: string, node: SyntaxNode): HtmlElement | undefined {
  const openTag = node.getChild("OpenTag");
  const tagName = openTag?.getChild("TagName") ?? null;
  // An open tag without its `>` is still being typed, so the source keeps the rendered block
  if (openTag === null || tagName === null || openTag.getChild("EndTag") === null) return undefined;
  const tag = textOf(source, tagName).toLowerCase();
  if (!BLOCK_TAGS.has(tag) && !INLINE_TAGS.has(tag)) return undefined;
  const attributes = attributesOf(source, openTag);
  if (attributes === undefined) return undefined;
  const allowed = allowedAttributes(tag);
  for (const name of attributes.keys()) {
    if (!allowed.has(name)) return undefined;
  }
  const alignment = alignmentOf(attributes.get("align"));
  const closeTag = node.getChild("CloseTag");
  // A complete closing tag has to name this element; a missing one is content to the source's end
  if (closeTag !== null && closeTag.getChild("EndTag") !== null) {
    if (textOf(source, closeTag.getChild("TagName")).toLowerCase() !== tag) return undefined;
  }
  const children: HtmlElement[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.name === "OpenTag" || child.name === "CloseTag" || isTextNode(child.name)) continue;
    if (child.type.isError) continue;
    if (child.name !== "Element") return undefined;
    const childTag = textOf(source, child.getChild("OpenTag")?.getChild("TagName") ?? null);
    if (!INLINE_TAGS.has(childTag.toLowerCase())) return undefined;
    // An inline tag that is still being typed stays as its source text, the line keeps rendering
    const inline = elementOf(source, child);
    if (inline !== undefined) children.push(inline);
  }
  return {
    tag,
    startTag: { from: openTag.from, to: openTag.to },
    endTag: closeTag === null ? undefined : { from: closeTag.from, to: closeTag.to },
    content: { from: openTag.to, to: closeTag?.from ?? trimmedEnd(source, node.to) },
    alignment,
    href: attributes.get("href"),
    children,
  };
}

/**
 * The one supported element a source consists of, with the ranges of its tags and its content.
 * The source may have whitespace around the element, such as the newline that ends an HTML block;
 * anything else, a second element or a tag or attribute outside the supported subset, gives
 * undefined and the rendered block stays. A closing tag that is still being typed is not an
 * error: the element's content runs to the end of the source until the tag arrives.
 */
function singleElement(source: string, tags: ReadonlySet<string>): HtmlElement | undefined {
  const tree = htmlParser.parse(source);
  let element: SyntaxNode | undefined;
  for (let child = tree.topNode.firstChild; child; child = child.nextSibling) {
    if (child.name === "Text" && textOf(source, child).trim() === "") continue;
    if (child.name !== "Element" || element !== undefined) return undefined;
    element = child;
  }
  if (element === undefined) return undefined;
  const tag = textOf(
    source,
    element.getChild("OpenTag")?.getChild("TagName") ?? null,
  ).toLowerCase();
  if (!tags.has(tag)) return undefined;
  if (source.slice(element.from, trimmedEnd(source, element.to)).includes("\n")) return undefined;
  return elementOf(source, element);
}

/**
 * The block an HTML block source draws in place, when it is one heading or a paragraph whose
 * content is text and inline formatting. Undefined leaves the block rendered as ordinary HTML.
 */
export function htmlBlockPreview(source: string): HtmlBlock | undefined {
  const element = singleElement(source, BLOCK_TAGS);
  return element === undefined ? undefined : { element };
}

/** The content range of a selection that is exactly one supported element, tags included. */
export function htmlElementContent(source: string): HtmlRange | undefined {
  const tags = new Set([...BLOCK_TAGS, ...INLINE_TAGS]);
  return singleElement(source, tags)?.content;
}

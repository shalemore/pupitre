import type { EditorState } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";
import { type Component, createResource, For, type JSX, Match, Switch } from "solid-js";
import { Dynamic } from "solid-js/web";
import { emojiFor } from "./emoji";
import { formattingTagClass, htmlTag, isFormattingTag } from "./html";
import { type ImageAlignment, imageOf, imageStyle, parseImageTag, resolveUrl } from "./images";
import { markers } from "./live-preview";
import { renderMath } from "./mathjax";

/**
 * Inline Markdown rendered as elements, for widgets that replace their source (table cells) and for
 * the HTML export, which writes the items as markup. It is built from the same Lezer tree as the
 * live preview, so both read the syntax alike. Inline HTML other than formatting tags is left out
 * and its text kept.
 */

export type InlineItem =
  | { type: "text"; text: string }
  | { type: "break" }
  | { type: "element"; tag: string; class?: string; children: InlineItem[] }
  | { type: "link"; href: string; children: InlineItem[] }
  | {
      type: "image";
      src: string;
      alt: string;
      title: string;
      width: number | undefined;
      alignment: ImageAlignment | undefined;
      /** The source range of the picture, for the controls a table cell offers it. */
      from: number;
      to: number;
    }
  | { type: "math"; tex: string; display: boolean }
  | { type: "footnote"; label: string };

export type InlineImage = Extract<InlineItem, { type: "image" }>;

const ELEMENT_TAGS: Record<string, { tag: string; class: string }> = {
  StrongEmphasis: { tag: "strong", class: "md-strong" },
  Emphasis: { tag: "em", class: "md-em" },
  Strikethrough: { tag: "del", class: "md-strike" },
  Highlight: { tag: "mark", class: "md-tag md-tag-mark" },
  Subscript: { tag: "sub", class: "md-tag md-tag-sub" },
  Superscript: { tag: "sup", class: "md-tag md-tag-sup" },
};

/** The items between `from` and `to`, children of `parent`. */
export function inlineItems(
  state: EditorState,
  parent: SyntaxNode,
  from = parent.from,
  to = parent.to,
): InlineItem[] {
  const text = (start: number, end: number) => state.sliceDoc(start, end);
  // Open formatting tags, innermost last; items collect into the top entry
  const stack: { tag: string; items: InlineItem[] }[] = [{ tag: "", items: [] }];
  const push = (item: InlineItem) => stack.at(-1)?.items.push(item);
  let pos = from;

  for (let child = parent.firstChild; child; child = child.nextSibling) {
    if (child.to <= from || child.from >= to) continue;
    if (child.from > pos) push({ type: "text", text: text(pos, child.from) });
    pos = child.to;
    // The content of a format sits between its first two markers (`**`…`**`, `[`…`]`)
    const [open, close] = markers(child);
    const start = open?.to ?? child.from;
    const end = close?.from ?? child.to;
    const inner = () => inlineItems(state, child, start, end);
    switch (child.name) {
      case "StrongEmphasis":
      case "Emphasis":
      case "Strikethrough":
      case "Highlight":
      case "Subscript":
      case "Superscript": {
        const element = ELEMENT_TAGS[child.name] ?? { tag: "span", class: "" };
        push({ type: "element", ...element, children: inner() });
        break;
      }
      case "InlineCode":
        push({
          type: "element",
          tag: "code",
          class: "md-code",
          children: [{ type: "text", text: text(start, end) }],
        });
        break;
      case "InlineMath":
        push({ type: "math", tex: text(start, end), display: start - child.from === 2 });
        break;
      case "Link": {
        const url = child.getChild("URL");
        push({ type: "link", href: url ? text(url.from, url.to) : "", children: inner() });
        break;
      }
      case "Autolink":
      case "URL": {
        const url = child.name === "URL" ? child : child.getChild("URL");
        const href = url ? text(url.from, url.to) : "";
        push({ type: "link", href, children: [{ type: "text", text: href }] });
        break;
      }
      case "Image": {
        const image = imageOf(state, child);
        if (image) {
          push({
            type: "image",
            src: resolveUrl(state, image.src),
            alt: image.alt,
            title: image.title,
            width: image.width,
            alignment: image.alignment,
            from: image.from,
            to: image.to,
          });
        }
        break;
      }
      case "FootnoteReference":
        push({ type: "footnote", label: text(start, end) });
        break;
      case "Emoji": {
        const source = text(child.from, child.to);
        push({ type: "text", text: emojiFor(source) ?? source });
        break;
      }
      case "Escape":
        push({ type: "text", text: text(child.from + 1, child.to) });
        break;
      case "HardBreak":
        push({ type: "break" });
        break;
      case "HTMLTag": {
        const source = text(child.from, child.to);
        const picture = parseImageTag(source);
        if (picture) {
          push({
            type: "image",
            src: resolveUrl(state, picture.src),
            alt: picture.alt,
            title: picture.title,
            width: picture.width,
            alignment: picture.alignment,
            from: child.from,
            to: child.to,
          });
          break;
        }
        const tag = htmlTag(source);
        if (tag?.name === "br") push({ type: "break" });
        else if (tag && isFormattingTag(tag.name) && !tag.closing)
          stack.push({ tag: tag.name, items: [] });
        else if (tag?.closing && stack.length > 1 && stack.at(-1)?.tag === tag.name) {
          const element = stack.pop();
          if (element) {
            push({
              type: "element",
              tag: element.tag,
              class: formattingTagClass(element.tag),
              children: element.items,
            });
          }
        }
        break;
      }
      default:
        // A task's `[x]` is a marker too, though its name ends in "Marker" rather than "Mark"
        if (!child.name.endsWith("Mark") && child.name !== "TaskMarker")
          push({ type: "text", text: text(child.from, child.to) });
    }
  }
  if (to > pos) push({ type: "text", text: text(pos, to) });
  // Tags that were never closed keep their content as plain items
  while (stack.length > 1) {
    const element = stack.pop();
    if (element) stack.at(-1)?.items.push(...element.items);
  }
  return stack[0]?.items ?? [];
}

const MathItem: Component<{ tex: string; display: boolean }> = (props) => {
  const [svg] = createResource(
    () => ({ tex: props.tex, display: props.display }),
    (formula) => renderMath(formula.tex, formula.display),
  );
  return <span class="md-math" innerHTML={svg() ?? ""} />;
};

export const InlineContent: Component<{
  items: InlineItem[];
  /** Draws a picture instead of the default tag, for a renderer that offers its controls. */
  renderImage?: ((image: InlineImage) => JSX.Element) | undefined;
}> = (props) => (
  <For each={props.items}>
    {(item) => (
      <Switch>
        <Match when={item.type === "text" && item}>{(text) => text().text}</Match>
        <Match when={item.type === "break"}>
          <br />
        </Match>
        <Match when={item.type === "element" && item}>
          {(element) => (
            <Dynamic component={element().tag} class={element().class}>
              <InlineContent items={element().children} renderImage={props.renderImage} />
            </Dynamic>
          )}
        </Match>
        <Match when={item.type === "link" && item}>
          {(link) => (
            // A span, not an anchor: a click places the cursor and Ctrl+click follows the link
            <span class="md-link" title={link().href}>
              <InlineContent items={link().children} renderImage={props.renderImage} />
            </span>
          )}
        </Match>
        <Match when={item.type === "image" && item}>
          {(image) =>
            props.renderImage ? (
              props.renderImage(image())
            ) : (
              <img
                class="md-image-preview"
                src={image().src}
                alt={image().alt}
                title={image().title}
                width={image().width}
                style={imageStyle(image())}
              />
            )
          }
        </Match>
        <Match when={item.type === "math" && item}>
          {(math) => <MathItem tex={math().tex} display={math().display} />}
        </Match>
        <Match when={item.type === "footnote" && item}>
          {(note) => <sup class="md-footnote-ref">{note().label}</sup>}
        </Match>
      </Switch>
    )}
  </For>
);

import type { EditorState } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";
import { type Component, createResource, For, Match, Switch } from "solid-js";
import { Dynamic } from "solid-js/web";
import { htmlTag, isFormattingTag } from "./html";
import { imageSource, resolveUrl } from "./images";
import { markers } from "./live-preview";
import { renderMath } from "./mathjax";

/**
 * Inline Markdown rendered as elements, for widgets that replace their source (table cells).
 * It is built from the same Lezer tree as the live preview, so both read the syntax alike. Inline
 * HTML other than formatting tags is left out and its text kept.
 */

export type InlineItem =
  | { type: "text"; text: string }
  | { type: "break" }
  | { type: "element"; tag: string; class?: string; children: InlineItem[] }
  | { type: "link"; href: string; children: InlineItem[] }
  | { type: "image"; src: string; alt: string }
  | { type: "math"; tex: string; display: boolean };

const ELEMENT_TAGS: Record<string, { tag: string; class: string }> = {
  StrongEmphasis: { tag: "strong", class: "md-strong" },
  Emphasis: { tag: "em", class: "md-em" },
  Strikethrough: { tag: "del", class: "md-strike" },
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
      case "Strikethrough": {
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
        const url = child.getChild("URL");
        const src = url ? resolveUrl(state, imageSource(text(url.from, url.to))) : "";
        push({ type: "image", src, alt: text(start, end) });
        break;
      }
      case "Escape":
        push({ type: "text", text: text(child.from + 1, child.to) });
        break;
      case "HardBreak":
        push({ type: "break" });
        break;
      case "HTMLTag": {
        const tag = htmlTag(text(child.from, child.to));
        if (tag?.name === "br") push({ type: "break" });
        else if (tag && isFormattingTag(tag.name) && !tag.closing)
          stack.push({ tag: tag.name, items: [] });
        else if (tag?.closing && stack.length > 1 && stack.at(-1)?.tag === tag.name) {
          const element = stack.pop();
          if (element) {
            push({
              type: "element",
              tag: element.tag,
              class: `md-tag md-tag-${element.tag}`,
              children: element.items,
            });
          }
        }
        break;
      }
      default:
        if (!child.name.endsWith("Mark")) push({ type: "text", text: text(child.from, child.to) });
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

export const InlineContent: Component<{ items: InlineItem[] }> = (props) => (
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
              <InlineContent items={element().children} />
            </Dynamic>
          )}
        </Match>
        <Match when={item.type === "link" && item}>
          {(link) => (
            // A span, not an anchor: a click places the cursor and Ctrl+click follows the link
            <span class="md-link" title={link().href}>
              <InlineContent items={link().children} />
            </span>
          )}
        </Match>
        <Match when={item.type === "image" && item}>
          {(image) => <img class="md-image-preview" src={image().src} alt={image().alt} />}
        </Match>
        <Match when={item.type === "math" && item}>
          {(math) => <MathItem tex={math().tex} display={math().display} />}
        </Match>
      </Switch>
    )}
  </For>
);

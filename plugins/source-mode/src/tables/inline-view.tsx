import { imageStyle, renderMath, type InlineImage, type InlineItem } from "@pupitre/markdown";
import { Dynamic, type JSX } from "@solidjs/web";
import { type Component, createMemo, For, Loading, Match, Switch } from "solid-js";

const MathItem: Component<{ tex: string; display: boolean }> = (props) => {
  const svg = createMemo(() => renderMath(props.tex, props.display));
  return (
    <Loading fallback={<span class="md-math" />}>
      <span class="md-math" innerHTML={svg()} />
    </Loading>
  );
};

export const InlineContent: Component<{
  items: InlineItem[];
  /** Draws a picture instead of the default tag, for a renderer that offers its controls. */
  renderImage?: ((image: InlineImage) => JSX.Element) | undefined;
}> = (props) => (
  <For each={props.items}>
    {(item) => (
      <Switch>
        {/* `item` is a plain value; a keyed Match hands the narrowed item itself to the child */}
        <Match when={item.type === "text" ? item : false} keyed>
          {(text) => text.text}
        </Match>
        <Match when={item.type === "break"}>
          <br />
        </Match>
        <Match when={item.type === "element" ? item : false} keyed>
          {(element) => (
            <Dynamic component={element.tag} class={element.class}>
              <InlineContent items={element.children} renderImage={props.renderImage} />
            </Dynamic>
          )}
        </Match>
        <Match when={item.type === "link" ? item : false} keyed>
          {(link) => (
            // A span, not an anchor: a click places the cursor and Ctrl+click follows the link
            <span class="md-link" title={link.href}>
              <InlineContent items={link.children} renderImage={props.renderImage} />
            </span>
          )}
        </Match>
        <Match when={item.type === "image" ? item : false} keyed>
          {(image) =>
            props.renderImage ? (
              props.renderImage(image)
            ) : (
              <img
                class="md-image-preview"
                src={image.src}
                alt={image.alt}
                title={image.title}
                width={image.width}
                style={imageStyle(image)}
              />
            )
          }
        </Match>
        <Match when={item.type === "math" ? item : false} keyed>
          {(math) => <MathItem tex={math.tex} display={math.display} />}
        </Match>
        <Match when={item.type === "footnote" ? item : false} keyed>
          {(note) => <sup class="md-footnote-ref">{note.label}</sup>}
        </Match>
      </Switch>
    )}
  </For>
);

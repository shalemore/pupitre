import { type Component, createResource, For, type JSX, Match, Switch } from "solid-js";
import { Dynamic } from "solid-js/web";
import { imageStyle } from "@/lib/markdown/images";
import { type InlineImage, type InlineItem } from "@/lib/markdown/inline";
import { renderMath } from "@/lib/markdown/mathjax";

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

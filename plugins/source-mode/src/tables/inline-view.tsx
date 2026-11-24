import { imageStyle, renderMath, type InlineImage, type InlineItem } from "@pupitre/markdown";
import { Dynamic, type JSX } from "@solidjs/web";
import { type Component, createMemo, Loading, Match, Repeat, Show, Switch } from "solid-js";

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
  // Parsed inline AST items are freshly allocated objects on each edit without stable IDs;
  // Repeat keeps positional DOM scopes alive across updates instead of recreating every node.
  <Repeat count={props.items.length}>
    {(i) => (
      <Show when={props.items[i]}>
        {(item) => (
          <Switch>
            {/* `item` is a plain value; a keyed Match hands the narrowed item itself to the child */}
            <Match
              when={(() => {
                const v = item();
                return v.type === "text" ? v : false;
              })()}
              keyed
            >
              {(text) => text.text}
            </Match>
            <Match when={item().type === "break"}>
              <br />
            </Match>
            <Match
              when={(() => {
                const v = item();
                return v.type === "element" ? v : false;
              })()}
              keyed
            >
              {(element) => (
                <Dynamic component={element.tag} class={element.class}>
                  <InlineContent items={element.children} renderImage={props.renderImage} />
                </Dynamic>
              )}
            </Match>
            <Match
              when={(() => {
                const v = item();
                return v.type === "link" ? v : false;
              })()}
              keyed
            >
              {(link) => (
                // A span, not an anchor: a click places the cursor and Ctrl+click follows the link
                <span class="md-link" title={link.href}>
                  <InlineContent items={link.children} renderImage={props.renderImage} />
                </span>
              )}
            </Match>
            <Match
              when={(() => {
                const v = item();
                return v.type === "image" ? v : false;
              })()}
              keyed
            >
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
            <Match
              when={(() => {
                const v = item();
                return v.type === "math" ? v : false;
              })()}
              keyed
            >
              {(math) => <MathItem tex={math.tex} display={math.display} />}
            </Match>
            <Match
              when={(() => {
                const v = item();
                return v.type === "footnote" ? v : false;
              })()}
              keyed
            >
              {(note) => <sup class="md-footnote-ref">{note.label}</sup>}
            </Match>
          </Switch>
        )}
      </Show>
    )}
  </Repeat>
);

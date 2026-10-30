import { type Component, Show } from "solid-js";
import { fileNameOf } from "@/lib/file";
import { css } from "@/styled-system/css";

const container = css({
  width: "full",
  height: "full",
  display: "grid",
  placeItems: "center",
  overflow: "hidden",
  backgroundColor: "surface.1",
  padding: "6",
});
const picture = css({ maxHeight: "full", maxWidth: "full", objectFit: "contain" });

/** A picture shown on its own in the content area, fitted to the room it has. */
export const ImagePreview: Component<{
  baseUrl: string | undefined;
  path: string | undefined;
}> = (props) => {
  const name = () => (props.path === undefined ? "" : fileNameOf(props.path));
  const source = () => {
    if (props.baseUrl === undefined || props.path === undefined) return undefined;
    return new URL(encodeURIComponent(name()), props.baseUrl).href;
  };
  return (
    <Show when={source()}>
      {(src) => (
        <div class={container}>
          <img src={src()} alt={name()} draggable={false} class={picture} />
        </div>
      )}
    </Show>
  );
};

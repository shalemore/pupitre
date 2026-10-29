import { type Component, Show } from "solid-js";
import { fileNameOf } from "@/lib/file";

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
        <div class="size-full grid place-items-center overflow-hidden bg-surface-1 p-6">
          <img
            src={src()}
            alt={name()}
            draggable={false}
            class="max-h-full max-w-full object-contain"
          />
        </div>
      )}
    </Show>
  );
};

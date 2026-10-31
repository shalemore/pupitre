import type { EditorView } from "@codemirror/view";
import { type Component, createEffect, onCleanup } from "solid-js";
import { imageDom } from "@/features/editor/images/image-widget";
import { imageIn, setImageLayout } from "@/lib/markdown/images";
import type { InlineImage } from "@/lib/markdown/inline";
import { css } from "@/styled-system/css";

export interface CellPosition {
  row: number;
  column: number;
}

/** A picture in a cell, with the handle and bar that write a size back into the cell's source. */
export const TableCellImage: Component<{ view: EditorView; image: InlineImage }> = (props) => {
  let host: HTMLSpanElement | undefined;
  createEffect(() => {
    const item = props.image;
    const image = imageIn(props.view.state, item.from, item.to);
    if (host === undefined || image === undefined) return;
    host.replaceChildren(
      imageDom(props.view, item.src, item.alt, item.title, item, true, undefined, (change) => {
        const current = imageIn(props.view.state, item.from, item.to);
        if (current !== undefined) setImageLayout(props.view, current, change(current));
      }),
    );
    onCleanup(() => host?.replaceChildren());
  });
  return (
    <span
      ref={(element) => {
        host = element;
      }}
      class={hiddenHost}
    />
  );
};

const hiddenHost = css({ display: "block", width: "full" });

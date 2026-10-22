import { imageBlockSchema } from "@milkdown/kit/component/image-block";
import type { Ctx } from "@milkdown/kit/ctx";

/**
 * Milkdown's image block writes the image scale into the alt text (`![1.00](src)`), overwriting the user's own alt text.
 * Here the alt is treated as a scale only when it is a number (compatible with files Milkdown wrote), and is kept as is otherwise;
 * on save the alt is written back first, and the ratio only when there is no alt and the image was resized.
 */
export function preserveImageAlt(ctx: Ctx): void {
  ctx.update(imageBlockSchema.key, (getSchema) => (innerCtx) => {
    const schema = getSchema(innerCtx);
    return {
      ...schema,
      attrs: { ...schema.attrs, alt: { default: "", validate: "string" } },
      parseMarkdown: {
        match: schema.parseMarkdown.match,
        runner: (state, node, type) => {
          const alt = typeof node["alt"] === "string" ? node["alt"] : "";
          const title = node["title"];
          const ratio = Number(alt);
          const isRatio = alt !== "" && Number.isFinite(ratio) && ratio > 0;
          state.addNode(type, {
            src: typeof node["url"] === "string" ? node["url"] : "",
            caption: typeof title === "string" ? title : "",
            ratio: isRatio ? ratio : 1,
            alt: isRatio ? "" : alt,
          });
        },
      },
      toMarkdown: {
        match: schema.toMarkdown.match,
        runner: (state, node) => {
          const ratio = Number(node.attrs["ratio"]);
          const alt = String(node.attrs["alt"] ?? "");
          const caption = String(node.attrs["caption"] ?? "");
          state.openNode("paragraph");
          state.addNode("image", undefined, undefined, {
            title: caption === "" ? null : caption,
            url: node.attrs["src"],
            alt: alt === "" && ratio !== 1 ? ratio.toFixed(2) : alt,
          });
          state.closeNode();
        },
      },
    };
  });
}

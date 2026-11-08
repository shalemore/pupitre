import { defineTrustedPlugin } from "@pupitre/plugin-sdk/trusted";
import { leavingBlocks } from "./leave";
import { livePreview } from "./preview/live-preview";
import { renderedBlocks } from "./preview/rendered-blocks";

export { configureSourceModeHost, type SourceModeHost } from "./host";
export { ImagePreview } from "./images/image-preview";
export { imageCaptionClick, imageInput } from "./images/image-widget";
export { setPrinting } from "./preview/live-preview";
export { scrollToDocument } from "./scroll";
export { markdownPairing, smartTyping } from "./smart-typing";
export { TableSizeDialog } from "./tables/table-size-dialog";
export { closeInlineTags } from "./widgets/html-widget";

type SourceModeSettings = { sourceMode: boolean };

/** Renders the document's constructs in place, or shows every marker in source mode. */
export const sourceMode = defineTrustedPlugin<SourceModeSettings>({
  id: "source-mode",
  editor: (settings) => (settings.sourceMode ? [] : [livePreview, renderedBlocks, leavingBlocks]),
});

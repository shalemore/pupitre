import { defineTrustedPlugin } from "@pupitre/plugin-sdk/trusted";
import type { Settings } from "@pupitre/settings";
import { focusMode, scrollToHoldLine, typewriterMode } from "./modes";

type WritingModesSettings = Pick<
  Settings,
  | "animations"
  | "focusMode"
  | "focusModeGrain"
  | "typewriterMode"
  | "typewriterPosition"
  | "typewriterFixed"
>;

/** Focus mode and typewriter mode, each on only while its setting is. */
export const writingModes = defineTrustedPlugin<WritingModesSettings>({
  id: "writing-modes",
  editor: (value) => [
    value.focusMode ? focusMode(value.focusModeGrain) : [],
    value.typewriterMode
      ? typewriterMode(value.typewriterPosition, value.typewriterFixed, value.animations)
      : [],
  ],
  restoresScroll: (value) => !value.typewriterMode,
  onSettingsChanged: (view, value, previous) => {
    const held = (settings: WritingModesSettings) =>
      settings.typewriterMode && settings.typewriterFixed ? settings.typewriterPosition : false;
    const position = held(value);
    if (position && held(previous) !== position) {
      scrollToHoldLine(view, view.state.selection.main.head, position, value.animations);
    }
  },
});

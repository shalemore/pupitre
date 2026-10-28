import { WidgetType } from "@codemirror/view";
import { Emoji, type MarkdownConfig } from "@lezer/markdown";
import { nameToEmoji } from "gemoji";

/** The parser of `:name:` shortcodes, without the syntax color that Lezer gives its nodes: text such as 12:30:45 holds some. */
export const emojiSyntax: MarkdownConfig = { ...Emoji, defineNodes: ["Emoji"] };

/** The emoji a `:name:` shortcode stands for; names that are not emoji, such as the 30 in 12:30:45, give nothing. */
export function emojiFor(shortcode: string): string | undefined {
  const name = shortcode.slice(1, -1);
  return Object.hasOwn(nameToEmoji, name) ? nameToEmoji[name] : undefined;
}

export class EmojiWidget extends WidgetType {
  constructor(readonly emoji: string) {
    super();
  }

  override eq(other: EmojiWidget): boolean {
    return other.emoji === this.emoji;
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.textContent = this.emoji;
    return span;
  }
}

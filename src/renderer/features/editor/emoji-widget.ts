import { WidgetType } from "@codemirror/view";

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

import { WidgetType } from "@codemirror/view";

/** The localized alert title that stands in place of its marker while the source is hidden. */
export class AlertTitleWidget extends WidgetType {
  constructor(readonly title: string) {
    super();
  }

  override eq(other: AlertTitleWidget): boolean {
    return other.title === this.title;
  }

  toDOM(): HTMLElement {
    const title = document.createElement("span");
    title.className = "md-alert-title";
    title.textContent = this.title;
    return title;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

import { Facet } from "@codemirror/state";
import { WidgetType } from "@codemirror/view";

/**
 * GitHub alerts: a quote whose first line is `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` or
 * `[!CAUTION]`, alone on that line. The live preview tints the quote and, away from the
 * selection, shows an icon and a localized title in place of the marker.
 */

export interface AlertTitles {
  note: string;
  tip: string;
  important: string;
  warning: string;
  caution: string;
}

export type AlertType = keyof AlertTitles;

const ALERT_MARKER = /^\[!(note|tip|important|warning|caution)\]\s*$/i;

/** The localized titles, provided by the editor from the interface language. */
export const alertTitles = Facet.define<AlertTitles, AlertTitles | undefined>({
  combine: (values) => values[0],
});

function isAlertType(value: string | undefined): value is AlertType {
  return (
    value === "note" ||
    value === "tip" ||
    value === "important" ||
    value === "warning" ||
    value === "caution"
  );
}

/** The alert type of a quote's first line of text, if it is an alert marker. */
export function alertType(firstLine: string): AlertType | undefined {
  const type = ALERT_MARKER.exec(firstLine)?.[1]?.toLowerCase();
  return isAlertType(type) ? type : undefined;
}

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

import type { UpdateStatus } from "@shared/desktop-api";
import type { TranslationSchema } from "@shared/i18n";

/** The words the update button uses, so a test needs no dictionary of its own. */
export type UpdateLabels = Pick<
  TranslationSchema["settings"],
  "checkingForUpdates" | "downloadUpdate" | "checkForUpdates"
>;

export interface UpdateAction {
  /** The channel the header button asks for. */
  readonly command: "updater:check" | "updater:download";
  readonly label: string;
  readonly icon: "refresh" | "download";
  readonly disabled: boolean;
  /** Whether the refresh icon turns while the status holds. */
  readonly spinning: boolean;
}

/** What the header button offers for a status; the panel reads the same status beside it. */
export function updateActionOf(status: UpdateStatus, labels: UpdateLabels): UpdateAction {
  switch (status.kind) {
    case "checking":
      return {
        command: "updater:check",
        label: labels.checkingForUpdates,
        icon: "refresh",
        disabled: true,
        spinning: true,
      };
    case "available":
      return {
        command: "updater:download",
        label: labels.downloadUpdate,
        icon: "download",
        disabled: false,
        spinning: false,
      };
    case "downloading":
      return {
        command: "updater:download",
        label: labels.downloadUpdate,
        icon: "download",
        disabled: true,
        spinning: false,
      };
    default:
      return {
        command: "updater:check",
        label: labels.checkForUpdates,
        icon: "refresh",
        disabled: false,
        spinning: false,
      };
  }
}

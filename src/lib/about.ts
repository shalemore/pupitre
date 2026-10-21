import { t } from "@/i18n";
import { isTauri } from "@/lib/platform";
import pkg from "../../package.json";

export interface AboutInfo {
  name: string;
  version: string;
  date: string;
  os: string;
  platform: string;
  engine: string;
  userAgent: string;
}

export function getAboutInfo(): AboutInfo {
  const version = pkg.version;
  const date = "2026-10-21";
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "Unknown";
  const platform = typeof navigator !== "undefined" ? navigator.platform : "Unknown";

  let os = platform;
  if (/Win/i.test(userAgent) || /Win/i.test(platform)) {
    os = "Windows_NT";
  } else if (/Mac/i.test(userAgent) || /Mac/i.test(platform)) {
    os = "Darwin (macOS)";
  } else if (/Linux/i.test(userAgent)) {
    os = "Linux";
  }

  return {
    name: "Pupitre",
    version,
    date,
    os,
    platform,
    engine: "Tauri 2.0 / WebKit (WebView2)",
    userAgent,
  };
}

export function formatAboutText(info: AboutInfo = getAboutInfo()): string {
  return [
    info.name,
    "",
    `Version: ${info.version}`,
    `Date: ${info.date}`,
    `OS: ${info.os} (${info.platform})`,
    `Engine: ${info.engine}`,
    `User Agent: ${info.userAgent}`,
  ].join("\n");
}

/**
 * Open the native system about dialog if running inside Tauri.
 * Returns true if the native dialog was successfully shown, or false to fallback to in-app dialog.
 */
export async function openNativeAboutDialog(): Promise<boolean> {
  if (!isTauri()) {
    return false;
  }

  try {
    const { message } = await import("@tauri-apps/plugin-dialog");
    const info = getAboutInfo();
    const infoText = formatAboutText(info);
    const copyLabel = t().dialogs.copyButton;
    const okLabel = t().dialogs.okButton;

    const result = await message(infoText, {
      title: info.name,
      kind: "info",
      buttons: {
        ok: okLabel,
        cancel: copyLabel,
      },
    });

    if (result === copyLabel || result === "Cancel") {
      try {
        await navigator.clipboard.writeText(infoText);
      } catch (copyErr) {
        console.error("Failed to copy about info to clipboard:", copyErr);
      }
    }

    return true;
  } catch (err) {
    console.warn("Failed to open native about dialog, falling back to modal:", err);
    return false;
  }
}

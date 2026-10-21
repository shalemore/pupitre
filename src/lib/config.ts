import { createSignal } from "solid-js";
import type { LanguageSetting } from "@/i18n/types";
import { isTauri } from "@/lib/platform";

export type EditorWidth = "compact" | "normal" | "wide" | "full";
export type FontFamilyOption = "sans" | "mono" | "serif" | string;

export interface PupitreConfig {
  theme: "system" | "light" | "dark";
  locale: LanguageSetting;
  fontSize: number;
  lineHeight: number;
  fontFamily: FontFamilyOption;
  fallbackFont?: string | undefined;
  tabSize: number;
  wordWrap: boolean;
  editorWidth: EditorWidth;
  sidebarVisible: boolean;
  autoSave: boolean;
  recentFiles: string[];
}

export const DEFAULT_CONFIG: PupitreConfig = {
  theme: "system",
  locale: "auto",
  fontSize: 15,
  lineHeight: 1.75,
  fontFamily: "sans",
  fallbackFont: "",
  tabSize: 2,
  wordWrap: true,
  editorWidth: "normal",
  sidebarVisible: true,
  autoSave: false,
  recentFiles: [],
};

const STORAGE_KEY = "pupitre-config";
const BROADCAST_CHANNEL_NAME = "pupitre-config-sync";

let broadcastChannel: BroadcastChannel | null = null;
if (typeof BroadcastChannel !== "undefined") {
  try {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  } catch {
    // ignore
  }
}

export async function getConfigFilePath(): Promise<string | null> {
  if (isTauri()) {
    try {
      const { homeDir } = await import("@tauri-apps/api/path");
      const home = await homeDir();
      const sep = home.includes("\\") ? "\\" : "/";
      const cleanHome = home.replace(/[\\/]+$/, "");
      return `${cleanHome}${sep}.pupitre${sep}config.json`;
    } catch (e) {
      console.error("Failed to resolve user home directory:", e);
      return null;
    }
  }
  return null;
}

async function ensureConfigDir(filePath: string): Promise<void> {
  const { exists, mkdir } = await import("@tauri-apps/plugin-fs");
  const dir = filePath.replace(/[\\/][^\\/]+$/, "");
  const dirExists = await exists(dir);
  if (!dirExists) {
    await mkdir(dir, { recursive: true });
  }
}

export async function loadConfig(): Promise<PupitreConfig> {
  const filePath = await getConfigFilePath();
  if (filePath && isTauri()) {
    try {
      const { exists, readTextFile } = await import("@tauri-apps/plugin-fs");
      const fileExists = await exists(filePath);
      if (fileExists) {
        const raw = await readTextFile(filePath);
        const parsed = JSON.parse(raw);
        const merged = { ...DEFAULT_CONFIG, ...parsed };
        setConfig(merged);
        return merged;
      }
      await saveConfig(DEFAULT_CONFIG);
      return DEFAULT_CONFIG;
    } catch (e) {
      console.warn("Could not load config file, falling back to defaults:", e);
    }
  }

  if (typeof localStorage !== "undefined") {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const merged = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
        setConfig(merged);
        return merged;
      } catch {
        // ignore JSON parse error
      }
    }
  }

  return DEFAULT_CONFIG;
}

export async function saveConfig(cfg: PupitreConfig): Promise<void> {
  const filePath = await getConfigFilePath();
  if (filePath && isTauri()) {
    try {
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      await ensureConfigDir(filePath);
      await writeTextFile(filePath, JSON.stringify(cfg, null, 2));
    } catch (e) {
      console.error("Failed to write configuration file:", e);
    }
  }

  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  }
}

export const [config, setConfig] = createSignal<PupitreConfig>(DEFAULT_CONFIG);

export async function updateConfig(partial: Partial<PupitreConfig>): Promise<void> {
  const updated = { ...config(), ...partial };
  setConfig(updated);
  await saveConfig(updated);

  if (isTauri()) {
    try {
      const { emit } = await import("@tauri-apps/api/event");
      await emit("pupitre-config-changed", updated);
    } catch (e) {
      console.warn("Failed to emit config change event:", e);
    }
  }

  try {
    // oxlint-disable-next-line unicorn/require-post-message-target-origin
    broadcastChannel?.postMessage(updated);
  } catch {
    // ignore
  }
}

/**
 * Setup listener for cross-window config synchronization.
 */
export function setupConfigSync(onSync: (cfg: PupitreConfig) => void): () => void {
  let unlistenTauri: (() => void) | null = null;

  if (isTauri()) {
    import("@tauri-apps/api/event").then(({ listen }) => {
      listen<PupitreConfig>("pupitre-config-changed", (event) => {
        if (event.payload) {
          setConfig(event.payload);
          onSync(event.payload);
        }
      }).then((fn) => {
        unlistenTauri = fn;
      });
    });
  }

  const handleBroadcast = (event: MessageEvent<PupitreConfig>) => {
    if (event.data) {
      setConfig(event.data);
      onSync(event.data);
    }
  };

  broadcastChannel?.addEventListener("message", handleBroadcast);

  return () => {
    unlistenTauri?.();
    broadcastChannel?.removeEventListener("message", handleBroadcast);
  };
}

export async function addRecentFile(filePath: string): Promise<void> {
  if (!filePath) return;
  const current = config().recentFiles.filter((p) => p !== filePath);
  const updated = [filePath, ...current].slice(0, 10);
  await updateConfig({ recentFiles: updated });
}

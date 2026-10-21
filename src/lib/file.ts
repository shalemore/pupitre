import { t } from "@/i18n";
import { isTauri } from "@/lib/platform";

export interface OpenedFile {
  path: string | null;
  name: string;
  content: string;
}

export async function openFileDialog(): Promise<OpenedFile | null> {
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");

    const selected = await open({
      multiple: false,
      directory: false,
      filters: [
        {
          name: "Markdown",
          extensions: ["md", "markdown", "txt"],
        },
      ],
    });

    if (!selected || typeof selected !== "string") {
      return null;
    }

    const content = await readTextFile(selected);
    const fileName = selected.split(/[\\/]/).pop() || t().common.untitledFileName;
    return {
      path: selected,
      name: fileName,
      content,
    };
  }

  if ("showOpenFilePicker" in window) {
    try {
      const [handle] = await (
        window as unknown as {
          showOpenFilePicker: (opt: unknown) => Promise<FileSystemFileHandle[]>;
        }
      ).showOpenFilePicker({
        types: [
          {
            description: "Markdown",
            accept: { "text/markdown": [".md", ".markdown", ".txt"] },
          },
        ],
      });
      if (!handle) return null;
      const file = await handle.getFile();
      const content = await file.text();
      return {
        path: null,
        name: file.name,
        content,
      };
    } catch {
      return null;
    }
  }

  return null;
}

export async function readFileFromPath(path: string): Promise<OpenedFile> {
  if (isTauri()) {
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const content = await readTextFile(path);
    const fileName = path.split(/[\\/]/).pop() || t().common.untitledFileName;
    return {
      path,
      name: fileName,
      content,
    };
  }
  throw new Error("Direct file path reading is only supported in desktop environments");
}

export async function saveFileDialog(
  currentPath: string | null,
  content: string,
): Promise<string | null> {
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");

    let targetPath = currentPath;
    if (!targetPath) {
      const selected = await save({
        filters: [
          {
            name: "Markdown",
            extensions: ["md"],
          },
        ],
        defaultPath: t().common.untitledFileName,
      });
      if (!selected || typeof selected !== "string") {
        return null;
      }
      targetPath = selected;
    }

    await writeTextFile(targetPath, content.endsWith("\n") ? content : content + "\n");
    return targetPath;
  }

  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const fallbackName = t().common.untitledFileName;
  a.href = url;
  a.download = currentPath ? currentPath.split(/[\\/]/).pop() || fallbackName : fallbackName;
  a.click();
  URL.revokeObjectURL(url);
  return null;
}

export async function confirmDiscard(actionText?: string): Promise<boolean> {
  const currentT = t();
  const action = actionText ?? currentT.dialogs.discardActionNew;
  const message = currentT.dialogs.discardConfirm(action);
  if (isTauri()) {
    const { ask } = await import("@tauri-apps/plugin-dialog");
    return await ask(message, {
      title: currentT.common.appName,
      kind: "warning",
    });
  }

  return window.confirm(message);
}

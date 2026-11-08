import type { RpcResult } from "@pupitre/plugin-sdk";
import { contextBridge, ipcRenderer } from "electron";

let nextId = 1;

function isResult(value: unknown): value is RpcResult<unknown> {
  return (
    typeof value === "object" && value !== null && "ok" in value && typeof value.ok === "boolean"
  );
}

/** Asks the host for one thing; a denied call arrives as an error the plugin can catch. */
async function invoke(method: string, params?: unknown): Promise<unknown> {
  const result: unknown = await ipcRenderer.invoke("plugin:rpc", {
    id: nextId++,
    method,
    params,
  });
  if (!isResult(result)) throw new Error("The host sent no answer");
  if (result.ok) return result.value;
  throw new Error(result.error.message);
}

function onSettings(listener: (settings: unknown) => void): void {
  ipcRenderer.on("plugin:settings", (_event, settings: unknown) => listener(settings));
}

contextBridge.exposeInMainWorld("__pupitre", { invoke, onSettings });

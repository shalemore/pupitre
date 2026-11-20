import { app } from "electron";

/**
 * Lets MacType and similar font renderers hook into Chromium on Windows.
 *
 * Chromium enables "renderer code integrity", which only lets Microsoft-signed DLLs load into
 * renderer processes, so MacType's injected DLL is rejected and text falls back to the stock
 * ClearType rendering. Turning that one feature off is the same workaround MacType documents for
 * Chrome. It must run before the `ready` event, because Chromium reads switches at startup.
 *
 * This file has no project dependencies and can be copied into any Electron app as is.
 */
export function allowMacTypeInjection(): void {
  if (process.platform !== "win32") return;
  const disabled = app.commandLine.getSwitchValue("disable-features");
  const features = disabled ? `${disabled},RendererCodeIntegrity` : "RendererCodeIntegrity";
  app.commandLine.appendSwitch("disable-features", features);
}

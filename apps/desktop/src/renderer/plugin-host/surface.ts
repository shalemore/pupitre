import type {
  PointerContext,
  PointerSample,
  SurfaceContext,
  SurfaceKind,
  SurfaceSize,
  SurfaceStateMessage,
  SurfaceTheme,
} from "@pupitre/plugin-sdk";
import { isRecord } from "@pupitre/utils";
import { loadScript } from "./load-script";

function isTheme(value: unknown): value is SurfaceTheme {
  return (
    isRecord(value) &&
    (value["mode"] === "light" || value["mode"] === "dark") &&
    typeof value["reducedMotion"] === "boolean" &&
    isRecord(value["colors"]) &&
    Object.values(value["colors"]).every((color) => typeof color === "string")
  );
}

function isPointer(value: unknown): value is PointerSample {
  return (
    isRecord(value) &&
    (value["type"] === "move" ||
      value["type"] === "down" ||
      value["type"] === "up" ||
      value["type"] === "leave") &&
    typeof value["x"] === "number" &&
    typeof value["y"] === "number" &&
    typeof value["buttons"] === "number"
  );
}

function isStateMessage(value: unknown): value is SurfaceStateMessage {
  return (
    isRecord(value) &&
    value["channel"] === "pupitre:surface" &&
    (value["kind"] === "background" || value["kind"] === "pointer") &&
    (value["theme"] === undefined || isTheme(value["theme"])) &&
    (value["pointer"] === undefined || isPointer(value["pointer"]))
  );
}

const query = new URLSearchParams(location.search);
const kindValue = query.get("kind");
const kind: SurfaceKind = kindValue === "pointer" ? "pointer" : "background";
const id = query.get("id") ?? "";
const module = query.get("module") ?? "";

const canvas = document.createElement("canvas");
canvas.style.width = "100%";
canvas.style.height = "100%";
document.body.append(canvas);
const context2d = canvas.getContext("2d");
if (context2d === null) throw new Error("The surface has no canvas context");
const drawing: CanvasRenderingContext2D = context2d;

let currentTheme: SurfaceTheme = { mode: "light", colors: {}, reducedMotion: false };
const resizeListeners = new Set<(size: SurfaceSize) => void>();
const themeListeners = new Set<(theme: SurfaceTheme) => void>();
const pointerListeners = new Set<(sample: PointerSample) => void>();

function size(): SurfaceSize {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
  };
}

function resizeCanvas(): SurfaceSize {
  const current = size();
  canvas.width = Math.max(1, Math.round(current.width * current.dpr));
  canvas.height = Math.max(1, Math.round(current.height * current.dpr));
  drawing.setTransform(current.dpr, 0, 0, current.dpr, 0, 0);
  return current;
}

function listen<T>(listeners: Set<(value: T) => void>, listener: (value: T) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

resizeCanvas();
window.addEventListener("resize", () => {
  const current = resizeCanvas();
  for (const listener of resizeListeners) listener(current);
});

const context: SurfaceContext = {
  kind,
  canvas,
  size,
  theme: () => currentTheme,
  onResize: (listener) => listen(resizeListeners, listener),
  onTheme: (listener) => listen(themeListeners, listener),
};
const pointerContext: PointerContext = {
  ...context,
  kind: "pointer",
  onPointer: (listener) => listen(pointerListeners, listener),
};

window.addEventListener("message", (event) => {
  if (event.source !== window.parent || !isStateMessage(event.data)) return;
  if (event.data.kind !== kind) return;
  if (event.data.theme !== undefined) {
    currentTheme = event.data.theme;
    for (const listener of themeListeners) listener(currentTheme);
  }
  if (event.data.pointer !== undefined && kind === "pointer") {
    for (const listener of pointerListeners) listener(event.data.pointer);
  }
});

/** The plugin bundle runs before the first await, so it registers itself through this global. */
let registered: unknown;
Reflect.set(globalThis, "__pupitreSurfaceRegister", (definition: unknown) => {
  registered = definition;
});

interface SurfaceDefinition {
  setup(context: SurfaceContext | PointerContext): void | (() => void);
}

function isSurfaceDefinition(value: unknown): value is SurfaceDefinition {
  return isRecord(value) && typeof value["setup"] === "function";
}

await loadScript(new URL(module, `pupitre-plugin://${id}/`).href);
if (!isSurfaceDefinition(registered)) throw new Error("The plugin did not register a surface");
const cleanup = registered.setup(kind === "pointer" ? pointerContext : context);
window.addEventListener("pagehide", () => {
  if (typeof cleanup === "function") cleanup();
});

window.parent.postMessage({ channel: "pupitre:surface", type: "ready", kind }, "*");

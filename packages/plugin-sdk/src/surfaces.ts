export type SurfaceKind = "background" | "pointer";

export interface SurfaceSize {
  width: number;
  height: number;
  /** The device pixel ratio the canvas is sized for. */
  dpr: number;
}

export interface SurfaceTheme {
  mode: "light" | "dark";
  /** The theme's semantic colors, as CSS color strings the canvas can parse. */
  colors: Readonly<Record<string, string>>;
  reducedMotion: boolean;
}

/** What every visual surface receives. The host owns the page, the canvas and its lifetime. */
export interface SurfaceContext {
  readonly kind: SurfaceKind;
  /** Already sized for `size()`, with a context of its own. Drawing belongs to the plugin. */
  readonly canvas: HTMLCanvasElement;
  size(): SurfaceSize;
  theme(): SurfaceTheme;
  onResize(listener: (size: SurfaceSize) => void): () => void;
  onTheme(listener: (theme: SurfaceTheme) => void): () => void;
}

export type PointerKind = "move" | "down" | "up" | "leave";

export interface PointerSample {
  type: PointerKind;
  /** CSS pixels from the top-left corner of the window. */
  x: number;
  y: number;
  buttons: number;
}

export interface PointerContext extends SurfaceContext {
  onPointer(listener: (sample: PointerSample) => void): () => void;
}

export interface BackgroundDefinition {
  /** Draws on the canvas; the returned function releases whatever setup acquired. */
  setup(context: SurfaceContext): void | (() => void);
}

export interface PointerDefinition {
  /** Draws above the window; the layer never takes a pointer event. */
  setup(context: PointerContext): void | (() => void);
}

type Register = (definition: unknown) => void;

function isRegister(value: unknown): value is Register {
  return typeof value === "function";
}

function register(definition: unknown): void {
  const target: unknown = Reflect.get(globalThis, "__pupitreSurfaceRegister");
  if (isRegister(target)) target(definition);
}

/** Names the drawing a background module provides; the host runs it behind the document. */
export function defineBackground(definition: BackgroundDefinition): BackgroundDefinition {
  register(definition);
  return definition;
}

/** Names the drawing a pointer module provides; the host runs it over the window. */
export function definePointer(definition: PointerDefinition): PointerDefinition {
  register(definition);
  return definition;
}

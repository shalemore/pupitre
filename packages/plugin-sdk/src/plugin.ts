import type { z } from "zod";
import type { PluginSettings } from "./settings";

/** Text the host shows: one string, or an English fallback and translations keyed by locale. */
export type LocalizedText = string | ({ en: string } & Partial<Record<string, string>>);

/** A range in the document the editor counts in the code points of its own text. */
export interface PluginSelection {
  from: number;
  to: number;
  text: string;
}

/** The open document. Each method needs the permission named beside it. */
export interface PluginDocument {
  /** The whole Markdown source. `document:read`. */
  read(): Promise<string>;
  /** Replaces the whole document, keeping the undo history. `document:write`. */
  replace(text: string): Promise<void>;
  /** Replaces the selection, or inserts at the caret when nothing is selected. `document:write`. */
  insert(text: string): Promise<void>;
  /** The selection, or the caret as an empty range; null when no document is open. `editor:selection`. */
  selection(): Promise<PluginSelection | null>;
}

export interface PluginEditor {
  /** Brings a line into view; one-based, as editors count them. `editor:scroll`. */
  scrollToLine(line: number): Promise<void>;
}

export interface PluginClipboard {
  read(): Promise<string>;
  write(text: string): Promise<void>;
}

export interface PluginNotifications {
  show(message: LocalizedText): void;
}

/** A small JSON store of the plugin's own, kept across restarts. */
export interface PluginStorage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface PluginResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

/** HTTPS only; the request runs in the host, never in the plugin's sandbox. */
export interface PluginNetwork {
  fetch(
    url: string,
    init?: { method?: string; headers?: Record<string, string>; body?: string },
  ): Promise<PluginResponse>;
}

/**
 * What a plugin can do besides drawing. Every field is a broker the host checks against the
 * permissions the user granted; the plugin never reaches the editor or the file system itself.
 */
export interface PluginContext {
  readonly document: PluginDocument;
  readonly editor: PluginEditor;
  readonly clipboard: PluginClipboard;
  readonly notifications: PluginNotifications;
  readonly storage: PluginStorage;
  readonly network: PluginNetwork;
}

export interface PluginCommand {
  /** Unique within the plugin; the host namespaces it, so two plugins may reuse a name. */
  id: string;
  title: LocalizedText;
  run(context: PluginContext): void | Promise<void>;
}

export interface PluginDefinition<S extends PluginSettings = PluginSettings> {
  /** The settings the plugin reads; the host renders and stores them. */
  settings?: S;
  /** Commands the host lists in the palette and the Plugins menu. */
  commands?: readonly PluginCommand[];
  activate(context: PluginContext, settings: z.infer<S>): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}

/** The host page sets this global before it loads a plugin bundle. */
type Register = (plugin: unknown) => void;

function isRegister(value: unknown): value is Register {
  return typeof value === "function";
}

/**
 * Names a plugin and hands it to the host that is loading it. The call is a no-op outside a
 * host, so a built-in plugin can be imported like any other module.
 */
export function definePlugin<S extends PluginSettings>(
  definition: PluginDefinition<S>,
): PluginDefinition<S> {
  const register: unknown = Reflect.get(globalThis, "__pupitreRegister");
  if (isRegister(register)) register(definition);
  return definition;
}

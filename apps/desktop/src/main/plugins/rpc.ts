import { join } from "node:path";
import {
  localizedTextSchema,
  localize,
  rpcFailure,
  type Permission,
  type PluginManifest,
  type RpcResult,
} from "@pupitre/plugin-sdk";
import { messageOf } from "@pupitre/utils";
import { clipboard, ipcMain, net, Notification } from "electron";
import { z } from "zod";
import { currentLocale } from "../i18n";
import { requestDocument } from "./document-bridge";
import { pluginIdForSender } from "./host";
import { pluginsFolder } from "./paths";
import {
  pluginCommandSchema,
  readPlugin,
  readSettingsValues,
  settingsMetaSchema,
  writeCommands,
  writeSettingsMeta,
  writeSettingsValues,
  type StoredSettingsMeta,
} from "./plugin-files";
import { deleteValue, getValue, setValue } from "./storage";

/** The permission each method needs; a method not named here cannot be called. */
const PERMISSIONS = {
  "document.read": "document:read",
  "document.replace": "document:write",
  "document.insert": "document:write",
  "document.selection": "editor:selection",
  "editor.scrollToLine": "editor:scroll",
  "clipboard.read": "clipboard:read",
  "clipboard.write": "clipboard:write",
  "notifications.show": "notifications",
  "storage.get": "storage",
  "storage.set": "storage",
  "storage.delete": "storage",
  "network.fetch": "network",
} as const satisfies Record<string, Permission>;

/** Methods the app itself calls through the same bridge; they need no permission. */
const HOST_METHODS = ["host.settings", "host.commands", "settings.get"] as const;

type HostMethod = (typeof HOST_METHODS)[number];
type Method = keyof typeof PERMISSIONS | HostMethod;

function isMethod(value: string): value is Method {
  return Object.hasOwn(PERMISSIONS, value) || HOST_METHODS.some((method) => method === value);
}

function isPermissionMethod(method: Method): method is keyof typeof PERMISSIONS {
  return Object.hasOwn(PERMISSIONS, method);
}

const textParams = z.object({ text: z.string() });
const lineParams = z.object({ line: z.number().int().positive() });
const keyParams = z.object({ key: z.string().min(1).max(256) });
const valueParams = keyParams.extend({ value: z.unknown() });
const notificationParams = z.object({ message: localizedTextSchema });
/** The stored metadata plus the defaults the host keeps only on the first report. */
const settingsMetaParams = settingsMetaSchema.extend({
  defaults: z.record(z.string(), z.unknown()).optional(),
});
const networkParams = z.object({
  url: z.string(),
  init: z
    .object({
      method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]).optional(),
      headers: z.record(z.string(), z.string()).optional(),
      body: z.string().optional(),
    })
    .optional(),
});

/** How much a plugin may read from one response, and how long it may wait for it. */
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const NETWORK_TIMEOUT_MS = 10_000;

const requestSchema = z.object({
  id: z.number().int(),
  method: z.string(),
  params: z.unknown(),
});

async function execute(
  id: string,
  manifest: PluginManifest,
  method: Method,
  params: unknown,
): Promise<unknown> {
  const folder = join(pluginsFolder(), id);
  switch (method) {
    case "document.read":
      return requestDocument({ method: "read" });
    case "document.replace":
      return requestDocument({ method: "replace", text: textParams.parse(params).text });
    case "document.insert":
      return requestDocument({ method: "insert", text: textParams.parse(params).text });
    case "document.selection":
      return requestDocument({ method: "selection" });
    case "editor.scrollToLine":
      return requestDocument({ method: "scrollToLine", line: lineParams.parse(params).line });
    case "clipboard.read":
      return clipboard.readText();
    case "clipboard.write":
      await clipboard.writeText(textParams.parse(params).text);
      return undefined;
    case "notifications.show": {
      const message = localize(notificationParams.parse(params).message, currentLocale());
      if (Notification.isSupported()) {
        new Notification({ title: localize(manifest.name, currentLocale()), body: message }).show();
      }
      return undefined;
    }
    case "storage.get":
      return getValue(folder, keyParams.parse(params).key);
    case "storage.set": {
      const { key, value } = valueParams.parse(params);
      setValue(folder, key, value);
      return undefined;
    }
    case "storage.delete":
      deleteValue(folder, keyParams.parse(params).key);
      return undefined;
    case "network.fetch":
      return fetchUrl(networkParams.parse(params));
    case "host.settings": {
      const meta = settingsMetaParams.parse(params);
      const stored: StoredSettingsMeta = { schema: meta.schema };
      if (meta.title !== undefined) stored.title = meta.title;
      if (meta.description !== undefined) stored.description = meta.description;
      if (meta.fields !== undefined) stored.fields = meta.fields;
      writeSettingsMeta(folder, stored);
      if (Object.keys(readSettingsValues(folder)).length === 0 && meta.defaults !== undefined) {
        writeSettingsValues(folder, meta.defaults);
      }
      return undefined;
    }
    case "host.commands": {
      const { commands } = z.object({ commands: z.array(pluginCommandSchema) }).parse(params);
      writeCommands(folder, commands);
      return undefined;
    }
    case "settings.get":
      return readSettingsValues(join(pluginsFolder(), id));
  }
}

async function fetchUrl(params: z.infer<typeof networkParams>): Promise<unknown> {
  const url = new URL(params.url);
  if (url.protocol !== "https:") throw new Error("Only https URLs can be fetched");
  const init = params.init;
  const request: NonNullable<Parameters<typeof net.fetch>[1]> = {
    method: init?.method ?? "GET",
    signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
  };
  if (init?.headers !== undefined) request.headers = init.headers;
  if (init?.body !== undefined) request.body = init.body;
  const response = await net.fetch(url.href, request);
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_RESPONSE_BYTES) throw new Error("The response is too large");
  const body = await response.text();
  if (Buffer.byteLength(body, "utf8") > MAX_RESPONSE_BYTES) {
    throw new Error("The response is too large");
  }
  return { status: response.status, headers: Object.fromEntries(response.headers), body };
}

async function run(id: string, method: Method, params: unknown): Promise<RpcResult<unknown>> {
  const plugin = readPlugin(join(pluginsFolder(), id));
  if (plugin === undefined) return rpcFailure("denied", "The plugin is not installed");
  if (!plugin.enabled) return rpcFailure("denied", "The plugin is not enabled");
  if (isPermissionMethod(method)) {
    const permission = PERMISSIONS[method];
    const allowed =
      plugin.manifest.permissions.includes(permission) && plugin.granted.includes(permission);
    if (!allowed) return rpcFailure("denied", `The plugin was not granted ${permission}`);
  }
  try {
    return { ok: true, value: await execute(id, plugin.manifest, method, params) };
  } catch (error: unknown) {
    return rpcFailure("internal", messageOf(error));
  }
}

/** The only way a plugin page reaches the app: every call names a method, a sender and a grant. */
export function registerPluginRpc(): void {
  ipcMain.handle("plugin:rpc", async (event, value: unknown): Promise<RpcResult<unknown>> => {
    const id = pluginIdForSender(event.sender);
    if (id === undefined) return rpcFailure("denied", "This page is not a plugin");
    const request = requestSchema.safeParse(value);
    if (!request.success) return rpcFailure("invalid", "The request is malformed");
    if (!isMethod(request.data.method)) {
      return rpcFailure("unsupported", `Unknown method: ${request.data.method}`);
    }
    return run(id, request.data.method, request.data.params);
  });
}

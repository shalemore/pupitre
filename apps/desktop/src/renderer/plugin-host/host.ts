import type {
  PluginBridge,
  PluginContext,
  PluginDefinition,
  PluginResponse,
  PluginSelection,
} from "@pupitre/plugin-sdk";
import { isRecord } from "@pupitre/utils";
import { z } from "zod";
import { loadScript } from "./load-script";

function isBridge(value: unknown): value is PluginBridge {
  return isRecord(value) && typeof value["invoke"] === "function";
}

function isDefinition(value: unknown): value is PluginDefinition {
  return isRecord(value) && typeof value["activate"] === "function";
}

function isSelection(value: unknown): value is PluginSelection {
  return (
    isRecord(value) &&
    typeof value["from"] === "number" &&
    typeof value["to"] === "number" &&
    typeof value["text"] === "string"
  );
}

function isHeaders(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === "string");
}

function isResponse(value: unknown): value is PluginResponse {
  return (
    isRecord(value) &&
    typeof value["status"] === "number" &&
    isHeaders(value["headers"]) &&
    typeof value["body"] === "string"
  );
}

const bridgeValue: unknown = Reflect.get(globalThis, "__pupitre");
if (!isBridge(bridgeValue)) throw new Error("The plugin host bridge is missing");
const bridge: PluginBridge = bridgeValue;

/** The plugin bundle runs before the first await, so it registers itself through this global. */
let registered: unknown;
Reflect.set(globalThis, "__pupitreRegister", (definition: unknown) => {
  registered = definition;
});

const query = new URLSearchParams(location.search);
const id = query.get("id");
const main = query.get("main");
if (id === null || main === null) throw new Error("The plugin host URL is incomplete");

async function text(method: string, params?: unknown): Promise<string> {
  const value = await bridge.invoke(method, params);
  if (typeof value !== "string") throw new Error(`${method} did not return text`);
  return value;
}

async function selection(): Promise<PluginSelection | null> {
  const value = await bridge.invoke("document.selection");
  if (value === null) return null;
  if (!isSelection(value)) throw new Error("document.selection did not return a selection");
  return value;
}

const context: PluginContext = {
  document: {
    read: () => text("document.read"),
    replace: async (value) => {
      await bridge.invoke("document.replace", { text: value });
    },
    insert: async (value) => {
      await bridge.invoke("document.insert", { text: value });
    },
    selection,
  },
  editor: {
    scrollToLine: async (line) => {
      await bridge.invoke("editor.scrollToLine", { line });
    },
  },
  clipboard: {
    read: () => text("clipboard.read"),
    write: async (value) => {
      await bridge.invoke("clipboard.write", { text: value });
    },
  },
  notifications: {
    show: (message) => {
      void bridge.invoke("notifications.show", { message }).catch((error: unknown) => {
        console.error("The notification could not be shown", error);
      });
    },
  },
  storage: {
    get: (key) => bridge.invoke("storage.get", { key }),
    set: async (key, value) => {
      await bridge.invoke("storage.set", { key, value });
    },
    delete: async (key) => {
      await bridge.invoke("storage.delete", { key });
    },
  },
  network: {
    fetch: async (url, init) => {
      const value = await bridge.invoke("network.fetch", { url, init });
      if (!isResponse(value)) throw new Error("network.fetch did not return a response");
      return value;
    },
  },
};

await loadScript(new URL(main, `pupitre-plugin://${id}/`).href);
const definition = registered;
if (!isDefinition(definition)) throw new Error("The plugin did not register a definition");

// The schema and the words around it belong to the plugin; the app only stores and draws them
const settings = definition.settings;
if (settings !== undefined) {
  await bridge.invoke("host.settings", {
    schema: z.toJSONSchema(settings.schema, { io: "input" }),
    title: settings.title,
    description: settings.description,
    fields: settings.fields,
    defaults: settings.schema.parse({}),
  });
}

if (definition.commands !== undefined && definition.commands.length > 0) {
  await bridge.invoke("host.commands", {
    commands: definition.commands.map((command) => ({ id: command.id, title: command.title })),
  });
}

const declared = definition.settings;
/** The settings file is the user's to edit, so it is parsed before the plugin sees it. */
function valuesFrom(value: unknown): Record<string, unknown> {
  if (declared === undefined) return {};
  const parsed = declared.schema.safeParse(isRecord(value) ? value : {});
  if (parsed.success) return parsed.data;
  console.error("The plugin settings do not match its schema", parsed.error);
  return declared.schema.parse({});
}

await definition.activate(context, valuesFrom(await bridge.invoke("settings.get")));

bridge.onCommand((commandId) => {
  const command = definition.commands?.find((entry) => entry.id === commandId);
  if (command === undefined) return;
  void (async () => {
    try {
      await command.run(context);
    } catch (error: unknown) {
      console.error(`The command ${commandId} failed`, error);
    }
  })();
});

bridge.onSettings((next) => {
  void (async () => {
    try {
      await definition.deactivate?.();
      await definition.activate(context, valuesFrom(next));
    } catch (error: unknown) {
      console.error("The plugin could not apply its settings", error);
    }
  })();
});

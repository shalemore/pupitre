import type { PluginInfo } from "@pupitre/desktop-api";
import { describe, expect, it } from "vitest";
import { pluginCommands } from "./commands";

const plugin: PluginInfo = {
  id: "commander",
  manifest: {
    id: "commander",
    name: { en: "Commander", "zh-CN": "命令测试" },
    version: "1.0.0",
    permissions: [],
  },
  enabled: true,
  granted: [],
  commands: [{ id: "insert", title: { en: "Insert Hello", "zh-CN": "插入问候" } }],
};

describe("pluginCommands", () => {
  it("lists a running plugin's commands under its own name", () => {
    expect(pluginCommands([plugin], "zh-CN")).toEqual([
      {
        kind: "plugin",
        pluginId: "commander",
        id: "insert",
        label: "插入问候",
        parent: "命令测试",
        shortcut: undefined,
      },
    ]);
  });

  it("leaves out a plugin that is not enabled", () => {
    expect(pluginCommands([{ ...plugin, enabled: false }], "zh-CN")).toEqual([]);
  });
});

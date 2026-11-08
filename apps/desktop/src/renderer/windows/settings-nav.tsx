import { desktop } from "@pupitre/desktop-api/client";
import { t } from "@pupitre/i18n/solid";
import { Select, TabsList, TabsTrigger } from "@pupitre/ui";
import pkg from "@root/package.json";
import { FileCode2, Info, Palette, Printer, Puzzle, Settings2, Type } from "lucide-solid";
import { For, Show, type Component } from "solid-js";
import { Dynamic } from "solid-js/web";
import { workspace } from "@/lib/workspace";
import { css } from "@/styled-system/css";

const groupTitle = css({
  paddingInline: "2.5",
  marginBlockStart: "5",
  marginBlockEnd: "1.5",
  textStyle: "2xs",
  fontWeight: "medium",
  color: "muted.foreground",
  "&:first-child": { marginBlockStart: "0" },
});
const footer = css({
  display: "flex",
  alignItems: "center",
  gap: "1",
  marginBlockStart: "auto",
  paddingInline: "2.5",
});
const version = css({ flexShrink: 0, textStyle: "2xs", color: "tertiary" });

/** The settings pages, each group named above its pages. */
const GROUPS = [
  {
    title: () => t().settings.groupApplication,
    pages: [
      { value: "general", icon: Settings2, label: () => t().settings.general },
      { value: "appearance", icon: Palette, label: () => t().settings.appearance },
      { value: "about", icon: Info, label: () => t().settings.about },
    ],
  },
  {
    title: () => t().settings.groupWriting,
    pages: [
      { value: "editor", icon: Type, label: () => t().settings.editor },
      { value: "markdown", icon: FileCode2, label: () => t().settings.markdown },
      { value: "export", icon: Printer, label: () => t().settings.export },
    ],
  },
  {
    title: () => t().settings.groupCustomize,
    pages: [{ value: "plugins", icon: Puzzle, label: () => t().settings.plugins }],
  },
] as const;

/** The settings pages, with the folder scope and the version at the bottom. */
export const SettingsNav: Component = () => (
  <>
    <TabsList>
      <For each={GROUPS}>
        {(group) => (
          <>
            <span class={groupTitle}>{group.title()}</span>
            <For each={group.pages}>
              {(page) => (
                <TabsTrigger value={page.value}>
                  <Dynamic component={page.icon} />
                  <span>{page.label()}</span>
                </TabsTrigger>
              )}
            </For>
          </>
        )}
      </For>
    </TabsList>
    <footer class={footer}>
      <span class={version}>v{pkg.version}</span>
      <Show when={workspace().root}>
        <Select<"global" | "folder">
          variant="ghost"
          value={workspace().active ? "folder" : "global"}
          onChange={(scope) => void desktop.invoke("workspace:use", scope === "folder")}
          options={[
            { value: "global", label: t().settings.scopeGlobal },
            { value: "folder", label: t().settings.scopeFolder },
          ]}
        />
      </Show>
    </footer>
  </>
);

import { FileCode2, FolderOpen, Info, Palette, Printer, Settings2, Type } from "lucide-solid";
import { For, Show, type Component } from "solid-js";
import { Dynamic } from "solid-js/web";
import { IconButton, SegmentedControl, Separator, TabsList, TabsTrigger } from "@/components/ui";
import { t } from "@/i18n";
import { desktop } from "@/lib/desktop";
import { fileNameOf } from "@/lib/file";
import { truncateStyle } from "@/lib/styles";
import { workspace } from "@/lib/workspace";
import { css } from "@/styled-system/css";

const scopeBlock = css({ marginBlockEnd: "3", "& > * + *": { marginBlockStart: "1" } });
const scopeRow = css({ display: "flex", alignItems: "center", gap: "1", paddingInlineStart: "2" });
const scopeName = css(truncateStyle, {
  minWidth: "0",
  flex: "1",
  textStyle: "2xs",
  color: "muted.foreground",
});
const separator = css({ marginBlock: "2" });

/** What each settings page is called and drawn with; the last one stands apart from the rest. */
const SECTIONS = [
  { value: "general", icon: Settings2, label: () => t().settings.general, separated: false },
  { value: "appearance", icon: Palette, label: () => t().settings.appearance, separated: false },
  { value: "editor", icon: Type, label: () => t().settings.editor, separated: false },
  { value: "markdown", icon: FileCode2, label: () => t().settings.markdown, separated: false },
  { value: "export", icon: Printer, label: () => t().settings.export, separated: false },
  { value: "about", icon: Info, label: () => t().settings.about, separated: true },
] as const;

/** The folder's settings, shown while the settings window is using them, or the global ones. */
const WorkspaceScope: Component = () => (
  <Show when={workspace().root}>
    {(root) => (
      <div class={scopeBlock}>
        <SegmentedControl<"global" | "folder">
          value={workspace().active ? "folder" : "global"}
          onChange={(scope) => void desktop.invoke("workspace:use", scope === "folder")}
          options={[
            { value: "global", label: t().settings.scopeGlobal },
            { value: "folder", label: t().settings.scopeFolder },
          ]}
        />
        <div class={scopeRow}>
          <span dir="auto" class={scopeName} title={root()}>
            {fileNameOf(root())}
          </span>
          <Show when={workspace().exists}>
            <IconButton
              label={t().settings.revealSettingsFile}
              size="icon-2xs"
              onClick={() => void desktop.invoke("workspace:reveal")}
            >
              <FolderOpen />
            </IconButton>
          </Show>
        </div>
      </div>
    )}
  </Show>
);

/** The settings pages, and the folder scope when a folder is open. */
export const SettingsNav: Component = () => (
  <>
    <WorkspaceScope />
    <TabsList>
      <For each={SECTIONS}>
        {(section) => (
          <>
            <Show when={section.separated}>
              <Separator class={separator} />
            </Show>
            <TabsTrigger value={section.value}>
              <Dynamic component={section.icon} />
              <span>{section.label()}</span>
            </TabsTrigger>
          </>
        )}
      </For>
    </TabsList>
  </>
);

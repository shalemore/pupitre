import { desktop } from "@pupitre/desktop-api/client";
import { t } from "@pupitre/i18n/solid";
import { IconButton, SegmentedControl, Separator, TabsList, TabsTrigger } from "@pupitre/ui";
import pkg from "@root/package.json";
import {
  FileCode2,
  FolderOpen,
  Info,
  Palette,
  Printer,
  Puzzle,
  Settings2,
  Type,
} from "lucide-solid";
import { For, Show, type Component } from "solid-js";
import { Dynamic } from "solid-js/web";
import { workspace } from "@/lib/workspace";
import { css } from "@/styled-system/css";

const footer = css({
  display: "flex",
  flexDirection: "column",
  gap: "3",
  marginBlockStart: "auto",
  paddingInline: "2.5",
});
const scopeRow = css({ display: "flex", alignItems: "center", gap: "1" });
const scopeControl = css({ flex: "1", minWidth: "0" });
const separator = css({ marginBlock: "2" });
const version = css({ textStyle: "2xs", color: "tertiary" });

/** What each settings page is called and drawn with; a separator opens each group of pages. */
const SECTIONS = [
  { value: "general", icon: Settings2, label: () => t().settings.general, separated: false },
  { value: "appearance", icon: Palette, label: () => t().settings.appearance, separated: false },
  { value: "editor", icon: Type, label: () => t().settings.editor, separated: true },
  { value: "markdown", icon: FileCode2, label: () => t().settings.markdown, separated: false },
  { value: "export", icon: Printer, label: () => t().settings.export, separated: false },
  { value: "plugins", icon: Puzzle, label: () => t().settings.plugins, separated: true },
  { value: "about", icon: Info, label: () => t().settings.about, separated: false },
] as const;

/** The folder's settings, shown while the settings window is using them, or the global ones. */
const WorkspaceScope: Component = () => (
  <Show when={workspace().root}>
    <div class={scopeRow}>
      <SegmentedControl<"global" | "folder">
        class={scopeControl}
        value={workspace().active ? "folder" : "global"}
        onChange={(scope) => void desktop.invoke("workspace:use", scope === "folder")}
        options={[
          { value: "global", label: t().settings.scopeGlobal },
          { value: "folder", label: t().settings.scopeFolder },
        ]}
      />
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
  </Show>
);

/** The settings pages, with the folder scope and the version at the bottom. */
export const SettingsNav: Component = () => (
  <>
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
    <footer class={footer}>
      <WorkspaceScope />
      <span class={version}>v{pkg.version}</span>
    </footer>
  </>
);

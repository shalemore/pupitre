import { desktop } from "@pupitre/desktop-api/client";
import { t } from "@pupitre/i18n/solid";
import { IconButton, SegmentedControl, Separator, TabsList, TabsTrigger } from "@pupitre/ui";
import { truncateStyle } from "@pupitre/ui/styles";
import pkg from "@root/package.json";
import { FileCode2, FolderOpen, Info, Palette, Printer, Settings2, Type } from "lucide-solid";
import { For, Show, type Component } from "solid-js";
import { Dynamic } from "solid-js/web";
import { fileNameOf } from "@/lib/file";
import { workspace } from "@/lib/workspace";
import { css } from "@/styled-system/css";

const brand = css({
  display: "flex",
  alignItems: "center",
  gap: "2.5",
  paddingInline: "2.5",
  marginBlockEnd: "6",
});
const brandLogo = css({
  width: "7",
  height: "7",
  flexShrink: 0,
  borderRadius: "md",
  boxShadow: "sm",
});
const brandName = css({ textStyle: "sm", fontWeight: "semibold", color: "foreground" });
const scopeBlock = css({
  marginBlockEnd: "5",
  padding: "2.5",
  borderRadius: "lg",
  borderWidth: "hairline",
  borderStyle: "solid",
  borderColor: "border.subtle",
  backgroundColor: "surface.1",
  "& > * + *": { marginBlockStart: "2" },
});
const scopeRow = css({ display: "flex", alignItems: "center", gap: "1", paddingInlineStart: "1" });
const scopeName = css(truncateStyle, {
  minWidth: "0",
  flex: "1",
  textStyle: "xs",
  color: "muted.foreground",
});
const separator = css({ marginBlock: "2" });
const version = css({
  marginBlockStart: "auto",
  paddingInline: "2.5",
  textStyle: "2xs",
  color: "tertiary",
});

/** What each settings page is called and drawn with; a separator opens each group of pages. */
const SECTIONS = [
  { value: "general", icon: Settings2, label: () => t().settings.general, separated: false },
  { value: "appearance", icon: Palette, label: () => t().settings.appearance, separated: false },
  { value: "editor", icon: Type, label: () => t().settings.editor, separated: true },
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
    <div class={brand}>
      <img src="./logo.svg" alt="" class={brandLogo} />
      <span class={brandName}>Pupitre</span>
    </div>
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
    <span class={version}>v{pkg.version}</span>
  </>
);

import { makeEventListener } from "@solid-primitives/event-listener";
import { FileCode2, FolderOpen, Info, Palette, Printer, Settings2, Type } from "lucide-solid";
import { createEffect, onMount, Show, type Component } from "solid-js";
import { AppMark } from "@/components/app-mark";
import { TitleBar } from "@/components/title-bar";
import {
  IconButton,
  ScrollView,
  SegmentedControl,
  Separator,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui";
import { AboutSection } from "@/features/settings/about-section";
import { AppearanceSection } from "@/features/settings/appearance-section";
import { EditorSection } from "@/features/settings/editor-section";
import { ExportSection } from "@/features/settings/export-section";
import { GeneralSection } from "@/features/settings/general-section";
import { MarkdownSection } from "@/features/settings/markdown-section";
import { t } from "@/i18n";
import { desktop } from "@/lib/desktop";
import { fileNameOf } from "@/lib/file";
import { settings } from "@/lib/settings";
import { workspace } from "@/lib/workspace";
import { css, cx } from "@/styled-system/css";

const windowFrame = css({
  height: "100vh",
  width: "100vw",
  display: "flex",
  flexDirection: "column",
  color: "foreground",
  userSelect: "none",
  overflow: "hidden",
});
const windowImmersive = css({ backgroundColor: "surface.0" });
const windowClassic = css({ backgroundColor: "surface.1" });
const frameBorderBottom = css({
  borderBlockEndWidth: "1px",
  borderBlockEndStyle: "solid",
  borderBlockEndColor: "border",
});
const frameBorderEnd = css({
  borderInlineEndWidth: "1px",
  borderInlineEndStyle: "solid",
  borderInlineEndColor: "border",
});
const mark = css({ color: "muted.foreground" });
const title = css({ fontWeight: "semibold", color: "foreground", letterSpacing: "wide" });
const tabs = css({ display: "flex", flex: "1", overflow: "hidden" });
const tabsImmersive = css({
  gap: "var(--pref-immersive-gap)",
  paddingBlockEnd: "var(--pref-immersive-gap)",
  paddingInlineEnd: "var(--pref-immersive-gap)",
});
const sidebar = css({ width: "48", flexShrink: 0, padding: "3" });
const sidebarClassic = css({ backgroundColor: "surface.0" });
const scopeBlock = css({ marginBlockEnd: "3", "& > * + *": { marginBlockStart: "1" } });
const scopeRow = css({ display: "flex", alignItems: "center", gap: "1", paddingInlineStart: "2" });
const scopeName = css({
  minWidth: 0,
  flex: "1",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  textStyle: "2xs",
  color: "muted.foreground",
});
const separator = css({ marginBlock: "2" });
const page = css({ flex: "1", padding: "6" });
const pageImmersive = css({
  borderRadius: "lg",
  backgroundColor: "surface.1",
  boxShadow: "sm",
});

export const SettingsWindow: Component = () => {
  const immersive = () => settings().windowStyle === "immersive";
  createEffect(() => {
    document.title = t().settings.title;
  });

  onMount(() => {
    makeEventListener(window, "keydown", (e) => {
      if (e.key === "Escape" && !e.defaultPrevented) window.close();
    });
  });

  return (
    <div class={cx(windowFrame, immersive() ? windowImmersive : windowClassic)}>
      <TitleBar class={cx(!immersive() && frameBorderBottom)}>
        <AppMark class={mark} />
        <span class={title}>{t().settings.title}</span>
      </TitleBar>

      {/* An immersive window shows the page as a card on the window background, like the main window; nothing here folds away */}
      <Tabs
        orientation="vertical"
        defaultValue="general"
        class={cx(tabs, immersive() && tabsImmersive)}
      >
        <aside class={cx(sidebar, !immersive() && cx(frameBorderEnd, sidebarClassic))}>
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
          <TabsList>
            <TabsTrigger value="general">
              <Settings2 />
              <span>{t().settings.general}</span>
            </TabsTrigger>
            <TabsTrigger value="appearance">
              <Palette />
              <span>{t().settings.appearance}</span>
            </TabsTrigger>
            <TabsTrigger value="editor">
              <Type />
              <span>{t().settings.editor}</span>
            </TabsTrigger>
            <TabsTrigger value="markdown">
              <FileCode2 />
              <span>{t().settings.markdown}</span>
            </TabsTrigger>
            <TabsTrigger value="export">
              <Printer />
              <span>{t().settings.export}</span>
            </TabsTrigger>
            <Separator class={separator} />
            <TabsTrigger value="about">
              <Info />
              <span>{t().settings.about}</span>
            </TabsTrigger>
          </TabsList>
        </aside>

        <ScrollView as="main" class={cx(page, immersive() && pageImmersive)}>
          <TabsContent value="general">
            <GeneralSection />
          </TabsContent>
          <TabsContent value="appearance">
            <AppearanceSection />
          </TabsContent>
          <TabsContent value="editor">
            <EditorSection />
          </TabsContent>
          <TabsContent value="markdown">
            <MarkdownSection />
          </TabsContent>
          <TabsContent value="export">
            <ExportSection />
          </TabsContent>
          <TabsContent value="about">
            <AboutSection />
          </TabsContent>
        </ScrollView>
      </Tabs>
    </div>
  );
};

import { t } from "@pupitre/i18n/solid";
import { ScrollView, Tabs, TabsContent } from "@pupitre/ui";
import { makeEventListener } from "@solid-primitives/event-listener";
import { createEffect, onMount, type Component } from "solid-js";
import { PopupLayer } from "@/components/popup-layer";
import { TitleBar } from "@/components/title-bar";
import { AboutSection } from "@/features/settings/about-section";
import { AppearanceSection } from "@/features/settings/appearance-section";
import { EditorSection } from "@/features/settings/editor-section";
import { ExportSection } from "@/features/settings/export-section";
import { GeneralSection } from "@/features/settings/general-section";
import { MarkdownSection } from "@/features/settings/markdown-section";
import { PluginsSection } from "@/features/settings/plugins-section";
import { css, cx } from "@/styled-system/css";
import { SettingsNav } from "./settings-nav";
import { barDivider, windowFrame } from "./window-chrome";

const settingsFrame = css({ userSelect: "none" });
const title = css({ textStyle: "xs", fontWeight: "semibold", color: "foreground" });
const tabs = css({ display: "flex", flex: "1", minHeight: "0", overflow: "hidden" });
const settingsSidebar = css({
  display: "flex",
  width: { base: "52", md: "60" },
  flexShrink: 0,
  flexDirection: "column",
  paddingBlock: "4",
  paddingInline: "3",
  backgroundColor: "surface.0",
  borderInlineEndWidth: "hairline",
  borderInlineEndStyle: "solid",
  borderInlineEndColor: "border",
});
const page = css({
  flex: "1",
  minWidth: "0",
  paddingBlock: { base: "8", md: "10" },
  paddingInline: { base: "6", md: "10" },
});

export const SettingsWindow: Component = () => {
  createEffect(() => {
    document.title = t().settings.title;
  });

  onMount(() => {
    makeEventListener(window, "keydown", (e) => {
      if (e.key === "Escape" && !e.defaultPrevented) window.close();
    });
  });

  return (
    <div class={cx(windowFrame({ immersive: false }), settingsFrame)}>
      <PopupLayer />
      <TitleBar class={barDivider({ classic: true })}>
        <span class={title}>{t().settings.title}</span>
      </TitleBar>

      {/* The settings window keeps the same two panes whatever the window style of the documents is */}
      <Tabs orientation="vertical" defaultValue="general" class={tabs}>
        <aside class={settingsSidebar}>
          <SettingsNav />
        </aside>

        <ScrollView as="main" class={page}>
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
          <TabsContent value="plugins">
            <PluginsSection />
          </TabsContent>
          <TabsContent value="about">
            <AboutSection />
          </TabsContent>
        </ScrollView>
      </Tabs>
    </div>
  );
};

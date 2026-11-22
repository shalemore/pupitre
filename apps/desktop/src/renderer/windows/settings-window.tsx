import { t } from "@pupitre/i18n/solid";
import { cn, ScrollView, Tabs, TabsContent } from "@pupitre/ui";
import { createEffect, onSettled, type Component } from "solid-js";
import { PopupLayer } from "@/components/popup-layer";
import { TitleBar } from "@/components/title-bar";
import { AboutSection } from "@/features/settings/about-section";
import { AppearanceSection } from "@/features/settings/appearance-section";
import { EditorSection } from "@/features/settings/editor-section";
import { ExportSection } from "@/features/settings/export-section";
import { GeneralSection } from "@/features/settings/general-section";
import { MarkdownSection } from "@/features/settings/markdown-section";
import { PluginsSection } from "@/features/settings/plugins-section";
import { listen } from "@/lib/listen";
import { SettingsNav } from "./settings-nav";
import { barDivider, windowFrame } from "./window-chrome";

export const SettingsWindow: Component = () => {
  createEffect(
    () => t().settings.title,
    (pageTitle) => {
      document.title = pageTitle;
    },
  );

  onSettled(() =>
    listen(window, "keydown", (event) => {
      if (event.key === "Escape" && !event.defaultPrevented) window.close();
    }),
  );

  return (
    <div class={cn(windowFrame({ immersive: false }), "select-none")}>
      <PopupLayer />
      <TitleBar class={barDivider({ classic: true })}>
        <span class="text-xs font-semibold text-foreground">{t().settings.title}</span>
      </TitleBar>

      {/* The settings window keeps the same two panes whatever the window style of the documents is */}
      <Tabs
        orientation="vertical"
        defaultValue="general"
        class="flex min-h-0 flex-1 overflow-hidden"
      >
        <aside class="flex w-52 shrink-0 flex-col border-e-hairline border-border bg-surface-0 px-3 py-4 md:w-60">
          <SettingsNav />
        </aside>

        <ScrollView as="main" class="min-w-0 flex-1 px-6 py-8 md:p-10">
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

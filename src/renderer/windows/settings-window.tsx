import { makeEventListener } from "@solid-primitives/event-listener";
import { FileCode2, Info, Palette, Settings2, Type } from "lucide-solid";
import { createEffect, onMount, type Component } from "solid-js";
import { TitleBar } from "@/components/title-bar";
import { ScrollView, Separator, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";
import { AboutSection } from "@/features/settings/about-section";
import { AppearanceSection } from "@/features/settings/appearance-section";
import { EditorSection } from "@/features/settings/editor-section";
import { GeneralSection } from "@/features/settings/general-section";
import { MarkdownSection } from "@/features/settings/markdown-section";
import { cn } from "cn";
import { t } from "@/i18n";
import { settings } from "@/lib/settings";

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
    <div
      class={cn(
        "h-screen w-screen flex flex-col text-foreground select-none overflow-hidden",
        immersive() ? "bg-surface-0" : "bg-surface-1",
      )}
    >
      <TitleBar class={cn("h-10", !immersive() && "border-b border-border")}>
        <img src="./logo.svg" alt="" class="rounded-sm shadow-sm size-4" />
        <span class="font-semibold text-foreground tracking-wide">{t().settings.title}</span>
      </TitleBar>

      {/* An immersive window shows the page as a card on the window background, like the main window; nothing here folds away */}
      <Tabs
        orientation="vertical"
        defaultValue="general"
        class={cn("flex flex-1 overflow-hidden", immersive() && "gap-2 pb-2 pe-2")}
      >
        <aside
          class={cn("w-48 shrink-0 p-3", !immersive() && "border-e border-border bg-surface-0")}
        >
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
            <Separator class="my-2" />
            <TabsTrigger value="about">
              <Info />
              <span>{t().settings.about}</span>
            </TabsTrigger>
          </TabsList>
        </aside>

        <ScrollView
          as="main"
          class={cn("flex-1 p-6", immersive() && "rounded-lg bg-surface-1 shadow-sm")}
        >
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
          <TabsContent value="about">
            <AboutSection />
          </TabsContent>
        </ScrollView>
      </Tabs>
    </div>
  );
};

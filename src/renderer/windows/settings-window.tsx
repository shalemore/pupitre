import { FileCode2, Info, Palette, Settings2, Type } from "lucide-solid";
import { createEffect, onCleanup, onMount, type Component } from "solid-js";
import { TitleBar } from "@/components/title-bar";
import { Separator, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";
import { AboutSection } from "@/features/settings/about-section";
import { AppearanceSection } from "@/features/settings/appearance-section";
import { EditorSection } from "@/features/settings/editor-section";
import { GeneralSection } from "@/features/settings/general-section";
import { MarkdownSection } from "@/features/settings/markdown-section";
import { t } from "@/i18n";

export const SettingsWindow: Component = () => {
  createEffect(() => {
    document.title = t().settings.title;
  });

  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) window.close();
    };
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  return (
    <div class="h-screen w-screen flex flex-col bg-surface-1 text-foreground select-none overflow-hidden">
      <TitleBar>
        <img src="./logo.svg" alt="" class="rounded-sm shadow-sm size-4" />
        <span class="font-semibold text-foreground tracking-wide">{t().settings.title}</span>
      </TitleBar>

      <Tabs orientation="vertical" defaultValue="general" class="flex flex-1 overflow-hidden">
        <aside class="w-48 shrink-0 border-e border-border/80 bg-surface-0/60 p-3">
          <TabsList>
            <TabsTrigger value="general">
              <Settings2 class="size-4 shrink-0" />
              <span>{t().settings.general}</span>
            </TabsTrigger>
            <TabsTrigger value="appearance">
              <Palette class="size-4 shrink-0" />
              <span>{t().settings.appearance}</span>
            </TabsTrigger>
            <TabsTrigger value="editor">
              <Type class="size-4 shrink-0" />
              <span>{t().settings.editor}</span>
            </TabsTrigger>
            <TabsTrigger value="markdown">
              <FileCode2 class="size-4 shrink-0" />
              <span>{t().settings.markdown}</span>
            </TabsTrigger>
            <Separator class="my-2" />
            <TabsTrigger value="about">
              <Info class="size-4 shrink-0" />
              <span>{t().settings.about}</span>
            </TabsTrigger>
          </TabsList>
        </aside>

        <main class="flex-1 overflow-y-auto p-6">
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
        </main>
      </Tabs>
    </div>
  );
};

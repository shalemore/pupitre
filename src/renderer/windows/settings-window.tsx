import { makeEventListener } from "@solid-primitives/event-listener";
import { cn } from "cn";
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
      <TitleBar class={cn(!immersive() && "border-b border-border")}>
        <AppMark class="text-muted-foreground" />
        <span class="font-semibold text-foreground tracking-wide">{t().settings.title}</span>
      </TitleBar>

      {/* An immersive window shows the page as a card on the window background, like the main window; nothing here folds away */}
      <Tabs
        orientation="vertical"
        defaultValue="general"
        class={cn(
          "flex flex-1 overflow-hidden",
          immersive() &&
            "gap-(--pref-immersive-gap) pb-(--pref-immersive-gap) pe-(--pref-immersive-gap)",
        )}
      >
        <aside
          class={cn("w-48 shrink-0 p-3", !immersive() && "border-e border-border bg-surface-0")}
        >
          <Show when={workspace().root}>
            {(root) => (
              <div class="mb-3 space-y-1">
                <SegmentedControl<"global" | "folder">
                  value={workspace().active ? "folder" : "global"}
                  onChange={(scope) => void desktop.invoke("workspace:use", scope === "folder")}
                  options={[
                    { value: "global", label: t().settings.scopeGlobal },
                    { value: "folder", label: t().settings.scopeFolder },
                  ]}
                />
                <div class="flex items-center gap-1 ps-2">
                  <span
                    dir="auto"
                    class="min-w-0 flex-1 truncate text-2xs text-muted-foreground"
                    title={root()}
                  >
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

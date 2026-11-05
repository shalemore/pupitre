import { makeEventListener } from "@solid-primitives/event-listener";
import { createEffect, onMount, type Component } from "solid-js";
import { TitleBar } from "@/components/title-bar";
import { ScrollView, Tabs, TabsContent } from "@/components/ui";
import { AboutSection } from "@/features/settings/about-section";
import { AppearanceSection } from "@/features/settings/appearance-section";
import { EditorSection } from "@/features/settings/editor-section";
import { ExportSection } from "@/features/settings/export-section";
import { GeneralSection } from "@/features/settings/general-section";
import { MarkdownSection } from "@/features/settings/markdown-section";
import { t } from "@/i18n";
import { isImmersive } from "@/lib/settings";
import { cva, css, cx } from "@/styled-system/css";
import { SettingsNav } from "./settings-nav";
import { barDivider, windowFrame } from "./window-chrome";

const settingsFrame = css({ userSelect: "none" });
const title = css({ fontWeight: "semibold", color: "foreground", letterSpacing: "wide" });
const tabs = cva({
  base: { display: "flex", flex: "1", overflow: "hidden" },
  variants: {
    immersive: {
      true: {
        gap: "var(--pref-immersive-gap)",
        paddingBlockEnd: "var(--pref-immersive-gap)",
        paddingInlineEnd: "var(--pref-immersive-gap)",
      },
    },
  },
});
const settingsSidebar = cva({
  base: { width: "48", flexShrink: 0, padding: "3" },
  variants: {
    classic: {
      true: {
        backgroundColor: "surface.0",
        borderInlineEndWidth: "hairline",
        borderInlineEndStyle: "solid",
        borderInlineEndColor: "border",
      },
    },
  },
});
const page = cva({
  base: { flex: "1", padding: "6" },
  variants: {
    immersive: {
      true: { borderRadius: "lg", backgroundColor: "surface.1", boxShadow: "sm" },
    },
  },
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
    <div class={cx(windowFrame({ immersive: isImmersive() }), settingsFrame)}>
      <TitleBar class={barDivider({ classic: !isImmersive() })}>
        <span class={title}>{t().settings.title}</span>
      </TitleBar>

      {/* An immersive window shows the page as a card on the window background, like the main window; nothing here folds away */}
      <Tabs
        orientation="vertical"
        defaultValue="general"
        class={tabs({ immersive: isImmersive() })}
      >
        <aside class={settingsSidebar({ classic: !isImmersive() })}>
          <SettingsNav />
        </aside>

        <ScrollView as="main" class={page({ immersive: isImmersive() })}>
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

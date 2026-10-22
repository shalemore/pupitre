import {
  BookOpen,
  FolderOpen,
  Info,
  Languages,
  Moon,
  Palette,
  RefreshCw,
  Sun,
  SunMoon,
  Type,
} from "lucide-solid";
import { createEffect, createSignal, onCleanup, onMount, type Component } from "solid-js";
import {
  Button,
  Input,
  Select,
  type SelectOption,
  Separator,
  SettingRow,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui";
import { type LanguageSetting, SUPPORTED_LOCALES, t } from "@/i18n";
import { desktop } from "@/lib/desktop";
import { getSystemFontFamilies } from "@/lib/fonts";
import { settings, updateSettings } from "@/lib/settings";
import { THEME_NAMES } from "@/lib/theme";
import type { AnimationSetting, EditorWidth, Settings } from "@shared/settings";
import { cn } from "cn";
import pkg from "../../../../package.json";
import { UpdateButton, UpdateStatusPanel } from "./UpdateSection";

export const SettingsWindow: Component = () => {
  const [activeTab, setActiveTab] = createSignal<string>("appearance");
  const [availableFonts, setAvailableFonts] = createSignal<string[]>([]);
  const [isRefreshingFonts, setIsRefreshingFonts] = createSignal(false);

  const loadFonts = async (forceRefresh = false) => {
    setIsRefreshingFonts(true);
    try {
      const list = await getSystemFontFamilies(forceRefresh);
      setAvailableFonts(list);
    } catch (err) {
      console.error("Failed to query system fonts:", err);
    } finally {
      setIsRefreshingFonts(false);
    }
  };

  createEffect(() => {
    document.title = t().settings.title;
  });

  onMount(() => {
    void loadFonts(false);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") window.close();
    };
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  const handleUpdate = (patch: Partial<Settings>) => void updateSettings(patch);

  const colorSchemeOptions = (): SelectOption<Settings["colorScheme"]>[] => [
    {
      value: "system",
      label: t().settings.themeSystem,
      icon: <SunMoon class="size-3.5" />,
    },
    {
      value: "light",
      label: t().settings.themeLight,
      icon: <Sun class="size-3.5" />,
    },
    {
      value: "dark",
      label: t().settings.themeDark,
      icon: <Moon class="size-3.5" />,
    },
  ];

  const animationOptions = (): SelectOption<AnimationSetting>[] => [
    { value: "system", label: t().settings.animationsSystem },
    { value: "on", label: t().settings.animationsOn },
    { value: "off", label: t().settings.animationsOff },
  ];

  const editorWidthOptions = (): SelectOption<EditorWidth>[] => [
    { value: "compact", label: t().settings.editorWidthCompact },
    { value: "normal", label: t().settings.editorWidthNormal },
    { value: "wide", label: t().settings.editorWidthWide },
    { value: "full", label: t().settings.editorWidthFull },
  ];

  const fontOptions = (): SelectOption<string>[] => [
    { value: "sans", label: t().settings.fontFamilySans },
    { value: "mono", label: t().settings.fontFamilyMono },
    { value: "serif", label: t().settings.fontFamilySerif },
    ...availableFonts()
      .filter((f) => f !== "System Sans" && f !== "System Mono" && f !== "System Serif")
      .map((f) => ({ value: f, label: f })),
  ];

  const fallbackFontOptions = (): SelectOption<string>[] => [
    { value: "", label: t().settings.fontFallbackNone },
    ...availableFonts()
      .filter((f) => f !== "System Sans" && f !== "System Mono" && f !== "System Serif")
      .map((f) => ({ value: f, label: f })),
  ];

  const languageOptions = (): SelectOption<LanguageSetting>[] => [
    { value: "auto", label: t().settings.followSystem },
    ...SUPPORTED_LOCALES.map((l) => ({ value: l.code, label: l.label })),
  ];

  return (
    <div class="h-screen w-screen flex flex-col bg-surface-1 text-foreground select-none overflow-hidden font-sans">
      <header class="app-title-bar h-10 w-full relative flex items-center justify-between px-3 select-none bg-surface-0 border-b border-border/80 transition-colors text-xs z-30 shrink-0">
        <div class="flex items-center gap-2 pointer-events-none">
          <img src="./logo.svg" alt="logo" class="rounded-sm shadow-sm size-4 select-none" />
          <span class="font-semibold text-foreground tracking-wide">{t().settings.title}</span>
        </div>
      </header>

      <div class="flex-1 flex overflow-hidden">
        <Tabs
          orientation="vertical"
          value={activeTab()}
          onValueChange={setActiveTab}
          class="gap-0 size-full"
        >
          <aside class="w-44 border-r border-border/80 bg-surface-0/60 p-3 flex flex-col gap-1 shrink-0">
            <TabsList class="w-full">
              <TabsTrigger value="appearance">
                <Palette class="size-4 shrink-0" />
                <span>{t().settings.appearance}</span>
              </TabsTrigger>
              <TabsTrigger value="editor">
                <Type class="size-4 shrink-0" />
                <span>{t().settings.editor}</span>
              </TabsTrigger>
              <TabsTrigger value="language">
                <Languages class="size-4 shrink-0" />
                <span>{t().settings.language}</span>
              </TabsTrigger>
              <Separator class="my-2" />
              <TabsTrigger value="about">
                <Info class="size-4 shrink-0" />
                <span>{t().settings.about}</span>
              </TabsTrigger>
            </TabsList>
          </aside>

          <main class="flex-1 overflow-y-auto p-6 bg-surface-1">
            <TabsContent value="appearance">
              <div class="space-y-4 max-w-lg">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t().settings.appearance}
                </h3>

                <div class="divide-y divide-border/40">
                  <SettingRow
                    title={t().settings.colorScheme}
                    description={t().settings.colorSchemeDesc}
                  >
                    <Select
                      value={settings().colorScheme}
                      onChange={(colorScheme) => handleUpdate({ colorScheme })}
                      options={colorSchemeOptions()}
                    />
                  </SettingRow>

                  <SettingRow title={t().settings.theme} description={t().settings.themeDesc}>
                    <Select
                      value={settings().theme}
                      onChange={(theme) => handleUpdate({ theme })}
                      options={THEME_NAMES.map((name) => ({ value: name, label: name }))}
                    />
                  </SettingRow>

                  <SettingRow
                    title={t().settings.editorWidth}
                    description={t().settings.editorWidthNormal}
                  >
                    <Select
                      value={settings().editorWidth}
                      onChange={(editorWidth) => handleUpdate({ editorWidth })}
                      options={editorWidthOptions()}
                    />
                  </SettingRow>

                  <SettingRow
                    title={t().settings.animations}
                    description={t().settings.animationsDesc}
                  >
                    <Select
                      value={settings().animations}
                      onChange={(animations) => handleUpdate({ animations })}
                      options={animationOptions()}
                    />
                  </SettingRow>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="editor">
              <div class="space-y-4 max-w-lg">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t().settings.editor}
                </h3>

                <div class="divide-y divide-border/40">
                  <SettingRow
                    title={
                      <div class="flex items-center gap-1.5">
                        <span>{t().settings.primaryFont}</span>
                        <button
                          type="button"
                          onClick={() => loadFonts(true)}
                          class="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          title={t().settings.refreshFonts}
                        >
                          <RefreshCw class={cn("size-3", isRefreshingFonts() && "animate-spin")} />
                        </button>
                      </div>
                    }
                    description={
                      fontOptions().find((o) => o.value === settings().fontFamily)?.label ??
                      settings().fontFamily
                    }
                  >
                    <Select
                      value={settings().fontFamily}
                      onChange={(fontFamily) => handleUpdate({ fontFamily })}
                      options={fontOptions()}
                      searchable={true}
                      searchPlaceholder={t().settings.searchFont}
                    />
                  </SettingRow>

                  <SettingRow
                    title={t().settings.fallbackFont}
                    description={
                      fallbackFontOptions().find((o) => o.value === (settings().fallbackFont ?? ""))
                        ?.label ??
                      settings().fallbackFont ??
                      t().settings.fontFallbackNone
                    }
                  >
                    <Select
                      value={settings().fallbackFont ?? ""}
                      onChange={(fallbackFont) => handleUpdate({ fallbackFont })}
                      options={fallbackFontOptions()}
                      searchable={true}
                      searchPlaceholder={t().settings.searchFont}
                    />
                  </SettingRow>

                  <SettingRow
                    title={t().settings.fontSize}
                    description={`${settings().fontSize}px`}
                  >
                    <input
                      type="range"
                      min="13"
                      max="24"
                      step="1"
                      value={settings().fontSize}
                      onInput={(e) =>
                        handleUpdate({ fontSize: Number.parseInt(e.currentTarget.value, 10) })
                      }
                      class="w-32 accent-brand cursor-pointer"
                    />
                  </SettingRow>

                  <SettingRow
                    title={t().settings.lineHeight}
                    description={`${settings().lineHeight.toFixed(2)}`}
                  >
                    <input
                      type="range"
                      min="1.3"
                      max="2.4"
                      step="0.05"
                      value={settings().lineHeight}
                      onInput={(e) =>
                        handleUpdate({
                          lineHeight: Number.parseFloat(e.currentTarget.value),
                        })
                      }
                      class="w-32 accent-brand cursor-pointer"
                    />
                  </SettingRow>

                  <SettingRow title={t().settings.autoSave} description={t().settings.autoSaveDesc}>
                    <Switch
                      checked={settings().autoSave}
                      onChange={(checked) => handleUpdate({ autoSave: checked })}
                    />
                  </SettingRow>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="language">
              <div class="space-y-4 max-w-lg">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t().settings.language}
                </h3>

                <div class="py-1">
                  <SettingRow title={t().settings.language} description={t().settings.followSystem}>
                    <Select
                      value={settings().locale}
                      onChange={(locale) => handleUpdate({ locale })}
                      options={languageOptions()}
                    />
                  </SettingRow>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="about">
              <div class="space-y-4 max-w-lg text-xs">
                <div class="flex items-center gap-3">
                  <img
                    src="./logo.svg"
                    alt="Pupitre"
                    class="size-10 rounded-xl select-none shadow-sm shrink-0"
                  />
                  <div class="flex-1 min-w-0">
                    <h2 class="text-base font-semibold text-foreground">Pupitre</h2>
                    <div class="text-[11px] text-muted-foreground">
                      {t().settings.version} {pkg.version} · Electron {desktop.versions.electron}
                    </div>
                  </div>
                  <UpdateButton />
                </div>

                <UpdateStatusPanel currentVersion={pkg.version} />

                <Separator />

                <div class="py-2 flex items-center justify-between gap-3 text-xs">
                  <div class="min-w-0">
                    <div class="font-medium text-foreground">{t().about.sampleDocTitle}</div>
                    <div class="text-[11px] text-muted-foreground truncate">
                      {t().about.sampleDocDesc}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void desktop.invoke("app:dispatch", { id: "help.sample-document" })
                    }
                    class="text-xs shrink-0 gap-1.5"
                  >
                    <BookOpen class="size-3.5" />
                    <span>{t().about.openSampleDoc}</span>
                  </Button>
                </div>

                <Separator />

                <div>
                  <div class="text-xs font-medium text-foreground mb-2">
                    {t().settings.configFile}
                  </div>
                  <div class="flex items-center gap-2">
                    <Input
                      readOnly
                      value={desktop.getSettingsPath()}
                      class="font-mono text-[11px] select-all"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void desktop.invoke("settings:reveal")}
                      title={t().settings.openConfigFile}
                    >
                      <FolderOpen class="size-3.5" />
                      <span>{t().settings.openConfigFile}</span>
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>
          </main>
        </Tabs>
      </div>
    </div>
  );
};

import {
  CheckCircle2,
  Download,
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
import { createSignal, onCleanup, onMount, Show, type Component } from "solid-js";
import {
  Button,
  Card,
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
  WindowControls,
} from "@/components/ui";
import { setLanguageSetting, SUPPORTED_LOCALES, t } from "@/i18n";
import { getAboutInfo } from "@/lib/about";
import {
  config,
  type EditorWidth,
  type FontFamilyOption,
  getConfigFilePath,
  loadConfig,
  type PupitreConfig,
  setupConfigSync,
  updateConfig,
} from "@/lib/config";
import { isTauri } from "@/lib/platform";
import { applyTheme } from "@/lib/theme";
import {
  checkForUpdates,
  downloadAndInstallUpdate,
  relaunchApp,
  updaterState,
} from "@/lib/updater";
import { cn } from "cn";
import { closeCurrentWindow, getCurrentAppWindow, toggleMaximizeCurrentWindow } from "@/lib/window";

export const SettingsWindow: Component = () => {
  const [activeTab, setActiveTab] = createSignal<string>("appearance");
  const [configPath, setConfigPath] = createSignal<string>("");
  const aboutInfo = getAboutInfo();

  onMount(async () => {
    const loaded = await loadConfig();
    applyTheme(loaded.theme);
    setLanguageSetting(loaded.locale);

    const p = await getConfigFilePath();
    if (p) setConfigPath(p);

    const cleanup = setupConfigSync((newCfg) => {
      applyTheme(newCfg.theme);
      setLanguageSetting(newCfg.locale);
    });

    // Make window visible now that initial state is parsed and theme applied
    getCurrentAppWindow().then(async (win) => {
      if (win) {
        await win.show();
        await win.setFocus();
      }
    });

    onCleanup(cleanup);
  });

  const handleUpdate = async (partial: Partial<PupitreConfig>) => {
    await updateConfig(partial);
    if ("theme" in partial) {
      applyTheme(config().theme);
    }
    if ("locale" in partial) {
      setLanguageSetting(config().locale);
    }
  };

  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeCurrentWindow();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  const handleOpenConfigFile = async () => {
    if (isTauri() && configPath()) {
      try {
        const { openPath } = await import("@tauri-apps/plugin-opener");
        const dir = configPath().replace(/[\\/][^\\/]+$/, "");
        await openPath(dir);
      } catch (err) {
        console.error("Failed to open config directory:", err);
      }
    }
  };

  const themeOptions = (): SelectOption[] => [
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

  const editorWidthOptions = (): SelectOption[] => [
    { value: "compact", label: `${t().settings.editorWidthCompact} (720px)` },
    { value: "normal", label: `${t().settings.editorWidthNormal} (880px)` },
    { value: "wide", label: `${t().settings.editorWidthWide} (1040px)` },
    { value: "full", label: `${t().settings.editorWidthFull} (100%)` },
  ];

  const fontOptions = (): SelectOption[] => [
    { value: "sans", label: t().settings.fontFamilySans },
    { value: "mono", label: t().settings.fontFamilyMono },
    { value: "serif", label: t().settings.fontFamilySerif },
  ];

  const languageOptions = (): SelectOption[] => [
    { value: "auto", label: t().settings.followSystem },
    ...SUPPORTED_LOCALES.map((l) => ({ value: l.code, label: l.label })),
  ];

  const tabSizeOptions = (): SelectOption[] => [
    { value: "2", label: "2 spaces" },
    { value: "4", label: "4 spaces" },
    { value: "8", label: "8 spaces" },
  ];

  return (
    <div class="h-screen w-screen flex flex-col bg-surface-1 text-foreground select-none overflow-hidden font-sans">
      <header
        data-tauri-drag-region
        class="h-10 w-full relative flex items-center justify-between px-3 select-none bg-surface-0 border-b border-border/80 transition-colors text-xs z-30 shrink-0"
        onDblClick={toggleMaximizeCurrentWindow}
      >
        <div class="flex items-center gap-2 pointer-events-none" data-tauri-drag-region>
          <img src="/logo.svg" alt="logo" class="rounded-sm shadow-sm size-4 select-none" />
          <span class="font-semibold text-foreground tracking-wide">{t().settings.title}</span>
        </div>

        <WindowControls class="absolute right-0 top-0" />
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

                <Card class="p-2 divide-y divide-border/50">
                  <SettingRow
                    title={t().settings.theme}
                    description={t().settings.themeDark}
                    class="px-2"
                  >
                    <Select
                      value={config().theme}
                      onChange={(val) =>
                        handleUpdate({ theme: val as "system" | "light" | "dark" })
                      }
                      options={themeOptions()}
                    />
                  </SettingRow>

                  <SettingRow
                    title={t().settings.editorWidth}
                    description={t().settings.editorWidthNormal}
                    class="px-2"
                  >
                    <Select
                      value={config().editorWidth}
                      onChange={(val) => handleUpdate({ editorWidth: val as EditorWidth })}
                      options={editorWidthOptions()}
                    />
                  </SettingRow>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="editor">
              <div class="space-y-4 max-w-lg">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t().settings.editor}
                </h3>

                <Card class="p-2 divide-y divide-border/50">
                  <SettingRow
                    title={t().settings.typography}
                    description={t().settings.fontFamilySans}
                    class="px-2"
                  >
                    <Select
                      value={config().fontFamily}
                      onChange={(val) => handleUpdate({ fontFamily: val as FontFamilyOption })}
                      options={fontOptions()}
                    />
                  </SettingRow>

                  <SettingRow
                    title={t().settings.fontSize}
                    description={`${config().fontSize}px`}
                    class="px-2"
                  >
                    <input
                      type="range"
                      min="13"
                      max="24"
                      step="1"
                      value={config().fontSize}
                      onInput={(e) =>
                        handleUpdate({ fontSize: Number.parseInt(e.currentTarget.value, 10) })
                      }
                      class="w-32 accent-brand cursor-pointer"
                    />
                  </SettingRow>

                  <SettingRow
                    title={t().settings.lineHeight}
                    description={`${config().lineHeight.toFixed(2)}`}
                    class="px-2"
                  >
                    <input
                      type="range"
                      min="1.3"
                      max="2.4"
                      step="0.05"
                      value={config().lineHeight}
                      onInput={(e) =>
                        handleUpdate({
                          lineHeight: Number.parseFloat(e.currentTarget.value),
                        })
                      }
                      class="w-32 accent-brand cursor-pointer"
                    />
                  </SettingRow>

                  <SettingRow
                    title={t().settings.tabSize}
                    description={t().settings.tabSizeDesc}
                    class="px-2"
                  >
                    <Select
                      value={String(config().tabSize)}
                      onChange={(val) => handleUpdate({ tabSize: Number.parseInt(val, 10) })}
                      options={tabSizeOptions()}
                      size="sm"
                    />
                  </SettingRow>

                  <SettingRow
                    title={t().settings.wordWrap}
                    description={t().settings.wordWrapDesc}
                    class="px-2"
                  >
                    <Switch
                      checked={config().wordWrap}
                      onChange={(checked) => handleUpdate({ wordWrap: checked })}
                    />
                  </SettingRow>

                  <SettingRow
                    title={t().settings.autoSave}
                    description={t().settings.autoSaveDesc}
                    class="px-2"
                  >
                    <Switch
                      checked={config().autoSave}
                      onChange={(checked) => handleUpdate({ autoSave: checked })}
                    />
                  </SettingRow>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="language">
              <div class="space-y-4 max-w-lg">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t().settings.language}
                </h3>

                <Card class="p-2">
                  <SettingRow
                    title={t().settings.language}
                    description={t().settings.followSystem}
                    class="px-2"
                  >
                    <Select
                      value={config().locale}
                      onChange={(val) => handleUpdate({ locale: val as any })}
                      options={languageOptions()}
                    />
                  </SettingRow>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="about">
              <div class="space-y-4 max-w-lg text-xs">
                <div class="flex items-center gap-3">
                  <div class="size-10 rounded-xl bg-brand text-brand-foreground flex items-center justify-center font-bold text-lg shadow-sm">
                    P
                  </div>
                  <div class="flex-1 min-w-0">
                    <h2 class="text-base font-semibold text-foreground">{aboutInfo.name}</h2>
                    <div class="text-[11px] text-muted-foreground">
                      {t().settings.version} {aboutInfo.version} · {aboutInfo.date}
                    </div>
                  </div>
                  <Show when={isTauri()}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => checkForUpdates(true)}
                      disabled={
                        updaterState.status() === "checking" ||
                        updaterState.status() === "downloading"
                      }
                      class="text-xs"
                    >
                      <RefreshCw
                        class={cn(
                          "size-3.5",
                          updaterState.status() === "checking" && "animate-spin",
                        )}
                      />
                      <span>
                        {updaterState.status() === "checking"
                          ? t().settings.checkingForUpdates
                          : t().settings.checkForUpdates}
                      </span>
                    </Button>
                  </Show>
                </div>

                <Show when={updaterState.status() === "upToDate"}>
                  <div class="p-2.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center gap-2 text-xs">
                    <CheckCircle2 class="size-4 shrink-0" />
                    <span>
                      {t().settings.upToDate} (v{aboutInfo.version})
                    </span>
                  </div>
                </Show>

                <Show when={updaterState.status() === "available"}>
                  <div class="p-3 rounded-md bg-brand/10 border border-brand/20 text-foreground space-y-2 text-xs">
                    <div class="flex items-center justify-between">
                      <span class="font-medium text-brand">
                        {t().settings.updateAvailable}: v{updaterState.updateInfo()?.version}
                      </span>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={downloadAndInstallUpdate}
                        class="text-xs"
                      >
                        <Download class="size-3.5" />
                        <span>{t().settings.downloadUpdate}</span>
                      </Button>
                    </div>
                    <Show when={updaterState.updateInfo()?.body}>
                      <p class="text-[11px] text-muted-foreground whitespace-pre-wrap max-h-24 overflow-y-auto">
                        {updaterState.updateInfo()?.body}
                      </p>
                    </Show>
                  </div>
                </Show>

                <Show when={updaterState.status() === "downloading"}>
                  <div class="p-3 rounded-md bg-surface-0 border border-border space-y-2 text-xs">
                    <div class="flex items-center justify-between">
                      <span class="text-muted-foreground">{t().settings.downloadingUpdate}...</span>
                      <span class="font-mono font-medium">{updaterState.progress()}%</span>
                    </div>
                    <div class="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        class="h-full bg-brand transition-all duration-200"
                        style={{ width: `${updaterState.progress()}%` }}
                      />
                    </div>
                  </div>
                </Show>

                <Show when={updaterState.status() === "ready"}>
                  <div class="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs">
                    <div class="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 class="size-4 shrink-0" />
                      <span>{t().settings.restartToApply}</span>
                    </div>
                    <Button variant="default" size="sm" onClick={relaunchApp} class="text-xs">
                      <span>{t().settings.restartToApply}</span>
                    </Button>
                  </div>
                </Show>

                <Show when={updaterState.status() === "error"}>
                  <div class="p-2.5 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                    {updaterState.errorMessage() || "Update check failed"}
                  </div>
                </Show>

                <Card class="space-y-1.5 font-mono text-[11px] text-muted-foreground bg-surface-0/60 p-3">
                  <div>
                    <span class="text-foreground/70 font-sans">{t().about.osLabel}</span>{" "}
                    {aboutInfo.os}
                  </div>
                  <div>
                    <span class="text-foreground/70 font-sans">{t().about.engineLabel}</span>{" "}
                    {aboutInfo.engine}
                  </div>
                  <div class="truncate" title={aboutInfo.userAgent}>
                    <span class="text-foreground/70 font-sans">{t().about.userAgentLabel}</span>{" "}
                    {aboutInfo.userAgent}
                  </div>
                </Card>

                <Separator />

                <div>
                  <div class="text-xs font-medium text-foreground mb-2">
                    {t().settings.configFile}
                  </div>
                  <div class="flex items-center gap-2">
                    <Input readOnly value={configPath()} class="font-mono text-[11px] select-all" />
                    <Show when={isTauri()}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOpenConfigFile}
                        title={t().settings.openConfigFile}
                      >
                        <FolderOpen class="size-3.5" />
                        <span>{t().settings.openConfigFile}</span>
                      </Button>
                    </Show>
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

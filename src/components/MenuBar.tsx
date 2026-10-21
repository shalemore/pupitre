import { cn } from "cn";
import { ChevronRight } from "lucide-solid";
import { createSignal, For, onCleanup, onMount, Show, type Component } from "solid-js";
import { t } from "@/i18n";
import { isTauri } from "@/lib/platform";

import type { AppActionHandlers } from "@/types";

export type MenuBarProps = AppActionHandlers;

type MenuKey = "file" | "edit" | "view" | "help" | null;

interface MenuTriggerProps {
  label: string;
  active: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}

const MenuTrigger: Component<MenuTriggerProps> = (props) => (
  <button
    type="button"
    onClick={props.onClick}
    onMouseEnter={props.onMouseEnter}
    class={cn(
      "px-2.5 py-1 rounded-sm transition-colors cursor-pointer",
      props.active
        ? "bg-accent text-foreground font-medium"
        : "text-muted-foreground hover:text-foreground hover:bg-accent",
    )}
  >
    {props.label}
  </button>
);

interface MenuItemProps {
  label: string;
  shortcut?: string;
  onClick: () => void;
}

const MenuItem: Component<MenuItemProps> = (props) => (
  <button
    type="button"
    onClick={props.onClick}
    class="w-full px-3 py-1.5 flex items-center justify-between text-start hover:bg-accent text-foreground cursor-pointer"
  >
    <span>{props.label}</span>
    <Show when={props.shortcut}>
      <span class="text-[10px] text-tertiary font-mono">{props.shortcut}</span>
    </Show>
  </button>
);

const MenuDivider: Component = () => <div class="my-1 border-t border-border/50" />;

export const MenuBar: Component<MenuBarProps> = (props) => {
  const [activeMenu, setActiveMenu] = createSignal<MenuKey>(null);
  const [recentHovered, setRecentHovered] = createSignal(false);
  let barRef: HTMLDivElement | undefined;

  onMount(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      if (barRef && !barRef.contains(e.target as Node)) {
        setActiveMenu(null);
        setRecentHovered(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveMenu(null);
        setRecentHovered(false);
      }
    };

    window.addEventListener("mousedown", handleDocumentClick);
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => {
      window.removeEventListener("mousedown", handleDocumentClick);
      window.removeEventListener("keydown", handleKeyDown);
    });
  });

  const toggleMenu = (key: MenuKey) => {
    setActiveMenu((prev) => (prev === key ? null : key));
    setRecentHovered(false);
  };

  const handleMouseEnter = (key: MenuKey) => {
    if (activeMenu() !== null) {
      setActiveMenu(key);
      setRecentHovered(false);
    }
  };

  const executeAction = (action: () => void) => {
    setActiveMenu(null);
    setRecentHovered(false);
    action();
  };

  const handleOpenDocs = async () => {
    const url = "https://github.com/shalemore/pupitre";
    if (isTauri()) {
      try {
        const { openUrl } = await import("@tauri-apps/plugin-opener");
        await openUrl(url);
      } catch {
        window.open(url, "_blank");
      }
    } else {
      window.open(url, "_blank");
    }
  };

  const menu = () => t().menu;

  return (
    <div
      ref={(el) => {
        barRef = el;
      }}
      class="flex items-center text-xs select-none relative z-40"
    >
      <div class="relative">
        <MenuTrigger
          label={menu().file}
          active={activeMenu() === "file"}
          onClick={() => toggleMenu("file")}
          onMouseEnter={() => handleMouseEnter("file")}
        />

        <Show when={activeMenu() === "file"}>
          <div class="absolute left-0 top-full mt-1 w-56 py-1 rounded-lg border border-border/80 bg-surface-2 shadow-float text-xs z-50 animate-in fade-in zoom-in-95 duration-(--duration-snap)">
            <MenuItem
              label={menu().newFile}
              shortcut="Ctrl+N"
              onClick={() => executeAction(props.onNew)}
            />
            <MenuItem
              label={menu().openFile}
              shortcut="Ctrl+O"
              onClick={() => executeAction(props.onOpen)}
            />

            <div
              class="relative"
              onMouseEnter={() => setRecentHovered(true)}
              onMouseLeave={() => setRecentHovered(false)}
            >
              <div class="w-full px-3 py-1.5 flex items-center justify-between text-start hover:bg-accent cursor-pointer text-muted-foreground hover:text-foreground">
                <span>{menu().openRecent}</span>
                <ChevronRight class="size-3.5 opacity-60" />
              </div>

              <Show when={recentHovered()}>
                <div class="absolute left-full top-0 -ml-1 w-64 py-1 rounded-lg border border-border/80 bg-surface-2 shadow-float text-xs z-50">
                  <Show
                    when={props.recentFiles.length > 0}
                    fallback={
                      <div class="px-3 py-2 text-[11px] text-tertiary italic">
                        {menu().noRecentFiles}
                      </div>
                    }
                  >
                    <For each={props.recentFiles}>
                      {(filePath) => {
                        const name = filePath.split(/[\\/]/).pop() || filePath;
                        return (
                          <button
                            type="button"
                            onClick={() => executeAction(() => props.onOpenRecent(filePath))}
                            class="w-full px-3 py-1.5 flex flex-col text-start hover:bg-accent cursor-pointer"
                            title={filePath}
                          >
                            <span class="truncate font-medium text-foreground">{name}</span>
                            <span class="text-[10px] text-tertiary truncate font-mono">
                              {filePath}
                            </span>
                          </button>
                        );
                      }}
                    </For>
                  </Show>
                </div>
              </Show>
            </div>

            <MenuDivider />

            <MenuItem
              label={menu().save}
              shortcut="Ctrl+S"
              onClick={() => executeAction(props.onSave)}
            />
            <MenuItem
              label={menu().saveAs}
              shortcut="Ctrl+Shift+S"
              onClick={() => executeAction(props.onSaveAs)}
            />

            <MenuDivider />

            <MenuItem
              label={menu().preferences}
              shortcut="Ctrl+,"
              onClick={() => executeAction(props.onOpenSettings)}
            />
          </div>
        </Show>
      </div>

      <div class="relative">
        <MenuTrigger
          label={menu().edit}
          active={activeMenu() === "edit"}
          onClick={() => toggleMenu("edit")}
          onMouseEnter={() => handleMouseEnter("edit")}
        />

        <Show when={activeMenu() === "edit"}>
          <div class="absolute left-0 top-full mt-1 w-52 py-1 rounded-lg border border-border/80 bg-surface-2 shadow-float text-xs z-50 animate-in fade-in zoom-in-95 duration-(--duration-snap)">
            <MenuItem
              label={menu().undo}
              shortcut="Ctrl+Z"
              onClick={() => executeAction(() => document.execCommand?.("undo"))}
            />
            <MenuItem
              label={menu().redo}
              shortcut="Ctrl+Y"
              onClick={() => executeAction(() => document.execCommand?.("redo"))}
            />

            <MenuDivider />

            <MenuItem
              label={menu().cut}
              shortcut="Ctrl+X"
              onClick={() => executeAction(() => document.execCommand?.("cut"))}
            />
            <MenuItem
              label={menu().copy}
              shortcut="Ctrl+C"
              onClick={() => executeAction(() => document.execCommand?.("copy"))}
            />
            <MenuItem
              label={menu().paste}
              shortcut="Ctrl+V"
              onClick={() => executeAction(() => document.execCommand?.("paste"))}
            />

            <MenuDivider />

            <MenuItem
              label={menu().selectAll}
              shortcut="Ctrl+A"
              onClick={() => executeAction(() => document.execCommand?.("selectAll"))}
            />

            <MenuDivider />

            <Show when={props.onFind}>
              <MenuItem
                label={menu().find}
                shortcut="Ctrl+F"
                onClick={() => executeAction(props.onFind!)}
              />
            </Show>
            <Show when={props.onReplace}>
              <MenuItem
                label={menu().replace}
                shortcut="Ctrl+H"
                onClick={() => executeAction(props.onReplace!)}
              />
            </Show>
          </div>
        </Show>
      </div>

      <div class="relative">
        <MenuTrigger
          label={menu().view}
          active={activeMenu() === "view"}
          onClick={() => toggleMenu("view")}
          onMouseEnter={() => handleMouseEnter("view")}
        />

        <Show when={activeMenu() === "view"}>
          <div class="absolute left-0 top-full mt-1 w-52 py-1 rounded-lg border border-border/80 bg-surface-2 shadow-float text-xs z-50 animate-in fade-in zoom-in-95 duration-(--duration-snap)">
            <MenuItem
              label={menu().toggleSidebar}
              shortcut="Ctrl+B"
              onClick={() => executeAction(props.onToggleSidebar)}
            />
            <MenuItem
              label={menu().toggleTheme}
              shortcut="Ctrl+D"
              onClick={() => executeAction(props.onToggleTheme)}
            />

            <MenuDivider />

            <Show when={props.onZoomIn}>
              <MenuItem
                label={menu().zoomIn}
                shortcut="Ctrl++"
                onClick={() => executeAction(props.onZoomIn!)}
              />
            </Show>
            <Show when={props.onZoomOut}>
              <MenuItem
                label={menu().zoomOut}
                shortcut="Ctrl+-"
                onClick={() => executeAction(props.onZoomOut!)}
              />
            </Show>
            <Show when={props.onZoomReset}>
              <MenuItem
                label={menu().resetZoom}
                shortcut="Ctrl+0"
                onClick={() => executeAction(props.onZoomReset!)}
              />
            </Show>
          </div>
        </Show>
      </div>

      <div class="relative">
        <MenuTrigger
          label={menu().help}
          active={activeMenu() === "help"}
          onClick={() => toggleMenu("help")}
          onMouseEnter={() => handleMouseEnter("help")}
        />

        <Show when={activeMenu() === "help"}>
          <div class="absolute left-0 top-full mt-1 w-52 py-1 rounded-lg border border-border/80 bg-surface-2 shadow-float text-xs z-50 animate-in fade-in zoom-in-95 duration-(--duration-snap)">
            <MenuItem label={menu().documentation} onClick={() => executeAction(handleOpenDocs)} />

            <MenuDivider />

            <MenuItem label={menu().about} onClick={() => executeAction(props.onOpenAbout)} />
          </div>
        </Show>
      </div>
    </div>
  );
};

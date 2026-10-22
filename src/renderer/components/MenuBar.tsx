import { TOP_MENUS, type TopMenu } from "@shared/desktop-api";
import { For, type Component } from "solid-js";
import { t } from "@/i18n";
import { desktop } from "@/lib/desktop";

/**
 * Menu buttons in the Windows and Linux title bar. The menu contents and shortcuts are defined in the main process's application menu,
 * so this only pops up the matching native submenu below the button.
 */
export const MenuBar: Component = () => {
  const popup = (menu: TopMenu, button: HTMLElement) => {
    const rect = button.getBoundingClientRect();
    void desktop.invoke("menu:popup", menu, rect.left, rect.bottom);
  };

  return (
    <nav class="flex items-center text-xs select-none">
      <For each={TOP_MENUS}>
        {(menu) => (
          <button
            type="button"
            onClick={(e) => popup(menu, e.currentTarget)}
            class="px-2.5 py-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
          >
            {t().menu[menu]}
          </button>
        )}
      </For>
    </nav>
  );
};

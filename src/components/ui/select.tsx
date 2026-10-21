import { Check, ChevronDown } from "lucide-solid";
import { createSignal, For, type JSX, Show, splitProps } from "solid-js";
import { cn } from "cn";
import { useClickOutside } from "@/lib/dom";

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  icon?: JSX.Element;
  description?: string;
}

export interface SelectProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: readonly SelectOption<T>[] | SelectOption<T>[];
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  size?: "sm" | "default";
  class?: string;
  disabled?: boolean;
}

export function Select<T extends string = string>(props: SelectProps<T>) {
  const [local, rest] = splitProps(props, [
    "value",
    "onChange",
    "options",
    "placeholder",
    "searchable",
    "searchPlaceholder",
    "size",
    "class",
    "disabled",
  ]);

  const [isOpen, setIsOpen] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal("");
  let containerRef: HTMLDivElement | null = null;

  const selectedOption = () => local.options.find((opt) => opt.value === local.value);

  const filteredOptions = () => {
    const q = searchQuery().trim().toLowerCase();
    if (!q || !local.searchable) return local.options;
    return local.options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q) ||
        (opt.description && opt.description.toLowerCase().includes(q)),
    );
  };

  useClickOutside(
    () => containerRef,
    () => {
      setIsOpen(false);
      setSearchQuery("");
    },
  );

  const handleSelect = (val: T) => {
    local.onChange(val);
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleToggle = () => {
    if (local.disabled) return;
    const next = !isOpen();
    setIsOpen(next);
    if (!next) {
      setSearchQuery("");
    }
  };

  return (
    <div
      ref={(el) => {
        containerRef = el;
      }}
      data-slot="select"
      class={cn("relative inline-block text-xs select-none", local.class)}
      {...rest}
    >
      <button
        type="button"
        disabled={local.disabled}
        onClick={handleToggle}
        class={cn(
          "flex items-center justify-between gap-2 rounded-md border border-input bg-surface-0/60 hover:bg-surface-0 px-2.5 py-1 text-xs text-foreground transition-all outline-none cursor-pointer focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-50",
          local.size === "sm" ? "h-7" : "h-8 min-w-[130px]",
          isOpen() && "border-brand ring-1 ring-ring",
        )}
      >
        <div class="flex items-center gap-1.5 truncate">
          <Show when={selectedOption()?.icon}>
            <span class="text-muted-foreground shrink-0">{selectedOption()!.icon}</span>
          </Show>
          <span class="truncate">
            {selectedOption()?.label ?? local.placeholder ?? "Select..."}
          </span>
        </div>
        <ChevronDown
          class={cn(
            "size-3.5 text-muted-foreground shrink-0 transition-transform duration-(--duration-snap)",
            isOpen() && "rotate-180",
          )}
        />
      </button>

      <Show when={isOpen()}>
        <div class="absolute right-0 top-full mt-1.5 z-50 min-w-[180px] max-w-[280px] flex flex-col rounded-xl border border-border/80 bg-surface-2 p-1 text-xs shadow-float backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-(--duration-ui) ease-(--ease-emphasized)">
          <Show when={local.searchable}>
            <div class="p-1 pb-1.5 border-b border-border/50 sticky top-0 bg-surface-2 z-10 shrink-0">
              <input
                type="text"
                placeholder={local.searchPlaceholder ?? "Search..."}
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                class="w-full px-2 py-1 text-xs rounded bg-surface-1 border border-border/70 text-foreground outline-none focus:border-brand focus:ring-1 focus:ring-ring"
              />
            </div>
          </Show>

          <div class="overflow-y-auto max-h-56 pt-0.5 space-y-0.5">
            <Show
              when={filteredOptions().length > 0}
              fallback={
                <div class="p-3 text-[11px] text-muted-foreground text-center italic">
                  No matching options
                </div>
              }
            >
              <For each={filteredOptions()}>
                {(option) => {
                  const isSelected = () => option.value === local.value;
                  return (
                    <button
                      type="button"
                      onClick={() => handleSelect(option.value)}
                      class={cn(
                        "w-full flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-start transition-colors cursor-pointer outline-none",
                        isSelected()
                          ? "bg-brand/10 text-brand font-medium"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      <div class="flex flex-col min-w-0">
                        <div class="flex items-center gap-2 truncate">
                          <Show when={option.icon}>
                            <span class="shrink-0">{option.icon}</span>
                          </Show>
                          <span class="truncate">{option.label}</span>
                        </div>
                        <Show when={option.description}>
                          <span class="text-[10px] text-tertiary truncate mt-0.5">
                            {option.description}
                          </span>
                        </Show>
                      </div>
                      <Show when={isSelected()}>
                        <Check class="size-3 text-brand shrink-0" />
                      </Show>
                    </button>
                  );
                }}
              </For>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}

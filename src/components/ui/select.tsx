import { Check, ChevronDown } from "lucide-solid";
import { createSignal, For, type JSX, Show, splitProps } from "solid-js";
import { cn } from "cn";
import { useClickOutside } from "@/lib/dom";

export interface SelectOption {
  value: string;
  label: string;
  icon?: JSX.Element;
  description?: string;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  size?: "sm" | "default";
  class?: string;
  disabled?: boolean;
}

export function Select(props: SelectProps) {
  const [local, rest] = splitProps(props, [
    "value",
    "onChange",
    "options",
    "placeholder",
    "size",
    "class",
    "disabled",
  ]);

  const [isOpen, setIsOpen] = createSignal(false);
  let containerRef: HTMLDivElement | null = null;

  const selectedOption = () => local.options.find((opt) => opt.value === local.value);

  useClickOutside(
    () => containerRef,
    () => setIsOpen(false),
  );

  const handleSelect = (val: string) => {
    local.onChange(val);
    setIsOpen(false);
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
        onClick={() => !local.disabled && setIsOpen(!isOpen())}
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
        <div class="absolute right-0 top-full mt-1.5 z-50 min-w-[160px] max-h-64 overflow-y-auto rounded-xl border border-border/80 bg-surface-2 p-1 text-xs shadow-float backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-(--duration-ui) ease-(--ease-emphasized)">
          <For each={local.options}>
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
        </div>
      </Show>
    </div>
  );
}

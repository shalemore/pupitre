import { cn } from "cn";
import { splitProps } from "solid-js";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "default";
  class?: string;
  id?: string;
  "aria-label"?: string;
}

export function Switch(props: SwitchProps) {
  const [local, rest] = splitProps(props, [
    "checked",
    "onChange",
    "disabled",
    "size",
    "class",
    "id",
  ]);

  const size = () => local.size ?? "default";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={local.checked}
      disabled={local.disabled}
      id={local.id}
      onClick={() => {
        if (!local.disabled) {
          local.onChange(!local.checked);
        }
      }}
      data-slot="switch"
      data-checked={local.checked ? "" : undefined}
      data-size={size()}
      class={cn(
        "peer group/switch relative inline-flex shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-all outline-none select-none focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-50",
        size() === "sm" ? "h-[14px] w-[24px]" : "h-[18.4px] w-[32px]",
        local.checked ? "bg-brand text-brand-foreground" : "bg-input/80 dark:bg-input/60",
        local.class,
      )}
      {...rest}
    >
      <span
        data-slot="switch-thumb"
        class={cn(
          "pointer-events-none block rounded-full bg-white dark:bg-white shadow-sm transition-transform duration-(--duration-snap) ease-snap",
          size() === "sm" ? "size-2.5" : "size-3.5",
          local.checked
            ? size() === "sm"
              ? "translate-x-[11px]"
              : "translate-x-[14.5px]"
            : "translate-x-[1.5px]",
        )}
      />
    </button>
  );
}

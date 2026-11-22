import {
  Select as UiSelect,
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectList,
  SelectTrigger,
  SelectValue,
} from "@ui-sdk/solid/select";
import { cva } from "class-variance-authority";
import { cn } from "cn";
import { Check, ChevronDown } from "lucide-solid";
import { For, Show } from "solid-js";
import { Badge } from "./badge";
import { optionKey, optionOfKey, type SelectOption } from "./option";
import { popupLayer } from "./popup-layer";
import { ScrollView } from "./scroll-view";
import { PANEL_COLLISION_PADDING, PANEL_SIDE_OFFSET } from "./styles";

export interface SelectProps<T extends string> {
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  /** A ghost sits in a row of text, such as a footer, instead of holding a field's frame. */
  variant?: "default" | "ghost";
  class?: string;
  "aria-label"?: string;
}

// An option keeps the height of the trigger it belongs to, so the open list does not look top-heavy
const item = cva(
  "flex cursor-pointer items-center justify-between gap-4 rounded-sm px-2.5 py-1 text-xs outline-none data-highlighted:bg-accent",
  {
    variants: {
      compact: {
        true: "min-h-6",
        false: "min-h-8",
      },
    },
    defaultVariants: { compact: false },
  },
);

const chevronIcon = cva("", {
  variants: {
    variant: {
      default: "size-3.5",
      ghost: "size-3",
    },
  },
  defaultVariants: { variant: "default" },
});

const trigger = cva(
  "__INTERACTIVE__ flex cursor-pointer items-center justify-between gap-2 rounded-sm outline-none focus-visible:shadow-focus",
  {
    variants: {
      variant: {
        default:
          "h-8 min-w-36 border-hairline border-solid border-input bg-field px-2.5 text-xs text-foreground hover:bg-surface-0 data-expanded:border-brand",
        ghost:
          "h-6 px-1.5 text-2xs text-tertiary hover:bg-accent hover:text-foreground data-expanded:text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

/** A dropdown on top of UI SDK, which handles keyboard navigation, typeahead and ARIA. */
export function Select<T extends string>(props: SelectProps<T>) {
  const selected = () => optionOfKey(props.options, optionKey(props.value));

  return (
    <UiSelect
      value={optionKey(props.value)}
      onValueChange={(next) => {
        const option = optionOfKey(props.options, next);
        if (option) props.onChange(option.value);
      }}
    >
      <SelectTrigger
        data-slot="select-trigger"
        aria-label={props["aria-label"]}
        class={cn(trigger({ variant: props.variant }), props.class)}
      >
        <SelectValue class="flex min-w-0 flex-1 items-center gap-1.5 truncate">
          <Show when={selected()}>
            {(option) => (
              <>
                <span class="truncate" style={option().style}>
                  {option().label}
                </span>
                <Show when={option().hint}>
                  {(hint) => (
                    <span class="truncate text-2xs text-muted-foreground">/ {hint()}</span>
                  )}
                </Show>
                <Show when={option().badge}>
                  {(badge) => (
                    <Badge variant="muted" size="sm">
                      {badge()}
                    </Badge>
                  )}
                </Show>
              </>
            )}
          </Show>
        </SelectValue>
        <span
          aria-hidden="true"
          class="text-muted-foreground transition-transform duration-base ease-out-expo in-data-open:rotate-180"
        >
          <ChevronDown class={chevronIcon({ variant: props.variant })} />
        </span>
      </SelectTrigger>
      <SelectContent
        data-slot="select-content"
        side="bottom"
        align="end"
        sideOffset={PANEL_SIDE_OFFSET}
        collisionPadding={PANEL_COLLISION_PADDING}
        container={popupLayer()}
        class="__FLOATING_PANEL__ z-50 min-w-(--anchor-width) origin-(--transform-origin) rounded-sm p-0.5"
      >
        <SelectList
          render={(listProps) => (
            <ScrollView
              as="ul"
              {...listProps}
              class="outline-none"
              style={{
                "max-height": "min(18rem, calc(var(--available-height, 30rem) - 0.5rem))",
              }}
            />
          )}
        >
          <For each={props.options} keyed={(option) => optionKey(option.value)}>
            {(option) => (
              <SelectItem
                data-slot="select-item"
                value={optionKey(option().value)}
                label={option().label}
                class={cn("group", item({ compact: props.variant === "ghost" }))}
              >
                <span class="flex min-w-0 flex-col">
                  <span class="flex min-w-0 items-center gap-1.5">
                    <SelectItemText
                      class="min-w-0 truncate font-medium text-foreground group-data-selected:text-brand"
                      style={option().style ?? {}}
                    >
                      {option().label}
                    </SelectItemText>
                    <Show when={option().hint}>
                      {(hint) => (
                        <span class="truncate text-2xs text-muted-foreground">/ {hint()}</span>
                      )}
                    </Show>
                    <Show when={option().badge}>
                      {(badge) => (
                        <Badge variant="muted" size="sm">
                          {badge()}
                        </Badge>
                      )}
                    </Show>
                  </span>
                  <Show when={option().description}>
                    {(description) => (
                      <span class="truncate text-2xs text-muted-foreground">{description()}</span>
                    )}
                  </Show>
                </span>
                <SelectItemIndicator>
                  <Check class="size-3 shrink-0 text-brand" />
                </SelectItemIndicator>
              </SelectItem>
            )}
          </For>
        </SelectList>
      </SelectContent>
    </UiSelect>
  );
}

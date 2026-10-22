import { cn } from "cn";
import { createContext, createSignal, type JSX, Show, splitProps, useContext } from "solid-js";

interface TabsContextValue {
  value: () => string;
  setValue: (value: string) => void;
  orientation?: "horizontal" | "vertical";
  variant?: "default" | "line";
}

const TabsContext = createContext<TabsContextValue>();

export interface TabsProps extends JSX.HTMLAttributes<HTMLDivElement> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (val: string) => void;
  orientation?: "horizontal" | "vertical";
  variant?: "default" | "line";
}

export function Tabs(props: TabsProps) {
  const [local, rest] = splitProps(props, [
    "class",
    "value",
    "defaultValue",
    "onValueChange",
    "orientation",
    "variant",
    "children",
  ]);

  const [internalValue, setInternalValue] = createSignal(local.defaultValue ?? local.value ?? "");

  const currentValue = () => (local.value !== undefined ? local.value : internalValue());

  const handleValueChange = (val: string) => {
    if (local.value === undefined) {
      setInternalValue(val);
    }
    local.onValueChange?.(val);
  };

  return (
    <TabsContext.Provider
      value={{
        value: currentValue,
        setValue: handleValueChange,
        orientation: local.orientation ?? "horizontal",
        variant: local.variant ?? "default",
      }}
    >
      <div
        data-slot="tabs"
        data-orientation={local.orientation ?? "horizontal"}
        class={cn(
          "flex gap-3",
          local.orientation === "vertical" ? "flex-row" : "flex-col",
          local.class,
        )}
        {...rest}
      >
        {local.children}
      </div>
    </TabsContext.Provider>
  );
}

export interface TabsListProps extends JSX.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "line";
}

export function TabsList(props: TabsListProps) {
  const ctx = useContext(TabsContext);
  const [local, rest] = splitProps(props, ["class", "variant"]);

  const variant = () => local.variant ?? ctx?.variant ?? "default";
  const isVertical = () => ctx?.orientation === "vertical";

  return (
    <div
      role="tablist"
      data-slot="tabs-list"
      data-variant={variant()}
      class={cn(
        "relative inline-flex items-center text-muted-foreground select-none",
        isVertical() ? "flex-col gap-1 rounded-lg size-fit" : "h-8 w-fit rounded-md p-0.5",
        variant() === "default" && !isVertical() && "bg-segmented-track",
        local.class,
      )}
      {...rest}
    />
  );
}

export interface TabsTriggerProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export function TabsTrigger(props: TabsTriggerProps) {
  const ctx = useContext(TabsContext);
  const [local, rest] = splitProps(props, ["class", "value", "children"]);

  const isActive = () => ctx?.value() === local.value;
  const isVertical = () => ctx?.orientation === "vertical";
  const variant = () => ctx?.variant ?? "default";

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive()}
      data-slot="tabs-trigger"
      data-active={isActive() ? "" : undefined}
      onClick={() => ctx?.setValue(local.value)}
      class={cn(
        "relative inline-flex items-center gap-2 cursor-pointer font-normal whitespace-nowrap transition-all outline-none focus-visible:shadow-focus",
        isVertical()
          ? "w-full justify-start rounded-md px-3 py-1.5 text-xs text-start text-muted-foreground hover:text-foreground hover:bg-accent data-active:font-medium data-active:bg-brand/10 data-active:text-brand"
          : "h-full flex-1 justify-center rounded-sm px-2.5 text-xs hover:text-foreground text-muted-foreground",
        !isVertical() &&
          variant() === "default" &&
          "data-active:bg-segmented-thumb data-active:text-foreground data-active:font-medium data-active:shadow-segmented-thumb",
        local.class,
      )}
      {...rest}
    >
      {local.children}
    </button>
  );
}

export interface TabsContentProps extends JSX.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export function TabsContent(props: TabsContentProps) {
  const ctx = useContext(TabsContext);
  const [local, rest] = splitProps(props, ["class", "value", "children"]);

  return (
    <Show when={ctx?.value() === local.value}>
      <div
        role="tabpanel"
        data-slot="tabs-content"
        class={cn("flex-1 outline-none", local.class)}
        {...rest}
      >
        {local.children}
      </div>
    </Show>
  );
}

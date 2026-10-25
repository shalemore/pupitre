import { cn } from "cn";
import { RefreshCw } from "lucide-solid";
import { createResource, createRoot, createSignal, type Component } from "solid-js";
import { Combobox, IconButton, type SelectOption } from "@/components/ui";
import { t } from "@/i18n";
import { listFontFamilies } from "@/lib/fonts";

// The three font pickers share one font list that is queried once; the refresh button queries again
const fonts = createRoot(() => {
  const [refreshCount, setRefreshCount] = createSignal(0);
  const [list] = createResource(refreshCount, (count) => listFontFamilies(count > 0));
  return { list, refresh: () => setRefreshCount((count) => count + 1) };
});

export interface FontSelectProps {
  value: string;
  onChange: (family: string) => void;
  /** Label for the empty-string value, such as "Theme default" or "None". */
  emptyLabel: string;
  "aria-label": string;
}

export const FontSelect: Component<FontSelectProps> = (props) => {
  const options = (): SelectOption[] => [
    { value: "", label: props.emptyLabel },
    ...(fonts.list() ?? []).map(({ family, localizedName }) => ({
      value: family,
      label: family,
      description: localizedName,
      // Each option is shown in its own font to make picking easier
      style: { "font-family": JSON.stringify(family) },
    })),
  ];

  return (
    <Combobox
      value={props.value}
      onChange={props.onChange}
      options={options()}
      placeholder={t().settings.searchFont}
      aria-label={props["aria-label"]}
    />
  );
};

export const RefreshFontsButton: Component = () => (
  <IconButton label={t().settings.refreshFonts} size="icon-2xs" onClick={fonts.refresh}>
    <RefreshCw class={cn(fonts.list.loading && "animate-spin")} />
  </IconButton>
);

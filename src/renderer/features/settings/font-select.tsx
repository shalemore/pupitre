import { cn } from "cn";
import { RefreshCw } from "lucide-solid";
import { createResource, createRoot, createSignal, type Component, Show } from "solid-js";
import { Combobox, IconButton, type SelectOption } from "@/components/ui";
import { t } from "@/i18n";
import { desktop, isMacOS } from "@/lib/desktop";
import { GENERIC_FAMILIES, listFontFamilies } from "@/lib/fonts";
import { themeApplied } from "@/lib/theme";

type ThemeFontToken = "--font-document" | "--font-mono" | "--font-sans";

const APPLE_SYSTEM_ALIASES = new Set(["-apple-system", "blinkmacsystemfont"]);
const WINDOWS_FAMILIES = new Set([
  "segoe ui",
  "segoe ui variable text",
  "cascadia code",
  "consolas",
]);

/** The first face the active theme's stack names, so a setting can show what it would fall back to. */
function themeFontName(token: ThemeFontToken): string | undefined {
  // Read again after a theme switch, which rewrites the variables
  themeApplied();
  const stack = getComputedStyle(document.documentElement).getPropertyValue(token);
  const families = stack
    .split(",")
    .map((family) => family.trim().replace(/^["']|["']$/g, ""))
    .filter((family) => family !== "");
  // A stack that opens with a generic family or another platform's face names no face this window shows
  return families.find((family) => {
    const name = family.toLowerCase();
    if (GENERIC_FAMILIES.has(name) || /emoji|symbol/.test(name)) return false;
    if (!isMacOS && APPLE_SYSTEM_ALIASES.has(name)) return false;
    return desktop.platform === "win32" || !WINDOWS_FAMILIES.has(name);
  });
}

/** The "Theme Default" label, naming the face the theme brings so an override is visible. */
export function themeFontLabel(token: ThemeFontToken): string {
  const name = themeFontName(token);
  return name === undefined ? t().settings.themeDefault : `${t().settings.themeDefault} · ${name}`;
}

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
    <div>
      <Combobox
        value={props.value}
        onChange={props.onChange}
        options={options()}
        placeholder={t().settings.searchFont}
        aria-label={props["aria-label"]}
      />
      {/* What a chosen font overrides; the row's reset button gives the theme's own font back */}
      <Show when={props.value !== ""}>
        <p class="mt-1 text-2xs text-muted-foreground">{props.emptyLabel}</p>
      </Show>
    </div>
  );
};

export const RefreshFontsButton: Component = () => (
  <IconButton label={t().settings.refreshFonts} size="icon-2xs" onClick={fonts.refresh}>
    <RefreshCw class={cn(fonts.list.loading && "animate-spin")} />
  </IconButton>
);

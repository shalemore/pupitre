import type { JSX } from "@solidjs/web";

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  /** A dim suffix shown after the label, such as a folder when two themes share a name. */
  hint?: string | undefined;
  /** A small tag after the label, such as where a theme was found. */
  badge?: string | undefined;
  /** Secondary text shown with the label, such as a localized font name; also searchable. */
  description?: string | undefined;
  /** Style of the label; the font list uses it to preview each font in its own face. */
  style?: JSX.CSSProperties | undefined;
}

/** UI SDK holds no empty string as a value, so one stands for the empty choice. */
const EMPTY_OPTION_KEY = "__empty__";

/** The value UI SDK holds for an option. */
export function optionKey(value: string): string {
  return value === "" ? EMPTY_OPTION_KEY : value;
}

/** The option a UI SDK value points at, if the list still holds it. */
export function optionOfKey<T extends string>(
  options: readonly SelectOption<T>[],
  key: string | null,
): SelectOption<T> | undefined {
  return options.find((option) => optionKey(option.value) === key);
}

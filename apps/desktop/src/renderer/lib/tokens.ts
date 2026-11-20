import type { TokenName } from "@shared/design-tokens";

export type { TokenName };

/** The value of a token on an element, or an empty string when no rule sets it. */
export function readToken(
  style: Pick<CSSStyleDeclaration, "getPropertyValue">,
  name: TokenName,
): string {
  return style.getPropertyValue(`--${name}`).trim();
}

/** Sets a token on an element, overriding what the stylesheets give it there. */
export function writeToken(
  style: Pick<CSSStyleDeclaration, "setProperty">,
  name: TokenName,
  value: string,
): void {
  style.setProperty(`--${name}`, value);
}

/** Removes the value an element set for a token, so the stylesheets answer for it again. */
export function clearToken(
  style: Pick<CSSStyleDeclaration, "removeProperty">,
  name: TokenName,
): void {
  style.removeProperty(`--${name}`);
}

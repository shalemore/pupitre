import { cn } from "cn";
import { type JSX, splitProps } from "solid-js";

/**
 * The lectern of the app icon, without its background or its shading, so it takes the color of the
 * text around it. Title bars use it where the full-color icon would not follow the theme; the
 * welcome screen and the about page still show the icon itself.
 */
export function AppMark(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
  const [local, rest] = splitProps(props, ["class"]);

  return (
    <svg
      viewBox="110 132 292 292"
      aria-hidden="true"
      class={cn("size-4 shrink-0", local.class)}
      {...rest}
    >
      <g fill="currentColor">
        {/* The slanted top and the apron under it */}
        <path d="M141 138h230c3 0 5.5 4 7 7l18.5 78c1 1.5 0 3-2.5 3H118c-2.5 0-3.5-1.5-2.5-3L134 145c1.5-3 4-7 7-7Z" />
        <path d="M116 226h280c1.5 0 2 1 1.5 2.5l-2 6c-.5 1-1.5 1.5-3 1.5H119.5c-1.5 0-2.5-.5-3-1.5l-2-6c-.5-1.5 0-2.5 1.5-2.5Z" />
        {/* The bracket under the top, the column and the two stepped feet */}
        <path d="M176 236l26 4h108l26-4Z" />
        <path d="M188 236h136v150H188Z" />
        <path d="M156 398l10-12h180l10 12Z" />
        <path d="M126 411l14-13h232l14 13c1 2.5-1 5-4 5H130c-3 0-5-2.5-4-5Z" />
      </g>
    </svg>
  );
}

import { type JSX, splitProps } from "solid-js";
import { css, cx } from "@/styled-system/css";

const mark = css({ width: "4", height: "4", flexShrink: 0 });

/**
 * The lectern of the app icon, without its background or its shading, so it takes the color of the
 * text around it. Title bars use it where the full-color icon would not follow the theme; the
 * welcome screen and the about page still show the icon itself.
 */
export function AppMark(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
  const [local, rest] = splitProps(props, ["class"]);

  return (
    <svg viewBox="120 138 272 272" aria-hidden="true" class={cx(mark, local.class)} {...rest}>
      <g fill="currentColor">
        {/* The desktop keeps the icon's foreshortening */}
        <g transform="translate(256 236) scale(0.82 0.9) translate(-256 -236)">
          <path d="M141 138h230c2.5 0 4.5 2 5.5 4l17.5 84H118l17.5-84c1-2 3-4 5.5-4Z" />
          <path d="M118 226h276l-1.5 8.5c-.3 1-1 1.5-2 1.5H121.5c-1 0-1.7-.5-2-1.5Z" />
        </g>
        {/* The bracket under the desktop and the column */}
        <path d="M192 236l18 6h92l18-6Z" />
        <path d="M208 236h96l3 164H205Z" />
      </g>
    </svg>
  );
}

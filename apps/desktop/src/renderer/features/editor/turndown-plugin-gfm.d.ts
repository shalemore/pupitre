// The GFM plugin for Turndown ships without type declarations
declare module "@joplin/turndown-plugin-gfm" {
  import type TurndownService from "turndown";

  export const gfm: TurndownService.Plugin;
}

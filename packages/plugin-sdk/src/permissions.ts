import { z } from "zod";

/**
 * What a plugin may reach beyond its own sandbox. A manifest lists the ones it needs; the host
 * shows them to the user before the plugin runs and checks every call against the granted list.
 */
export const PERMISSIONS = [
  "document:read",
  "document:write",
  "editor:selection",
  "editor:scroll",
  "clipboard:read",
  "clipboard:write",
  "notifications",
  "network",
  "storage",
  "ui:styles",
  "ui:background",
  "ui:pointer",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const permissionSchema = z.enum(PERMISSIONS);

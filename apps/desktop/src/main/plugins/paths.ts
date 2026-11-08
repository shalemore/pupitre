import { join } from "node:path";
import { app } from "electron";

/** Where the user's plugins live; the app's own are compiled in and need no folder. */
export function pluginsFolder(): string {
  return join(app.getPath("userData"), "plugins");
}

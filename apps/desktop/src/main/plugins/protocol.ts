import { readFile, realpath } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { pluginIdSchema } from "@pupitre/plugin-sdk";
import { protocol, type Session } from "electron";
import log from "electron-log/main";
import { isInside } from "../is-inside";
import { pluginsFolder } from "./paths";

const SCHEME = "pupitre-plugin";

const MIME: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const HOST_CSP = [
  "default-src 'none'",
  "script-src 'self' pupitre-plugin: 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: pupitre-plugin:",
  "font-src 'self' data: pupitre-plugin:",
  "media-src 'self' pupitre-plugin:",
  "connect-src 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

function contentType(path: string): string {
  return MIME[extname(path).toLowerCase()] ?? "application/octet-stream";
}

async function fileResponse(path: string, heap: string): Promise<Response> {
  return new Response(await readFile(path), {
    headers: {
      "content-type": contentType(path),
      "content-security-policy": heap,
      "cache-control": "no-store",
    },
  });
}

function notFound(): Response {
  return new Response("Not found", { status: 404 });
}

/** The scheme has to be registered before the app is ready, so a page can be served later. */
export function registerPluginScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
    },
  ]);
}

/**
 * Serves the two things a plugin page loads: the host page the app owns, and the files of the
 * plugin itself. Every plugin path is resolved through its real path, so neither `..` nor a
 * symbolic link can reach outside the plugin's folder.
 */
async function serve(request: Request): Promise<Response> {
  try {
    const renderer = join(import.meta.dirname, "../renderer");
    const url = new URL(request.url);
    const id = pluginIdSchema.parse(url.hostname);
    const path = decodeURIComponent(url.pathname);
    if (path === "/__host__/" || path === "/__host__/index.html") {
      return fileResponse(join(renderer, "plugin-host/index.html"), HOST_CSP);
    }
    if (path === "/__surface__/" || path === "/__surface__/surface.html") {
      return fileResponse(join(renderer, "plugin-host/surface.html"), HOST_CSP);
    }
    if (path.startsWith("/assets/")) {
      // Vite writes the host page's scripts and styles beside the renderer's; `/assets/` is the
      // app's own, so a plugin's file of that name is served from its folder only under another name
      return fileResponse(join(renderer, "assets", path.slice("/assets/".length)), HOST_CSP);
    }

    const folder = join(pluginsFolder(), id);
    const target = resolve(folder, `.${path}`);
    if (!isInside(folder, target)) return notFound();
    const realFolder = await realpath(folder);
    const realTarget = await realpath(target);
    if (!isInside(realFolder, realTarget)) return notFound();
    return fileResponse(realTarget, "default-src 'none'");
  } catch (error: unknown) {
    // A page may ask for a favicon or an asset a plugin never shipped; only a real failure is worth
    // a line in the log
    log.debug(`The plugin protocol could not serve ${request.url}`, error);
    return notFound();
  }
}

/** The handler belongs to the session it serves; plugin pages live in sessions of their own. */
export function handlePluginProtocol(): void {
  protocol.handle(SCHEME, serve);
}

export function handlePluginProtocolForSession(session: Session): void {
  session.protocol.handle(SCHEME, serve);
}

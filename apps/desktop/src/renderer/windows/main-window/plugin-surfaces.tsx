import type { PluginInfo } from "@pupitre/desktop-api";
import type { Permission, PointerKind, PointerSample, SurfaceKind } from "@pupitre/plugin-sdk";
import { createEffect, createSignal, on, onCleanup, onMount, Show, type Component } from "solid-js";
import { isSurfaceReady, surfaceTheme } from "@/lib/plugin-surface";
import { plugins } from "@/lib/plugins";
import { settings } from "@/lib/settings";
import { css } from "@/styled-system/css";

// Behind the text: the editor area isolates its children, so a negative layer paints over the
// card but under everything the editor draws
const backgroundFrame = css({
  position: "absolute",
  inset: "0",
  width: "full",
  height: "full",
  borderStyle: "none",
  zIndex: "behind",
  pointerEvents: "none",
});

const pointerFrame = css({
  position: "fixed",
  inset: "0",
  width: "full",
  height: "full",
  borderStyle: "none",
  zIndex: "50",
  pointerEvents: "none",
});

function surfaceUrl(plugin: PluginInfo, kind: SurfaceKind): string {
  const module = plugin.manifest.surfaces?.[kind] ?? "";
  const query = new URLSearchParams({ id: plugin.id, kind, module });
  // The development server serves the surface page; the packaged app serves it through the scheme
  return location.protocol === "file:"
    ? `pupitre-plugin://${plugin.id}/__surface__/surface.html?${query.toString()}`
    : `/plugin-host/surface.html?${query.toString()}`;
}

const SurfaceHost: Component<{ plugin: PluginInfo; kind: SurfaceKind }> = (props) => {
  let frame: HTMLIFrameElement | undefined;
  const [ready, setReady] = createSignal(false);

  const post = (message: Record<string, unknown>) => {
    frame?.contentWindow?.postMessage(
      { channel: "pupitre:surface", kind: props.kind, ...message },
      "*",
    );
  };
  const sendTheme = () => {
    if (ready()) post({ theme: surfaceTheme() });
  };

  createEffect(
    on(
      () => [settings().theme, settings().darkTheme, settings().colorScheme, settings().animations],
      () => requestAnimationFrame(sendTheme),
      { defer: true },
    ),
  );

  onMount(() => {
    let queue: PointerSample[] = [];
    let pending = 0;
    const flush = () => {
      pending = 0;
      if (!ready()) return;
      for (const sample of queue.splice(0)) post({ pointer: sample });
    };
    const enqueue = (sample: PointerSample) => {
      queue.push(sample);
      if (pending === 0) pending = requestAnimationFrame(flush);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame?.contentWindow || !isSurfaceReady(event.data)) return;
      if (event.data.kind !== props.kind) return;
      setReady(true);
      sendTheme();
    };
    window.addEventListener("message", onMessage);

    const listeners: (() => void)[] = [];
    if (props.kind === "pointer") {
      const add = (type: PointerKind) => (event: PointerEvent) => {
        enqueue({ type, x: event.clientX, y: event.clientY, buttons: event.buttons });
      };
      const move = add("move");
      const down = add("down");
      const up = add("up");
      const out = (event: PointerEvent) => {
        if (event.relatedTarget !== null) return;
        enqueue({ type: "leave", x: event.clientX, y: event.clientY, buttons: 0 });
      };
      window.addEventListener("pointermove", move, { passive: true });
      window.addEventListener("pointerdown", down, { passive: true });
      window.addEventListener("pointerup", up, { passive: true });
      window.addEventListener("pointerout", out, { passive: true });
      listeners.push(
        () => window.removeEventListener("pointermove", move),
        () => window.removeEventListener("pointerdown", down),
        () => window.removeEventListener("pointerup", up),
        () => window.removeEventListener("pointerout", out),
      );
    }

    onCleanup(() => {
      window.removeEventListener("message", onMessage);
      if (pending !== 0) cancelAnimationFrame(pending);
      for (const remove of listeners) remove();
    });
  });

  return (
    <iframe
      ref={(element) => (frame = element)}
      src={surfaceUrl(props.plugin, props.kind)}
      title=""
      sandbox="allow-scripts"
      referrerpolicy="no-referrer"
      aria-hidden="true"
      tabIndex={-1}
      class={props.kind === "background" ? backgroundFrame : pointerFrame}
    />
  );
};

const SURFACE_PERMISSION: Readonly<Record<SurfaceKind, Permission>> = {
  background: "ui:background",
  pointer: "ui:pointer",
};

/** The first running plugin granted its layer, either behind the document or over the window. */
function surfacePlugin(kind: SurfaceKind): PluginInfo | undefined {
  if (!settings().pluginEffects) return undefined;
  return plugins().find(
    (plugin) =>
      plugin.enabled &&
      plugin.granted.includes(SURFACE_PERMISSION[kind]) &&
      plugin.manifest.surfaces?.[kind] !== undefined,
  );
}

/** A canvas page behind the document, from the first running plugin that offers one. */
export const PluginBackground: Component = () => (
  <Show when={surfacePlugin("background")}>
    {(plugin) => <SurfaceHost plugin={plugin()} kind="background" />}
  </Show>
);

export const PluginPointer: Component = () => (
  <Show when={surfacePlugin("pointer")}>
    {(plugin) => <SurfaceHost plugin={plugin()} kind="pointer" />}
  </Show>
);

/** Whether a background canvas is taking the document's place behind the text. */
export function hasBackgroundPlugin(): boolean {
  return surfacePlugin("background") !== undefined;
}

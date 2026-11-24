import type { PluginInfo } from "@pupitre/desktop-api";
import type { Permission, PointerKind, PointerSample, SurfaceKind } from "@pupitre/plugin-sdk";
import { createEffect, createSignal, For, onSettled, Show, type Component } from "solid-js";
import { isSurfaceError, isSurfaceReady, surfaceTheme } from "@/lib/plugin-surface";
import { plugins } from "@/lib/plugins";
import { settings } from "@/lib/settings";

function surfaceUrl(plugin: PluginInfo, kind: SurfaceKind): string {
  const module = plugin.manifest.surfaces?.[kind] ?? "";
  const query = new URLSearchParams({ id: plugin.id, kind, module });
  // The development server serves the surface page; the packaged app serves it through the scheme
  return location.protocol === "file:"
    ? `pupitre-plugin://${plugin.id}/__surface__/surface.html?${query.toString()}`
    : `/plugin-host/surface.html?${query.toString()}`;
}

const SurfaceHost: Component<{ id: string; kind: SurfaceKind }> = (props) => {
  let frame: HTMLIFrameElement | undefined;
  const [ready, setReady] = createSignal(false);
  const [failed, setFailed] = createSignal(false);
  const plugin = () => plugins().find((entry) => entry.id === props.id);

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
    () =>
      [
        settings().theme,
        settings().darkTheme,
        settings().colorScheme,
        settings().animations,
      ] as const,
    () => {
      requestAnimationFrame(sendTheme);
    },
    { defer: true },
  );

  onSettled(() => {
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
      if (event.source !== frame?.contentWindow) return;
      if (isSurfaceError(event.data) && event.data.kind === props.kind) {
        setFailed(true);
        return;
      }
      if (!isSurfaceReady(event.data) || event.data.kind !== props.kind) return;
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

    return () => {
      window.removeEventListener("message", onMessage);
      if (pending !== 0) cancelAnimationFrame(pending);
      for (const remove of listeners) remove();
    };
  });

  return (
    <Show when={!failed() && plugin()}>
      {(info) => (
        <iframe
          ref={(element) => (frame = element)}
          src={surfaceUrl(info(), props.kind)}
          title=""
          sandbox="allow-scripts"
          referrerpolicy="no-referrer"
          aria-hidden="true"
          tabindex={-1}
          // Behind the text: the editor area isolates its children, so a negative layer paints over the
          // card but under everything the editor draws
          class={
            props.kind === "background"
              ? "pointer-events-none absolute inset-0 -z-1 size-full border-none"
              : "pointer-events-none fixed inset-0 z-50 size-full border-none"
          }
        />
      )}
    </Show>
  );
};

const SURFACE_PERMISSION: Readonly<Record<SurfaceKind, Permission>> = {
  background: "ui:background",
  pointer: "ui:pointer",
};

function surfacePluginIds(kind: SurfaceKind): string[] {
  if (!settings().pluginEffects) return [];
  return plugins()
    .filter(
      (plugin) =>
        plugin.enabled &&
        plugin.granted.includes(SURFACE_PERMISSION[kind]) &&
        plugin.manifest.surfaces?.[kind] !== undefined,
    )
    .map((plugin) => plugin.id);
}

/** Canvas pages behind the document, stacked in plugin order. */
export const PluginBackground: Component = () => (
  <For each={surfacePluginIds("background")}>
    {(id) => <SurfaceHost id={id} kind="background" />}
  </For>
);

export const PluginPointer: Component = () => (
  <For each={surfacePluginIds("pointer")}>{(id) => <SurfaceHost id={id} kind="pointer" />}</For>
);

/** Whether a background canvas is taking the document's place behind the text. */
export function hasBackgroundPlugin(): boolean {
  return surfacePluginIds("background").length > 0;
}

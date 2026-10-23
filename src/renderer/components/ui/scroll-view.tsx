import { debounce } from "@solid-primitives/scheduled";
import { cn } from "cn";
import {
  createSignal,
  type JSX,
  onCleanup,
  onMount,
  Show,
  splitProps,
  type ValidComponent,
} from "solid-js";
import { Dynamic } from "solid-js/web";
import { settings } from "@/lib/settings";

const IDLE_MS = 1200;
/** Space kept free at both ends of the track, so the thumb clears rounded corners. */
const TRACK_INSET = 8;
const MIN_THUMB = 24;

export interface ScrollViewProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, "onScroll"> {
  /** The element to render, for lists and landmarks that must keep their own tag. */
  as?: ValidComponent;
}

interface ThumbGeometry {
  /** Height of the scroll port; the track spans it. */
  port: number;
  top: number;
  height: number;
  /** Inline-end padding of the scroller; the overlay reaches back over it to the scroller's edge. */
  padding: number;
}

const NO_THUMB: ThumbGeometry = { port: 0, top: 0, height: 0, padding: 0 };

function measure(element: HTMLDivElement): ThumbGeometry {
  const { scrollTop, scrollHeight, clientHeight } = element;
  const range = scrollHeight - clientHeight;
  const track = clientHeight - 2 * TRACK_INSET;
  if (range <= 0 || track < MIN_THUMB) return NO_THUMB;

  const height = Math.max(MIN_THUMB, (track * clientHeight) / scrollHeight);
  return {
    port: clientHeight,
    top: TRACK_INSET + ((track - height) * scrollTop) / range,
    height,
    padding: Number.parseFloat(getComputedStyle(element).paddingInlineEnd),
  };
}

/** The edges that content is hidden behind, as `data-overflow` for the `scroll-fade` mask in app.css. */
function hiddenEdges(element: HTMLElement): string {
  const { scrollTop, scrollHeight, clientHeight } = element;
  return [scrollTop > 1 && "top", scrollTop + clientHeight < scrollHeight - 1 && "bottom"]
    .filter(Boolean)
    .join(" ");
}

/**
 * A vertically scrolling container with its own overlay scrollbar. Every scrollable area uses it,
 * so the scrollbar setting (auto-hide, always show, always hide) applies everywhere. The native
 * scrollbar cannot fade, so it is hidden and replaced by a thumb whose opacity transitions like
 * any other element, which also makes it follow the animation setting. Content fades out
 * towards an edge while there is more to scroll past it.
 */
export function ScrollView(props: ScrollViewProps) {
  const [local, rest] = splitProps(props, ["as", "class", "children", "ref"]);
  const [thumb, setThumb] = createSignal(NO_THUMB);
  const [overflow, setOverflow] = createSignal("");
  const [scrolling, setScrolling] = createSignal(false);
  const [hovering, setHovering] = createSignal(false);
  const [dragging, setDragging] = createSignal(false);
  let element: HTMLDivElement | undefined;
  let track: HTMLDivElement | undefined;
  let dragStart = { pointerY: 0, scrollTop: 0 };

  const update = () => {
    if (!element) return;
    setThumb(measure(element));
    setOverflow(hiddenEdges(element));
  };
  const stopScrolling = debounce(() => setScrolling(false), IDLE_MS);
  onCleanup(stopScrolling.clear);

  const visible = () => {
    const { scrollbar } = settings();
    return (
      scrollbar === "always" || (scrolling() && scrollbar === "auto") || dragging() || hovering()
    );
  };

  /** Scroll distance per pixel the thumb moves. */
  const scrollRatio = () => {
    if (!element) return 0;
    return (
      (element.scrollHeight - element.clientHeight) /
      (thumb().port - 2 * TRACK_INSET - thumb().height)
    );
  };

  onMount(() => {
    if (!element) return;
    // Content growing or shrinking changes the thumb without any scroll event
    const resize = new ResizeObserver(update);
    const observeChildren = () => {
      resize.disconnect();
      if (!element) return;
      resize.observe(element);
      for (const child of element.children) resize.observe(child);
      update();
    };
    const mutation = new MutationObserver(observeChildren);
    mutation.observe(element, { childList: true });
    observeChildren();
    onCleanup(() => {
      resize.disconnect();
      mutation.disconnect();
    });
  });

  return (
    <Dynamic
      component={local.as ?? "div"}
      ref={(node: HTMLDivElement) => {
        element = node;
        if (typeof local.ref === "function") local.ref(node);
      }}
      data-overflow={overflow() || undefined}
      class={cn("scroll-fade overflow-y-auto scrollbar-none print:mask-none", local.class)}
      onScroll={() => {
        update();
        setScrolling(true);
        stopScrolling();
      }}
      {...rest}
    >
      {/* Zero height and sticky: it follows the scroll port without taking part in the layout. It must stay the first child, because a sticky element placed after the content never reaches the top of the port */}
      <div
        aria-hidden="true"
        class="sticky top-0 z-10 h-0 print:hidden"
        style={{ "margin-inline-end": `-${thumb().padding}px` }}
      >
        <Show when={settings().scrollbar !== "never" && thumb().height > 0}>
          <div
            ref={(node) => (track = node)}
            class="absolute inset-e-0 top-0 w-3"
            style={{ height: `${thumb().port}px` }}
            onPointerEnter={() => setHovering(true)}
            onPointerLeave={() => setHovering(false)}
            onPointerDown={(event) => {
              if (!element || !track || event.target !== track) return;
              const offset = event.clientY - track.getBoundingClientRect().top - TRACK_INSET;
              element.scrollTop = (offset - thumb().height / 2) * scrollRatio();
            }}
          >
            <div
              class={cn(
                "absolute inset-e-0.5 w-1.5 rounded-full bg-border transition-opacity duration-sheet hover:bg-border-strong",
                visible() ? "opacity-100" : "opacity-0",
              )}
              style={{ top: `${thumb().top}px`, height: `${thumb().height}px` }}
              onPointerDown={(event) => {
                if (!element) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                dragStart = { pointerY: event.clientY, scrollTop: element.scrollTop };
                setDragging(true);
              }}
              onPointerMove={(event) => {
                if (!dragging() || !element) return;
                element.scrollTop =
                  dragStart.scrollTop + (event.clientY - dragStart.pointerY) * scrollRatio();
              }}
              onPointerUp={() => setDragging(false)}
              onPointerCancel={() => setDragging(false)}
            />
          </div>
        </Show>
      </div>
      {local.children}
    </Dynamic>
  );
}

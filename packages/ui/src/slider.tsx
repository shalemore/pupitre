import {
  Slider as UiSlider,
  SliderControl,
  SliderIndicator,
  SliderThumb,
  SliderTrack,
} from "@ui-sdk/solid/slider";
import { createSignal } from "solid-js";

export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  "aria-label"?: string;
}

export function Slider(props: SliderProps) {
  // A drag moves a local value: the settings change travels to the main process and back, and the
  // echo must not pull the thumb back under the pointer while it moves
  const [draft, setDraft] = createSignal<number>();
  let dragging = false;

  return (
    <UiSlider
      data-slot="slider"
      value={draft() ?? props.value}
      min={props.min}
      max={props.max}
      step={props.step}
      onValueChange={(next) => {
        if (typeof next !== "number") return;
        if (dragging) setDraft(next);
        props.onChange(next);
      }}
      onValueCommit={() => {
        dragging = false;
        setDraft(undefined);
      }}
      aria-label={props["aria-label"]}
      class="relative flex w-36 touch-none items-center select-none"
    >
      <SliderControl
        data-slot="slider-control"
        class="flex w-full items-center py-1.5"
        onPointerDown={() => {
          dragging = true;
        }}
      >
        <SliderTrack data-slot="slider-track" class="relative h-1 w-full rounded-full bg-input">
          <SliderIndicator
            data-slot="slider-fill"
            class="absolute left-(--slider-indicator-start) h-full w-(--slider-indicator-size) rounded-full bg-brand"
          />
          <SliderThumb
            data-slot="slider-thumb"
            index={0}
            class="absolute top-1/2 left-(--slider-thumb-position) block size-4 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full bg-knob shadow-segmented-thumb outline-none focus-visible:shadow-focus active:cursor-grabbing"
            aria-label={props["aria-label"]}
            onPointerDown={() => {
              dragging = true;
            }}
          />
        </SliderTrack>
      </SliderControl>
    </UiSlider>
  );
}

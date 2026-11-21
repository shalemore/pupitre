import {
  Slider as UiSlider,
  SliderControl,
  SliderIndicator,
  SliderThumb,
  SliderTrack,
} from "@ui-sdk/solid/slider";
import { createSignal } from "solid-js";
import { css } from "./styled-system/css";

export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  "aria-label"?: string;
}

const root = css({
  position: "relative",
  display: "flex",
  width: "36",
  touchAction: "none",
  userSelect: "none",
  alignItems: "center",
});
const control = css({ display: "flex", width: "full", alignItems: "center", paddingBlock: "1.5" });
const track = css({
  position: "relative",
  height: "1",
  width: "full",
  borderRadius: "full",
  backgroundColor: "input",
});
const fill = css({
  position: "absolute",
  left: "[var(--slider-indicator-start)]",
  width: "[var(--slider-indicator-size)]",
  height: "full",
  borderRadius: "full",
  backgroundColor: "brand",
});
const thumb = css({
  position: "absolute",
  top: "[50%]",
  left: "[var(--slider-thumb-position)]",
  translate: "[-50% -50%]",
  display: "block",
  width: "4",
  height: "4",
  borderRadius: "full",
  backgroundColor: "knob",
  boxShadow: "segmentedThumb",
  outlineStyle: "none",
  cursor: "grab",
  _active: { cursor: "grabbing" },
  _focusVisible: { boxShadow: "focus" },
});

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
      class={root}
    >
      <SliderControl
        data-slot="slider-control"
        class={control}
        onPointerDown={() => {
          dragging = true;
        }}
      >
        <SliderTrack data-slot="slider-track" class={track}>
          <SliderIndicator data-slot="slider-fill" class={fill} />
          <SliderThumb
            data-slot="slider-thumb"
            index={0}
            class={thumb}
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

import { Slider as KobalteSlider } from "@kobalte/core/slider";
import { createEffect, createSignal } from "solid-js";
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
const track = css({
  position: "relative",
  height: "1",
  width: "full",
  borderRadius: "full",
  backgroundColor: "input",
});
const fill = css({
  position: "absolute",
  height: "full",
  borderRadius: "full",
  backgroundColor: "brand",
});
const thumb = css({
  top: "-1.5",
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
  const [value, setValue] = createSignal(props.value);
  let dragging = false;

  createEffect(() => {
    const next = props.value;
    if (!dragging) setValue(next);
  });

  return (
    <KobalteSlider
      data-slot="slider"
      value={[value()]}
      minValue={props.min}
      maxValue={props.max}
      step={props.step}
      onChange={([next]) => {
        if (next === undefined) return;
        setValue(next);
        props.onChange(next);
      }}
      onChangeEnd={() => {
        dragging = false;
      }}
      aria-label={props["aria-label"]}
      class={root}
    >
      <KobalteSlider.Track
        data-slot="slider-track"
        class={track}
        onPointerDown={() => {
          dragging = true;
        }}
      >
        <KobalteSlider.Fill data-slot="slider-fill" class={fill} />
        <KobalteSlider.Thumb
          data-slot="slider-thumb"
          class={thumb}
          onPointerDown={() => {
            dragging = true;
          }}
        >
          <KobalteSlider.Input />
        </KobalteSlider.Thumb>
      </KobalteSlider.Track>
    </KobalteSlider>
  );
}

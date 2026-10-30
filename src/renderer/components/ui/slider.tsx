import { Slider as KobalteSlider } from "@kobalte/core/slider";
import { css } from "@/styled-system/css";

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
  return (
    <KobalteSlider
      data-slot="slider"
      value={[props.value]}
      minValue={props.min}
      maxValue={props.max}
      step={props.step}
      onChange={([value]) => {
        if (value !== undefined) props.onChange(value);
      }}
      aria-label={props["aria-label"]}
      class={root}
    >
      <KobalteSlider.Track data-slot="slider-track" class={track}>
        <KobalteSlider.Fill data-slot="slider-fill" class={fill} />
        <KobalteSlider.Thumb data-slot="slider-thumb" class={thumb}>
          <KobalteSlider.Input />
        </KobalteSlider.Thumb>
      </KobalteSlider.Track>
    </KobalteSlider>
  );
}

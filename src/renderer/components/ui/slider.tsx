import { Slider as KobalteSlider } from "@kobalte/core/slider";

export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  "aria-label"?: string;
}

export function Slider(props: SliderProps) {
  return (
    <KobalteSlider
      value={[props.value]}
      minValue={props.min}
      maxValue={props.max}
      step={props.step}
      onChange={([value]) => {
        if (value !== undefined) props.onChange(value);
      }}
      aria-label={props["aria-label"]}
      class="relative flex w-36 touch-none select-none items-center"
    >
      <KobalteSlider.Track class="relative h-1 w-full rounded-full bg-input">
        <KobalteSlider.Fill class="absolute h-full rounded-full bg-brand" />
        <KobalteSlider.Thumb class="-top-1.5 block size-4 rounded-full bg-knob shadow-segmented-thumb outline-none cursor-grab active:cursor-grabbing focus-visible:shadow-focus">
          <KobalteSlider.Input />
        </KobalteSlider.Thumb>
      </KobalteSlider.Track>
    </KobalteSlider>
  );
}

import { Switch as KobalteSwitch } from "@kobalte/core/switch";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
}

export function Switch(props: SwitchProps) {
  return (
    <KobalteSwitch
      data-slot="switch"
      checked={props.checked}
      onChange={props.onChange}
      disabled={props.disabled ?? false}
      aria-label={props["aria-label"]}
      class="inline-flex items-center"
    >
      <KobalteSwitch.Input class="peer" />
      <KobalteSwitch.Control
        data-slot="switch-control"
        class="inline-flex h-4.5 w-8 shrink-0 items-center rounded-full bg-input p-0.5 transition-colors cursor-pointer peer-focus-visible:shadow-focus data-checked:bg-brand data-disabled:cursor-not-allowed data-disabled:opacity-50"
      >
        <KobalteSwitch.Thumb
          data-slot="switch-thumb"
          class="size-3.5 rounded-full bg-knob shadow-sm transition-transform duration-snap ease-snap data-checked:translate-x-3.5 rtl:data-checked:-translate-x-3.5"
        />
      </KobalteSwitch.Control>
    </KobalteSwitch>
  );
}

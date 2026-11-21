import { Switch as UiSwitch, SwitchThumb } from "@ui-sdk/solid/switch";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
}

export function Switch(props: SwitchProps) {
  const disabled = () => props.disabled ?? false;

  return (
    <UiSwitch
      data-slot="switch"
      checked={props.checked}
      onCheckedChange={props.onChange}
      disabled={disabled()}
      aria-label={props["aria-label"]}
      class="inline-flex h-4.5 w-8 shrink-0 cursor-pointer items-center rounded-full bg-input p-0.5 transition-colors duration-ui ease-out-expo outline-none focus-visible:shadow-focus data-[checked]:bg-brand data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
    >
      <SwitchThumb class="size-3.5 rounded-full bg-knob shadow-sm transition-transform duration-snap ease-snap data-[checked]:translate-x-3.5 rtl:data-[checked]:-translate-x-3.5" />
    </UiSwitch>
  );
}

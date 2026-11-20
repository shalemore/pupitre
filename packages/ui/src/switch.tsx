import { Switch as UiSwitch, SwitchThumb } from "@ui-sdk/solid/switch";
import { css } from "./styled-system/css";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
}

const control = css({
  display: "inline-flex",
  height: "4.5",
  width: "8",
  flexShrink: 0,
  alignItems: "center",
  borderRadius: "full",
  backgroundColor: "input",
  padding: "0.5",
  cursor: "pointer",
  outlineStyle: "none",
  transitionProperty: "background-color",
  transitionDuration: "ui",
  transitionTimingFunction: "outExpo",
  _focusVisible: { boxShadow: "focus" },
  "&[data-checked]": { backgroundColor: "brand" },
  "&[data-disabled]": { cursor: "not-allowed", opacity: 0.5 },
});
const thumb = css({
  width: "3.5",
  height: "3.5",
  borderRadius: "full",
  backgroundColor: "knob",
  boxShadow: "sm",
  transitionProperty: "transform",
  transitionDuration: "snap",
  transitionTimingFunction: "snap",
  "&[data-checked]": { transform: "translateX(0.875rem)" },
  _rtl: { "&[data-checked]": { transform: "translateX(-0.875rem)" } },
});

export function Switch(props: SwitchProps) {
  return (
    <UiSwitch
      checked={props.checked}
      onCheckedChange={(checked) => props.onChange(checked)}
      disabled={props.disabled ?? false}
      aria-label={props["aria-label"]}
      class={control}
    >
      <SwitchThumb class={thumb} />
    </UiSwitch>
  );
}

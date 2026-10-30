import { Switch as KobalteSwitch } from "@kobalte/core/switch";
import { css } from "@/styled-system/css";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
}

const root = css({ display: "inline-flex", alignItems: "center" });
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
  transitionProperty: "background-color",
  transitionDuration: "ui",
  transitionTimingFunction: "outExpo",
  _peerFocusVisible: { boxShadow: "focus" },
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
    <KobalteSwitch
      data-slot="switch"
      checked={props.checked}
      onChange={props.onChange}
      disabled={props.disabled ?? false}
      aria-label={props["aria-label"]}
      class={root}
    >
      {/* `_peerFocusVisible` reads this marker class beside the control */}
      <KobalteSwitch.Input class="peer" />
      <KobalteSwitch.Control data-slot="switch-control" class={control}>
        <KobalteSwitch.Thumb data-slot="switch-thumb" class={thumb} />
      </KobalteSwitch.Control>
    </KobalteSwitch>
  );
}

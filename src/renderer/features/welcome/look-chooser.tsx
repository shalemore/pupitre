import { RadioGroup } from "@kobalte/core/radio-group";
import type { JSX } from "solid-js";
import type { Settings } from "@shared/settings";
import { t } from "@/i18n";
import { settings, updateSettings } from "@/lib/settings";
import { css, cx } from "@/styled-system/css";

interface LookOptionProps {
  value: Settings["windowStyle"];
  label: string;
  description: string;
  preview: JSX.Element;
}

const option = css({
  display: "flex",
  width: "48",
  cursor: "pointer",
  flexDirection: "column",
  gap: "2",
  borderRadius: "lg",
  borderWidth: "hairline",
  borderStyle: "solid",
  borderColor: "border",
  padding: "2",
  textAlign: "start",
  outlineStyle: "none",
  _focusVisible: { boxShadow: "focus" },
  _hover: { backgroundColor: "accent" },
  _checked: { borderColor: "brand", backgroundColor: "accent" },
});
const optionLabel = css({ paddingInline: "0.5" });
const optionName = css({
  display: "block",
  textStyle: "xs",
  fontWeight: "medium",
  color: "foreground",
});
const optionDescription = css({
  display: "block",
  textStyle: "2xs",
  lineHeight: "1.375",
  color: "muted.foreground",
});
const section = css({
  marginBlockEnd: "8",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "3",
});
const group = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "3",
});
const groupLabel = css({
  textStyle: "xs",
  fontWeight: "medium",
  color: "muted.foreground",
});
const options = css({ display: "flex", alignItems: "stretch", gap: "3" });
const preview = css({
  height: "16",
  borderRadius: "md",
  backgroundColor: "surface.0",
  padding: "1.5",
});
const previewPane = css({
  width: "full",
  height: "full",
  borderRadius: "sm",
  backgroundColor: "surface.1",
  boxShadow: "sm",
});
const classicPreview = css({
  display: "flex",
  height: "16",
  flexDirection: "column",
  overflow: "hidden",
  borderRadius: "md",
  borderWidth: "hairline",
  borderStyle: "solid",
  borderColor: "border",
});
const classicBar = css({
  height: "2.5",
  borderBlockEndWidth: "hairline",
  borderBlockEndStyle: "solid",
  borderBlockEndColor: "border",
  backgroundColor: "surface.0",
});
const classicBody = css({ display: "flex", flex: "1" });
const classicSidebar = css({
  width: "25%",
  borderInlineEndWidth: "hairline",
  borderInlineEndStyle: "solid",
  borderInlineEndColor: "border",
  backgroundColor: "surface.0",
});
const classicDocument = css({ flex: "1", backgroundColor: "surface.1" });
const hint = css({ textStyle: "2xs", color: "tertiary" });

const LookOption = (props: LookOptionProps) => (
  <RadioGroup.Item value={props.value} class={cx("pressable", option)}>
    <RadioGroup.ItemInput />
    <RadioGroup.ItemControl>{props.preview}</RadioGroup.ItemControl>
    <RadioGroup.ItemLabel class={optionLabel}>
      <span class={optionName}>{props.label}</span>
      <span class={optionDescription}>{props.description}</span>
    </RadioGroup.ItemLabel>
  </RadioGroup.Item>
);

/**
 * Shown on the welcome screen of the first launch only: the immersive window is what sets
 * Pupitre apart, so it is offered next to the classic one before anything else.
 */
export const LookChooser = () => (
  <section class={section}>
    <RadioGroup
      value={settings().windowStyle}
      onChange={(value) => {
        // The group hands back any string; only the two styles the settings hold are worth writing
        if (value === "classic" || value === "immersive")
          void updateSettings({ windowStyle: value });
      }}
      class={group}
    >
      <RadioGroup.Label as="h2" class={groupLabel}>
        {t().welcome.chooseLook}
      </RadioGroup.Label>
      <div class={options}>
        <LookOption
          value="immersive"
          label={t().settings.windowStyleImmersive}
          description={t().welcome.lookImmersiveDesc}
          preview={
            <div class={preview} aria-hidden="true">
              <div class={previewPane} />
            </div>
          }
        />
        <LookOption
          value="classic"
          label={t().settings.windowStyleClassic}
          description={t().welcome.lookClassicDesc}
          preview={
            <div class={classicPreview} aria-hidden="true">
              <div class={classicBar} />
              <div class={classicBody}>
                <div class={classicSidebar} />
                <div class={classicDocument} />
              </div>
            </div>
          }
        />
      </div>
    </RadioGroup>
    <p class={hint}>{t().welcome.lookHint}</p>
  </section>
);

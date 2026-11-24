import { character } from "../../app/store";
import { ui } from "../../i18n/ui";
import { FeaturesIcon } from "../play/icons";
import { Panel, RulesText } from "./parts";

/** The features the person wrote for this character, with how many uses each has. */
export function CustomFeaturesPanel() {
  const features = (character.value.custom ?? []).filter((f) => f.name.trim() !== "");
  if (features.length === 0) return null;
  return (
    <Panel title={ui("sheet.customFeatures")} tint="features" icon={FeaturesIcon}>
      {features.map((f) => (
        <RulesText
          key={f.id}
          name={f.name}
          text={f.text}
          tag={
            f.uses
              ? `${f.uses} × ${ui(f.recharge === "short" ? "play.recoverShort" : "play.recoverLong")}`
              : undefined
          }
        />
      ))}
    </Panel>
  );
}

import { printSettings } from "../../app/printSettings";
import { FeatureCards, SpellCards } from "./Cards";

/** The card pages the settings ask for: spell cards first, then feature cards. */
export function Cards() {
  const settings = printSettings.value;
  if (settings.blank) return null;
  return (
    <>
      {settings.spellCards && <SpellCards />}
      {settings.featureCards && <FeatureCards />}
    </>
  );
}

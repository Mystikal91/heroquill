import { content } from "../../app/store";
import { DAMAGE_KINDS } from "../../engine/defenses";
import type { EnvironmentRule } from "../../engine/encounter";
import { ui } from "../../i18n/ui";
import { damageName } from "../damageName";
import { damageLabel } from "../rules/ActionButtons";

export const abilityLabel = (ability: string) =>
  content.value?.name(`srd51:ability/${ability}`) ?? ability;

const damageText = ({ dice, type }: { dice: string; type?: string }) => {
  if (!type) return dice;
  // The kinds of the rules have a text of their own in each language; those of a pack have a name.
  return (DAMAGE_KINDS as readonly string[]).includes(type)
    ? damageLabel({ dice, type }, dice)
    : `${dice} ${damageName(type)}`;
};

/** What an effect of the lair does, in a line: "2d6 fire · Dexterity save DC 13 (half) · Blinded". */
export function environmentLine(rule: EnvironmentRule): string {
  const { damage, save, condition } = rule;
  return [
    damage && damageText(damage),
    save &&
      ui(save.half ? "dm.env.saveHalf" : "dm.env.saveNone", {
        ability: abilityLabel(save.ability),
        dc: save.dc,
      }),
    condition &&
      (content.value?.name(condition.id) ?? condition.id) +
        (condition.rounds ? ` (${ui("dm.saved.rounds", { n: condition.rounds })})` : ""),
  ]
    .filter(Boolean)
    .join(" · ");
}

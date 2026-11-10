import type { Entry } from "../data/schema";
import type { DerivedSheet, PackIndex } from "./derive";

/** How a feature, trait or feat is used in a turn. */
export type Activation = "action" | "bonus" | "reaction";

export const ACTIVATIONS: Activation[] = ["action", "bonus", "reaction"];

/** What the entry says it takes to use: the `data.activation` of the SRD and of Aurora's `<sheet action>`. */
export function activationOf(entry: Entry | undefined): Activation | undefined {
  const value = (entry?.data as { activation?: unknown } | undefined)?.activation;
  return value === "action" || value === "bonus" || value === "reaction" ? value : undefined;
}

/**
 * Features that have a panel of their own in Play, which turns them on: a button for them here
 * would spend a use without doing it.
 */
const OWN_PANEL =
  /^((barbarian-)?rage|wild-shape|channel-divinity-sacred-weapon|oath-of-devotion-sacred-weapon)/;

/**
 * The features, traits and feats of the character that take an action, a bonus action or a
 * reaction, by which. The ones the person hid on the sheet are left out, and so are those with a
 * panel of their own (rage, wild shape).
 */
export function characterActions(
  sheet: Pick<DerivedSheet, "features" | "traits" | "feats" | "hiddenFeatures">,
  index: PackIndex,
): Record<Activation, string[]> {
  const found: Record<Activation, string[]> = { action: [], bonus: [], reaction: [] };
  const seen = new Set<string>();
  for (const id of [...sheet.features, ...sheet.traits, ...sheet.feats]) {
    if (seen.has(id) || sheet.hiddenFeatures.includes(id)) continue;
    seen.add(id);
    if (OWN_PANEL.test(id.split("/")[1] ?? "")) continue;
    const activation = activationOf(index.get(id));
    if (activation) found[activation].push(id);
  }
  return found;
}

/** What a feature heals, as dice and a number: `1d10+5`, or `9` when it has no dice (Wholeness of Body). */
export function healExpression(heal: { dice?: string; bonus: number }): string {
  return heal.dice
    ? `${heal.dice}${heal.bonus > 0 ? `+${heal.bonus}` : heal.bonus < 0 ? String(heal.bonus) : ""}`
    : String(heal.bonus);
}

/** The breath weapon a dragonborn has from the ancestry chosen, worked out for the character. */
export interface BreathWeapon {
  dice: string;
  damageType: string;
  dc: number;
  /** The ability of the saving throw. */
  save: string;
  /** The shape and the length of the exhalation, in feet. */
  area: { type: string; size: number };
  /** A creature that makes the save takes half. */
  half: boolean;
}

interface BreathData {
  areaOfEffect?: { size?: number; type?: string };
  dc?: { dcType?: { index?: string }; successType?: string };
  damage?: { damageType?: { index?: string }; damageAtCharacterLevel?: Record<string, string> }[];
}

/**
 * The breath weapon of the SRD: the ancestry the character chose holds the damage by level, the
 * damage type, the area and the save; the DC is 8 + proficiency + Constitution modifier.
 */
export function breathWeaponOf(
  sheet: Pick<DerivedSheet, "traits" | "level" | "proficiencyBonus" | "abilities">,
  index: PackIndex,
): BreathWeapon | undefined {
  for (const id of sheet.traits) {
    const specific = (index.get(id)?.data as { traitSpecific?: { breathWeapon?: BreathData } })
      ?.traitSpecific?.breathWeapon;
    const damage = specific?.damage?.[0];
    if (!specific || !damage?.damageAtCharacterLevel) continue;
    const steps = Object.entries(damage.damageAtCharacterLevel)
      .map(([level, dice]) => ({ level: Number(level), dice }))
      .filter((s) => s.level <= sheet.level)
      .sort((a, b) => b.level - a.level);
    const dice = steps[0]?.dice;
    if (!dice) continue;
    return {
      dice,
      damageType: damage.damageType?.index ?? "",
      dc: 8 + sheet.proficiencyBonus + sheet.abilities.con.modifier,
      save: specific.dc?.dcType?.index ?? "dex",
      area: { type: specific.areaOfEffect?.type ?? "", size: specific.areaOfEffect?.size ?? 0 },
      half: specific.dc?.successType === "half",
    };
  }
  return undefined;
}

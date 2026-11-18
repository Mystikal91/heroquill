import type { Ability, ModifierCondition, ModifierTarget } from "../data/schema";
import type { SourcedEffect } from "./choices";

/** What the character wears: the conditions of armor, shield and unarmored features read this. */
export interface ArmorState {
  /** Body armor is worn (a shield alone does not count). */
  wearing: boolean;
  heavy: boolean;
  shield: boolean;
}

/** What an attack is made with, for the conditions that depend on the weapon. */
export interface WeaponState {
  kind: "melee" | "ranged";
  /** The weapon is held in both hands: it is two-handed, or a versatile one used two-handed. */
  twoHanded: boolean;
  /** How many weapons are in hand. */
  held: number;
}

/** A modifier that applies, with the entry that gives it. */
export interface AppliedModifier {
  target: ModifierTarget;
  value: number;
  source: string;
  /** The skill a bonus to skills is for; every skill when absent. */
  skill?: string;
}

export interface ModifierState {
  armor: ArmorState;
  weapon?: WeaponState;
  /** The level that counts for what an entry gives: its class's, or the whole character's. */
  levelOf?: (source: string) => number;
  /** What a bonus that adds an ability or the proficiency bonus needs (without it they add nothing). */
  abilityModifier?: (ability: Ability) => number;
  proficiencyBonus?: number;
}

export function holds(
  when: ModifierCondition | undefined,
  { armor, weapon }: ModifierState,
): boolean {
  switch (when) {
    case undefined:
      return true;
    case "wearingArmor":
      return armor.wearing;
    case "heavyArmor":
      return armor.heavy;
    case "unarmored":
      return !armor.wearing;
    case "noHeavyArmor":
      return !armor.heavy;
    case "unarmoredNoShield":
      return !armor.wearing && !armor.shield;
    case "wearingShield":
      return armor.shield;
    case "ranged":
      return weapon?.kind === "ranged";
    case "melee":
      return weapon?.kind === "melee";
    case "dueling":
      return weapon?.kind === "melee" && !weapon.twoHanded && weapon.held === 1;
  }
}

/** The modifiers of one target that apply in the given state. */
export function appliedModifiers(
  sourced: SourcedEffect[],
  target: ModifierTarget,
  state: ModifierState,
): AppliedModifier[] {
  const applied: AppliedModifier[] = [];
  for (const { effect, source } of sourced) {
    if (effect.type !== "modifier" || effect.target !== target) continue;
    if (effect.minLevel !== undefined && (state.levelOf?.(source) ?? 0) < effect.minLevel) continue;
    const plus =
      effect.plus === undefined
        ? 0
        : effect.plus === "proficiency"
          ? (state.proficiencyBonus ?? 0)
          : (state.abilityModifier?.(effect.plus) ?? 0);
    if (holds(effect.when, state))
      applied.push({
        target,
        value:
          effect.min === undefined
            ? effect.value + plus
            : Math.max(effect.min, effect.value + plus),
        source,
        ...(effect.skill && { skill: effect.skill }),
      });
  }
  return applied;
}

export const total = (modifiers: AppliedModifier[]) =>
  modifiers.reduce((sum, m) => sum + m.value, 0);

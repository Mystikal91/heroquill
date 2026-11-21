import type { Effect } from "../data/schema";
import type { Combatant } from "./encounter";

/**
 * The numbers of a creature in a fight once its effects are counted: a spell that gives +2 to armor
 * class, one that doubles the speed, an effect written by hand. Pure, and only the simple ones apply:
 * a plain bonus to `ac`, `speed`, `initiative` or `hp`, a floor for the armor class (Barkskin), a
 * multiplier for the speed (Haste). The others (a bonus that adds an ability modifier, a die for rolls)
 * are shown by the panel of effects and left for the person to count, as they depend on a sheet the
 * tracker does not have.
 */

export interface NumberPart {
  /** The name of the effect it comes from. */
  source: string;
  value: number;
}

export interface Defense {
  source: string;
  kind: "resistance" | "immunity" | "vulnerability";
  damage: string;
}

export interface CombatantNumbers {
  ac: number;
  /** Walking speed in feet; undefined when the creature has none written down. */
  speed?: number;
  initiativeBonus: number;
  maxHp: number;
  /** What was added to each number, by effect, to explain it. */
  parts: { ac: NumberPart[]; speed: NumberPart[]; initiative: NumberPart[]; hp: NumberPart[] };
  /** The armor class is at least this (Barkskin), and the effect that says so. */
  floor?: NumberPart;
  /** The speed is multiplied (Haste), and the effect that says so. */
  multiplier?: NumberPart;
  defenses: Defense[];
}

/** A modifier the tracker can count: nothing that depends on a level, a skill, a condition or an ability. */
const isSimple = (e: Extract<Effect, { type: "modifier" }>): boolean =>
  e.plus === undefined && e.when === undefined && e.minLevel === undefined && e.skill === undefined;

export function combatantNumbers(c: Combatant): CombatantNumbers {
  const parts: CombatantNumbers["parts"] = { ac: [], speed: [], initiative: [], hp: [] };
  const defenses: Defense[] = [];
  let floor: NumberPart | undefined;
  let multiplier: NumberPart | undefined;
  for (const tracked of c.effects) {
    for (const effect of tracked.effects ?? []) {
      const source = tracked.name;
      if (effect.type === "modifier" && isSimple(effect)) {
        const list =
          effect.target === "ac"
            ? parts.ac
            : effect.target === "speed"
              ? parts.speed
              : effect.target === "initiative"
                ? parts.initiative
                : effect.target === "hp"
                  ? parts.hp
                  : undefined;
        list?.push({ source, value: effect.value });
      } else if (effect.type === "armorClassFloor") {
        if (!floor || effect.value > floor.value) floor = { source, value: effect.value };
      } else if (effect.type === "speedMultiplier") {
        if (!multiplier || effect.value > multiplier.value) {
          multiplier = { source, value: effect.value };
        }
      } else if (effect.type === "defense") {
        defenses.push({ source, kind: effect.kind, damage: effect.damage });
      }
    }
  }
  const sum = (list: NumberPart[]) => list.reduce((total, p) => total + p.value, 0);
  const speedBase = c.speed === undefined ? undefined : c.speed + sum(parts.speed);
  return {
    ac: Math.max(0, Math.max(c.ac, floor?.value ?? 0) + sum(parts.ac)),
    ...(speedBase !== undefined && {
      speed: Math.max(0, Math.round(speedBase * (multiplier?.value ?? 1))),
    }),
    initiativeBonus: c.initiativeBonus + sum(parts.initiative),
    maxHp: Math.max(1, c.maxHp + sum(parts.hp)),
    parts,
    ...(floor && { floor }),
    ...(multiplier && { multiplier }),
    defenses,
  };
}

/** The most hit points a creature can have now. */
export const effectiveMaxHp = (c: Combatant): number => combatantNumbers(c).maxHp;

/** What is added to the d20 for its initiative now. */
export const effectiveInitiativeBonus = (c: Combatant): number =>
  combatantNumbers(c).initiativeBonus;

/** A number as a sentence: `15 +2 Shield of Faith`, for a tooltip. Empty when nothing changes it. */
export function explainNumber(
  base: number,
  parts: NumberPart[],
  extra: { floor?: NumberPart; multiplier?: NumberPart } = {},
): string {
  if (parts.length === 0 && !extra.floor && !extra.multiplier) return "";
  const lines = [
    `${base}`,
    ...(extra.floor ? [`${extra.floor.source}: ≥ ${extra.floor.value}`] : []),
    ...parts.map((p) => `${p.value >= 0 ? "+" : "−"}${Math.abs(p.value)} ${p.source}`),
    ...(extra.multiplier ? [`×${extra.multiplier.value} ${extra.multiplier.source}`] : []),
  ];
  return lines.join(" · ");
}

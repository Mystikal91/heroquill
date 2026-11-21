import { combatantNumbers } from "./combatantNumbers";
import type { Combatant, Encounter } from "./encounter";
import { hurt } from "./encounter";

/**
 * Damage by kind, against what a creature resists, is immune to or is vulnerable to: the DM types an
 * amount and picks a kind, and the tracker takes the resistance off the hit by itself. Pure.
 */

export type DefenseKind = "resistance" | "immunity" | "vulnerability";

/** The kinds of damage of the rules, in the order the pickers list them. */
export const DAMAGE_KINDS = [
  "acid",
  "bludgeoning",
  "cold",
  "fire",
  "force",
  "lightning",
  "necrotic",
  "piercing",
  "poison",
  "psychic",
  "radiant",
  "slashing",
  "thunder",
] as const;

export interface DefenseLine {
  kind: DefenseKind;
  damage: string;
}

/** What a creature of the rules has by nature: the lists of its entry (`damageResistances`...). */
export function innateDefenses(data: unknown): DefenseLine[] {
  const d = (data ?? {}) as Record<string, unknown>;
  const lines: DefenseLine[] = [];
  for (const [field, kind] of [
    ["damageVulnerabilities", "vulnerability"],
    ["damageResistances", "resistance"],
    ["damageImmunities", "immunity"],
  ] as const) {
    const list = d[field];
    if (Array.isArray(list))
      for (const damage of list) if (typeof damage === "string") lines.push({ kind, damage });
  }
  return lines;
}

/** All the defenses a creature has now: its own (from its entry or its sheet) and those of its effects. */
export function defensesOf(c: Combatant, innate: readonly DefenseLine[] = []): DefenseLine[] {
  const fromEffects = combatantNumbers(c).defenses.map(({ kind, damage }) => ({ kind, damage }));
  const own: DefenseLine[] = [];
  for (const kind of ["vulnerability", "resistance", "immunity"] as const)
    for (const damage of c.defenses?.[kind] ?? []) own.push({ kind, damage });
  return [...innate, ...own, ...fromEffects];
}

export interface DamageResult {
  dealt: number;
  /** Which defenses changed the amount, if any. */
  applied: DefenseKind[];
}

/**
 * What a hit of `amount` of one kind does to a creature with these defenses: nothing at all for an
 * immunity, half (rounded down) for a resistance, then double for a vulnerability. Several of one kind
 * count once. A hit with no kind is as it is.
 */
export function damageDealt(
  amount: number,
  damage: string | undefined,
  defenses: readonly DefenseLine[],
): DamageResult {
  const base = Math.max(0, Math.floor(amount));
  if (!damage) return { dealt: base, applied: [] };
  const has = (kind: DefenseKind) => defenses.some((d) => d.kind === kind && d.damage === damage);
  if (has("immunity")) return { dealt: 0, applied: ["immunity"] };
  let dealt = base;
  const applied: DefenseKind[] = [];
  if (has("resistance")) {
    dealt = Math.floor(dealt / 2);
    applied.push("resistance");
  }
  if (has("vulnerability")) {
    dealt *= 2;
    applied.push("vulnerability");
  }
  return { dealt, applied };
}

/** Who is hit by an area and how: fully, or halved because they saved. */
export type AreaPick = "fail" | "save";

/**
 * Damage to several creatures at once (a fireball): the ones that failed the save take the full amount,
 * the ones that saved take half (rounded down); each then goes through its own defenses. Gives the
 * encounter and what each creature took, so the screen can say it and take it back.
 */
export function areaDamage(
  encounter: Encounter,
  picks: Readonly<Record<string, AreaPick>>,
  amount: number,
  damage: string | undefined,
  defensesFor: (c: Combatant) => readonly DefenseLine[],
): { encounter: Encounter; taken: { id: string; dealt: number }[] } {
  const taken: { id: string; dealt: number }[] = [];
  const combatants = encounter.combatants.map((c) => {
    const pick = picks[c.id];
    if (!pick) return c;
    const hit = pick === "save" ? Math.floor(amount / 2) : amount;
    const { dealt } = damageDealt(hit, damage, defensesFor(c));
    taken.push({ id: c.id, dealt });
    return hurt(c, dealt);
  });
  return { encounter: { ...encounter, combatants, updated: Date.now() }, taken };
}

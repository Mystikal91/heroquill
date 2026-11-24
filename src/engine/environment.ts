import { type AreaPick, type DefenseLine, areaDamage } from "./defenses";
import { type RandomInt, cryptoRandomInt, rollD20 } from "./dice";
import {
  type Combatant,
  type Encounter,
  type EnvironmentRule,
  abilityModifier,
  setConditionRounds,
  toggleCondition,
} from "./encounter";

/**
 * What a lair or environment effect (a room on fire, a poison swamp) does when the lair acts: a saving
 * throw, a damage and a condition, on the creatures the DM says are inside. Pure.
 */

/** The bonus of a monster to a saving throw: the one its stat block has, or the modifier; undefined when there are no abilities. */
export function saveBonus(data: unknown, ability: string): number | undefined {
  const m = (data ?? {}) as { abilities?: Record<string, number>; saves?: Record<string, number> };
  const own = m.saves?.[ability];
  if (typeof own === "number") return own;
  const score = m.abilities?.[ability];
  return typeof score === "number" ? abilityModifier(score) : undefined;
}

/** What the conditions in force do to a save: some fail it outright, being restrained makes a Dexterity save harder. */
export function saveHindrance(
  c: Pick<Combatant, "conditions">,
  ability: string,
): { fails?: true; disadvantage?: true } {
  const has = (slug: string) => c.conditions.some((id) => id.split("/")[1] === slug);
  if (
    (ability === "str" || ability === "dex") &&
    ["paralyzed", "petrified", "stunned", "unconscious"].some(has)
  )
    return { fails: true };
  return ability === "dex" && has("restrained") ? { disadvantage: true } : {};
}

export interface SaveRoll {
  id: string;
  /** None when it failed without a roll. */
  total?: number;
  passed: boolean;
}

/** Rolls the save of each creature that has a bonus; the others (players, creatures made by hand) are left to be marked. */
export function rollSaves(
  creatures: readonly {
    id: string;
    bonus: number | undefined;
    fails?: boolean;
    disadvantage?: boolean;
  }[],
  dc: number,
  random: RandomInt = cryptoRandomInt,
): SaveRoll[] {
  return creatures.flatMap(({ id, bonus, fails, disadvantage }): SaveRoll[] => {
    if (bonus === undefined) return [];
    if (fails) return [{ id, passed: false }];
    const total = rollD20(bonus, disadvantage ? "disadvantage" : "normal", random).total;
    return [{ id, total, passed: total >= dc }];
  });
}

/** The marks that count: with no save to make, everybody inside is hit in full. */
export function environmentPicks(
  rule: EnvironmentRule,
  picks: Readonly<Record<string, AreaPick>>,
): Record<string, AreaPick> {
  if (rule.save) return { ...picks };
  return Object.fromEntries(Object.keys(picks).map((id) => [id, "fail" as const]));
}

/** A condition from outside: one already there with no limit, or a longer one, is not shortened. */
export function giveCondition(c: Combatant, id: string, rounds: number | undefined): Combatant {
  if (!c.conditions.includes(id)) return setConditionRounds(toggleCondition(c, id), id, rounds);
  const left = c.rounds[id];
  if (left === undefined) return c;
  return setConditionRounds(c, id, rounds === undefined ? undefined : Math.max(left, rounds));
}

export interface EnvironmentResult {
  encounter: Encounter;
  taken: { id: string; dealt: number }[];
  /** Who got the condition. */
  conditioned: string[];
}

/**
 * Applies an effect to the creatures inside: the ones that failed take the damage and the condition, the
 * ones that saved half of the damage or nothing. Each goes through its own defenses and immunities.
 */
export function applyEnvironment(
  encounter: Encounter,
  rule: EnvironmentRule,
  picks: Readonly<Record<string, AreaPick>>,
  amount: number,
  defensesFor: (c: Combatant) => readonly DefenseLine[],
  immuneTo: (c: Combatant) => readonly string[] = () => [],
): EnvironmentResult {
  const marked = environmentPicks(rule, picks);
  const hit = Object.fromEntries(
    Object.entries(marked).filter(([, pick]) => pick === "fail" || rule.save?.half),
  );
  const done =
    rule.damage && amount > 0
      ? areaDamage(encounter, hit, amount, rule.damage.type, defensesFor)
      : { encounter, taken: [] };
  const condition = rule.condition;
  if (!condition) return { ...done, conditioned: [] };
  const slug = condition.id.split("/")[1] ?? condition.id;
  const conditioned: string[] = [];
  const combatants = done.encounter.combatants.map((c) => {
    if (marked[c.id] !== "fail" || immuneTo(c).includes(slug)) return c;
    conditioned.push(c.id);
    return giveCondition(c, condition.id, condition.rounds);
  });
  return {
    encounter: { ...done.encounter, combatants, updated: Date.now() },
    taken: done.taken,
    conditioned,
  };
}

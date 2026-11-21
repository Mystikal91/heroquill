import { ABILITIES, type Ability } from "../data/schema";
import type { AbilityMethod, Character } from "./character";

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

export const POINT_BUY_BUDGET = 27;
export const POINT_BUY_MIN = 8;
export const POINT_BUY_MAX = 15;

/** What the point buy allows: the points to spend, the lowest and highest score, and the price of each score. */
export interface PointBuyRules {
  budget: number;
  min: number;
  max: number;
  /** Points a score costs, by score. */
  costs: Record<string, number>;
}

/** The price of a score the SRD table does not list: 2 points a step up to 17, 3 above, and a refund below 8. */
export function defaultPointCost(score: number): number {
  const table: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
  const known = table[score];
  if (known !== undefined) return known;
  if (score < 8) return score - 8;
  let cost = 9;
  for (let n = 16; n <= score; n++) cost += n <= 17 ? 2 : 3;
  return cost;
}

/** The rules of the book: 27 points, scores 8 to 15. */
export const standardPointBuy = (): PointBuyRules => ({
  budget: POINT_BUY_BUDGET,
  min: POINT_BUY_MIN,
  max: POINT_BUY_MAX,
  costs: Object.fromEntries(
    Array.from({ length: POINT_BUY_MAX - POINT_BUY_MIN + 1 }, (_, i) => [
      POINT_BUY_MIN + i,
      defaultPointCost(POINT_BUY_MIN + i),
    ]),
  ),
});

const STANDARD_POINT_BUY = standardPointBuy();

/** Why a set of point buy rules cannot be used, or undefined when they can. */
export function pointBuyProblem(rules: PointBuyRules): "range" | "budget" | undefined {
  const { min, max, budget, costs } = rules;
  const whole = (n: number) => Number.isInteger(n);
  if (![min, max, budget].every(whole) || min < 1 || max > 30 || min > max) return "range";
  for (let n = min; n <= max; n++) if (!whole(costs[n] ?? Number.NaN)) return "range";
  if (budget < 0 || 6 * (costs[min] ?? 0) > budget) return "budget";
  return undefined;
}

/** Points a single score costs in the point buy (0 for a score the rules do not list). */
export const pointBuyCost = (score: number, rules: PointBuyRules = STANDARD_POINT_BUY) =>
  rules.costs[score] ?? 0;

/** Points spent by a set of scores; Infinity if any score is outside the rules' range. */
export function pointBuySpent(
  base: Record<Ability, number>,
  rules: PointBuyRules = STANDARD_POINT_BUY,
): number {
  return ABILITIES.reduce((sum, a) => sum + (rules.costs[base[a]] ?? Number.POSITIVE_INFINITY), 0);
}

export const pointBuyRemaining = (
  base: Record<Ability, number>,
  rules: PointBuyRules = STANDARD_POINT_BUY,
) => rules.budget - pointBuySpent(base, rules);

export function canRaise(
  base: Record<Ability, number>,
  ability: Ability,
  rules: PointBuyRules = STANDARD_POINT_BUY,
): boolean {
  const current = rules.costs[base[ability]];
  const next = rules.costs[base[ability] + 1];
  return (
    current !== undefined &&
    next !== undefined &&
    base[ability] < rules.max &&
    next - current <= pointBuyRemaining(base, rules)
  );
}

export const canLower = (
  base: Record<Ability, number>,
  ability: Ability,
  rules: PointBuyRules = STANDARD_POINT_BUY,
) => base[ability] > rules.min;

/** Sets every score to the lowest the rules allow: the point buy starts again. */
export function restartPointBuy(draft: Character, rules?: PointBuyRules): void {
  draft.pointBuyRules = rules;
  for (const ability of ABILITIES) draft.abilityBase[ability] = (rules ?? STANDARD_POINT_BUY).min;
}

/** One ability score by the usual method: roll four d6, drop the lowest, add the rest. */
export function rollOneScore(random: () => number = Math.random): number {
  const dice = Array.from({ length: 4 }, () => 1 + Math.floor(random() * 6));
  return dice.reduce((a, b) => a + b, 0) - Math.min(...dice);
}

export const rollAbilityScores = (random: () => number = Math.random) =>
  Array.from({ length: 6 }, () => rollOneScore(random)).sort((a, b) => b - a);

/** The values that can be assigned to abilities under `standard` or `roll`. */
export function assignableValues(character: Pick<Character, "abilityMethod" | "abilityRolls">) {
  if (character.abilityMethod === "standard") return STANDARD_ARRAY;
  if (character.abilityMethod === "roll") return character.abilityRolls ?? [];
  return [];
}

/**
 * Gives `ability` the chosen value. If another ability already holds it, the two swap, so the
 * set of values (standard array or rolls) is always preserved.
 */
export function assignValue(base: Record<Ability, number>, ability: Ability, value: number) {
  const next = { ...base };
  const holder = ABILITIES.find((a) => a !== ability && next[a] === value);
  if (holder) next[holder] = next[ability];
  next[ability] = value;
  return next;
}

/** Switches the generation method, resetting scores to a valid starting point for it. */
export function applyAbilityMethod(
  draft: Character,
  method: AbilityMethod,
  random: () => number = Math.random,
): void {
  draft.abilityMethod = method;
  draft.abilityRolls = undefined;
  if (method === "manual") return;

  let values: number[];
  if (method === "standard") {
    values = STANDARD_ARRAY;
  } else if (method === "roll") {
    values = rollAbilityScores(random);
    draft.abilityRolls = values;
  } else {
    values = ABILITIES.map(() => (draft.pointBuyRules ?? STANDARD_POINT_BUY).min);
  }
  ABILITIES.forEach((ability, i) => {
    draft.abilityBase[ability] = values[i] ?? POINT_BUY_MIN;
  });
}

/** Rolls a fresh set of six values and assigns them in order. */
export function reroll(draft: Character, random: () => number = Math.random): void {
  applyAbilityMethod(draft, "roll", random);
}

import type { Entry } from "../data/schema";
import { formatDice, parseDice } from "./dice";

/**
 * The house rules a table can turn on in place of the book's. They are a setting of the device, not of a character:
 * the app passes them to the engine, which never reads them from storage.
 */
export interface HouseRules {
  /** A short rest gives back half the hit point maximum at once, with no hit dice to roll (they can still be spent). */
  quickRests?: boolean;
  /** A critical hit counts the damage dice at their highest, then rolls them once and adds the modifiers. */
  crunchyCrits?: boolean;
  /** Every character takes a feat at the 1st level, besides what the species and the background give. */
  levelOneFeat?: boolean;
  /** Drinking a potion is a bonus action (the 2014 rules ask for an action; the 2024 rules already allow it). */
  potionBonusAction?: boolean;
  /** Every level after the first gives the highest of the hit die, not the average or a roll. */
  maxHitPoints?: boolean;
  /** The 2024 exhaustion (−2 to the d20 tests and −5 feet of speed for each level) also for the 2014 characters. */
  modernExhaustion?: boolean;
  /** A new class can be taken without the minimum ability scores that multiclassing asks for. */
  freeMulticlass?: boolean;
  /** Gaining a level also takes a long rest. */
  restOnLevelUp?: boolean;
}

export type HouseRule = keyof HouseRules;

/** The house rules in the order the page shows them. */
export const HOUSE_RULES: HouseRule[] = [
  "quickRests",
  "restOnLevelUp",
  "crunchyCrits",
  "potionBonusAction",
  "levelOneFeat",
  "maxHitPoints",
  "freeMulticlass",
  "modernExhaustion",
];

/** No house rule: the book as written. */
export const NO_HOUSE_RULES: HouseRules = Object.freeze({});

/** Keeps only the known rules that are on: what is read back from storage may hold anything. */
export function cleanHouseRules(raw: unknown): HouseRules {
  if (!raw || typeof raw !== "object") return {};
  const source = raw as Record<string, unknown>;
  return Object.fromEntries(
    HOUSE_RULES.filter((rule) => source[rule] === true).map((rule) => [rule, true]),
  );
}

/**
 * The source of the feat of the 1st level: an entry of its own, so the pick is kept in `selections` under
 * `house:rule/level-one-feat/feat` like any other choice, and is left aside (not lost) while the rule is off.
 */
export const HOUSE_FEAT_SOURCE = "house:rule/level-one-feat";

export const houseFeatEntry: Entry = {
  id: HOUSE_FEAT_SOURCE,
  kind: "option",
  effects: [{ type: "choice", id: "feat", choose: 1, grants: "feat", from: [] }],
  data: {},
};

/** The edition whose exhaustion applies: the 2024 one for everybody with the house rule. */
export const exhaustionRuleset = (ruleset: string, rules: HouseRules): string =>
  rules.modernExhaustion ? "srd52" : ruleset;

/** The hit points a short rest gives back with the quick rests: half the maximum, rounded down. */
export const quickRestHealing = (max: number): number => Math.floor(Math.max(0, max) / 2);

/**
 * A crunchy critical: the dice once, plus their highest total as a flat number. `2d6+3` is `2d6+15` (12 for the
 * dice at their highest, 3 for the modifier); a flat number stays as it is. Text that is not a plain sum of dice
 * (a monster's `2d6 + 3`) keeps its form and gets the number added at the end.
 */
export function crunchyDice(text: string): string {
  const highest = [...text.matchAll(/(\d*)d(\d+)/gi)].reduce(
    (sum, m) => sum + (m[1] ? Number(m[1]) : 1) * Number(m[2]),
    0,
  );
  if (highest === 0) return text;
  const parsed = parseDice(text);
  return parsed
    ? formatDice({ terms: parsed.terms, modifier: parsed.modifier + highest })
    : `${text}+${highest}`;
}

/** True for an item that is a potion: a healing one, or one named so in its id. */
export const isPotion = (itemId: string, heals: boolean): boolean =>
  heals || /\/potions?-/i.test(itemId);

import { effect, signal } from "@preact/signals";
import { doubleDice } from "../engine/dice";
import {
  type HouseRule,
  type HouseRules,
  cleanHouseRules,
  crunchyDice,
} from "../engine/houseRules";
import { doubleDice as doubleMonsterDice } from "../engine/monsterRolls";
import { ui } from "../i18n/ui";

const STORAGE_KEY = "houseRules";

function readInitial(): HouseRules {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? cleanHouseRules(JSON.parse(saved)) : {};
  } catch {
    // Storage may be refused, or hold something unreadable: the book as written.
    return {};
  }
}

/** The house rules turned on, on this device, for every character. */
export const houseRules = signal<HouseRules>(readInitial());

effect(() => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(houseRules.value));
  } catch {
    // Ignore: the choice just won't persist.
  }
});

export function setHouseRule(rule: HouseRule, on: boolean) {
  const next = { ...houseRules.value };
  if (on) next[rule] = true;
  else delete next[rule];
  houseRules.value = next;
}

/** How many house rules are on. */
export const houseRulesOn = (): number => Object.keys(houseRules.value).length;

/** The damage of a character's critical hit: the dice doubled, or crunchy with the house rule. */
export const critDice = (dice: string): string =>
  houseRules.value.crunchyCrits ? crunchyDice(dice) : (doubleDice(dice) ?? dice);

/** The damage of a creature's critical hit (a monster, a companion), the same way. */
export const critMonsterDice = (dice: string): string =>
  houseRules.value.crunchyCrits ? crunchyDice(dice) : doubleMonsterDice(dice);

/** The word written after the name of a critical damage roll. */
export const critLabel = (): string =>
  ui(houseRules.value.crunchyCrits ? "play.crunchyDamage" : "play.criticalDamage");

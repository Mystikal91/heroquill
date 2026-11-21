import { type Owner, addToDice, plusValue } from "./scaling";

/** One kind of damage an action deals: `2d6+3` of `piercing`. */
export interface DamagePart {
  type: string;
  dice: string;
  /** What the owner adds to the damage (`pb`, `wis`...): the numbers wait for an owner. */
  plus?: string[];
}

/** What an action of a creature can roll: the attack, and the damage it deals. */
export interface ActionRolls {
  attackBonus?: number;
  /** What the owner adds to the attack (`pb`, `spell`). */
  attackPlus?: string[];
  damage: DamagePart[];
  /** Something is still to be added by an owner: it cannot be rolled without one. */
  scaled: boolean;
}

const strings = (value: unknown): string[] | undefined =>
  Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === "string")
    ? (value as string[])
    : undefined;

/** Reads the numbers an action keeps (`attackBonus`, `damage`); what is not a number or dice is left out. */
export function actionRolls(action: {
  attackBonus?: unknown;
  attackPlus?: unknown;
  damage?: unknown;
}): ActionRolls {
  const damage = Array.isArray(action.damage)
    ? action.damage
        .filter(
          (d): d is DamagePart =>
            typeof d === "object" &&
            d !== null &&
            typeof (d as DamagePart).dice === "string" &&
            /^\d+(d\d+)?([+-]\d+)?$/i.test((d as DamagePart).dice) &&
            typeof (d as DamagePart).type === "string",
        )
        .map((d) => {
          const plus = strings((d as { plus?: unknown }).plus);
          return { type: d.type, dice: d.dice, ...(plus && { plus }) };
        })
    : [];
  const attackPlus = strings(action.attackPlus);
  return {
    ...(typeof action.attackBonus === "number" && { attackBonus: action.attackBonus }),
    ...(attackPlus && { attackPlus }),
    damage,
    scaled: Boolean(attackPlus) || damage.some((d) => d.plus),
  };
}

/**
 * What can be rolled now: an action that adds something of its owner (the proficiency bonus, the
 * spell attack modifier) gets it from the owner, and has nothing to roll where there is none.
 */
export function resolveRolls(
  rolls: ActionRolls,
  owner: Owner | undefined,
): ActionRolls | undefined {
  if (!rolls.scaled) return rolls;
  if (!owner) return undefined;
  return {
    ...(rolls.attackBonus !== undefined && {
      attackBonus: rolls.attackBonus + plusValue(rolls.attackPlus, owner),
    }),
    damage: rolls.damage.map((d) => ({
      type: d.type,
      dice: addToDice(d.dice, plusValue(d.plus, owner)),
    })),
    scaled: false,
  };
}

/** A critical hit rolls the dice of the damage twice: `2d6+3` is `4d6+3`, and a flat number stays. */
export const doubleDice = (dice: string): string =>
  dice.replace(
    /(\d+)d(\d+)/gi,
    (_, count: string, sides: string) => `${Number(count) * 2}d${sides}`,
  );

/**
 * Who rolls an action and where it goes: the play screen logs the rolls of the person's creatures, the
 * Dungeon Master's table rolls against a target and takes the damage off it.
 */
export interface MonsterRoller {
  /** Rolls one attack of an action; true for a critical hit. `n` of `of` numbers the attacks of a multiattack. */
  attack(action: string, bonus: number, n?: number, of?: number): boolean;
  /** Rolls the damage of one kind; `shown` is the button's text (`2d6 piercing`). */
  damage(action: string, kind: string, dice: string, shown: string): void;
}

/** Whether an attack roll hits: a natural 20 always does, a natural 1 never does, the rest must reach the armor class. */
export const attackHits = (
  roll: { total: number; critical: boolean; fumble: boolean },
  ac: number,
) => roll.critical || (!roll.fumble && roll.total >= ac);

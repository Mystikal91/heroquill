import { addLog, rollCheck, rollDiceText } from "../../app/play";
import {
  type DamagePart,
  type MonsterRoller,
  actionRolls,
  doubleDice,
  resolveRolls,
} from "../../engine/monsterRolls";
import type { Owner } from "../../engine/scaling";
import { type UiKey, signed, ui } from "../../i18n/ui";

const DAMAGE_TYPES = [
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
];

/** The dice of a kind of damage as a button says them: `2d6+3 piercing`, in the language. */
export const damageLabel = (part: DamagePart, dice: string) =>
  DAMAGE_TYPES.includes(part.type)
    ? ui(`monster.damage.${part.type}` as UiKey, { dice })
    : `${dice} ${part.type}`;

/** The rolls of the play screen: into the history, with the person's own way of rolling. */
export const playRoller = (who: string): MonsterRoller => ({
  attack: (action, bonus, n, of) =>
    rollCheck(of && of > 1 ? `${who}: ${action} (${n})` : `${who}: ${action}`, bonus).critical,
  damage: (action, _kind, dice, shown) => {
    const what = `${who}: ${action} (${shown})`;
    // A flat number has nothing to roll: it goes to the history as it is.
    if (/^\d+$/.test(dice)) addLog({ label: what, detail: "", total: Number(dice) });
    else rollDiceText(what, dice);
  },
});

/** Rolls the attack of an action as many times as asked, and says if any of them was a critical hit. */
export function rollAttacks(
  roller: MonsterRoller,
  name: string,
  action: object,
  owner: Owner | undefined,
  count = 1,
): boolean {
  const bonus = resolveRolls(actionRolls(action), owner)?.attackBonus;
  if (bonus === undefined) return false;
  let critical = false;
  for (let n = 1; n <= count; n++) if (roller.attack(name, bonus, n, count)) critical = true;
  return critical;
}

/**
 * Buttons to roll what an action of a creature does: the attack, and the damage of each kind.
 * A critical hit makes the damage buttons roll the dice twice, until the next attack; whether it
 * happened is kept by the stat block, so that a multiattack can arm the damage of its attacks.
 */
export function ActionButtons({
  who,
  name,
  action,
  owner,
  critical,
  onAttack,
  roller,
}: {
  /** Whose action it is, for the history of rolls. */
  who: string;
  name: string;
  action: object;
  /** The one the creature belongs to, for what grows with them (the proficiency bonus). */
  owner?: Owner;
  /** The last attack of this action was a critical hit. */
  critical: boolean;
  onAttack: (critical: boolean) => void;
  /** Where the rolls go; the play history when there is none. */
  roller?: MonsterRoller;
}) {
  const rolls = resolveRolls(actionRolls(action), owner);
  if (!rolls || (rolls.attackBonus === undefined && rolls.damage.length === 0)) return null;
  const rolling = roller ?? playRoller(who);
  const { attackBonus } = rolls;

  const hurt = (part: DamagePart) => {
    const dice = critical ? doubleDice(part.dice) : part.dice;
    rolling.damage(name, part.type, dice, damageLabel(part, dice));
  };

  return (
    <div class="monster-rolls">
      {attackBonus !== undefined && (
        <button
          type="button"
          class="secondary"
          onClick={() => onAttack(rollAttacks(rolling, name, action, owner))}
        >
          {ui("monster.rollAttack", { bonus: signed(attackBonus) })}
        </button>
      )}
      {rolls.damage.map((part) => (
        <button
          type="button"
          key={`${part.type}${part.dice}`}
          class={critical ? "secondary crit" : "secondary"}
          onClick={() => hurt(part)}
        >
          {damageLabel(part, critical ? doubleDice(part.dice) : part.dice)}
        </button>
      ))}
      {critical && <em>{ui("play.critical")}</em>}
    </div>
  );
}

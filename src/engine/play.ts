import { type PlayState, createPlayState } from "./character";
import { RAGE_ROUNDS, SACRED_WEAPON_ROUNDS, SHILLELAGH_ROUNDS } from "./durations";

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Current hit points: `undefined` in the saved state means full, and it never exceeds the maximum. */
export function currentHp(play: PlayState, max: number): number {
  return clamp(play.hp ?? max, 0, max);
}

export type DeathStatus = "alive" | "dying" | "stable" | "dead";

/** At 0 hit points a character is dying, until three successes make them stable or three failures kill. */
export function deathStatus(play: PlayState, max: number): DeathStatus {
  if (play.deathSaves.failures >= 3) return "dead";
  if (currentHp(play, max) > 0) return "alive";
  return play.deathSaves.successes >= 3 ? "stable" : "dying";
}

/**
 * Damage hits temporary hit points first. Damage taken at 0 hit points is a failed death save,
 * and damage that leaves 0 with at least the maximum still to spare kills outright.
 */
export function applyDamage(play: PlayState, max: number, amount: number): PlayState {
  const damage = Math.max(0, Math.floor(amount));
  if (damage === 0) return play;
  const before = currentHp(play, max);

  const absorbed = Math.min(play.tempHp, damage);
  const remaining = damage - absorbed;
  const hp = Math.max(0, before - remaining);
  const next: PlayState = { ...play, hp, tempHp: play.tempHp - absorbed };

  const overflow = remaining - before;
  if (before === 0 && remaining > 0) {
    next.deathSaves = {
      ...play.deathSaves,
      failures: Math.min(3, play.deathSaves.failures + 1),
    };
  }
  if (hp === 0 && overflow >= max) next.deathSaves = { ...next.deathSaves, failures: 3 };
  return next;
}

/** Healing raises hit points up to the maximum, and any healing from 0 ends the dying state. */
export function applyHealing(play: PlayState, max: number, amount: number): PlayState {
  const heal = Math.max(0, Math.floor(amount));
  if (heal === 0 || play.deathSaves.failures >= 3) return play;
  const before = currentHp(play, max);
  const next: PlayState = { ...play, hp: Math.min(max, before + heal) };
  if (before === 0) next.deathSaves = { successes: 0, failures: 0 };
  return next;
}

/** Temporary hit points do not stack: a new amount only replaces a smaller one. */
export function gainTempHp(play: PlayState, amount: number): PlayState {
  const gained = Math.max(0, Math.floor(amount));
  return gained > play.tempHp ? { ...play, tempHp: gained } : play;
}

/** Moves one death save pip: marks the next success or failure, or unmarks the last one. */
export function setDeathSave(
  play: PlayState,
  kind: "successes" | "failures",
  count: number,
): PlayState {
  return { ...play, deathSaves: { ...play.deathSaves, [kind]: clamp(count, 0, 3) } };
}

/**
 * What a death save does: a 20 brings back one hit point (and clears the saves), a 1 counts as two
 * failures, 10 or more is a success and anything lower a failure.
 */
export function deathSaveRoll(play: PlayState, max: number, natural: number): PlayState {
  if (natural >= 20) return applyHealing(play, max, 1);
  const { successes, failures } = play.deathSaves;
  if (natural <= 1) return setDeathSave(play, "failures", failures + 2);
  return natural >= 10
    ? setDeathSave(play, "successes", successes + 1)
    : setDeathSave(play, "failures", failures + 1);
}

/** Brings a character back to 1 hit point, with the death saves cleared: as if the saves had been passed. */
export function revive(play: PlayState): PlayState {
  return { ...play, hp: 1, deathSaves: { successes: 0, failures: 0 } };
}

/** Spell slots still available at one spell level, given how many the class has. */
export function slotsLeft(play: PlayState, level: number, total: number): number {
  return Math.max(0, total - (play.slotsUsed[level - 1] ?? 0));
}

/** Sets how many slots of a level are spent, never below 0 or above the total. */
export function setSlotsUsed(
  play: PlayState,
  level: number,
  used: number,
  total: number,
): PlayState {
  const slotsUsed = [...play.slotsUsed];
  slotsUsed[level - 1] = clamp(used, 0, total);
  return { ...play, slotsUsed };
}

/** Which slot a cast used: a slot of the spell slot table, or a Pact Magic slot. */
export type CastSlot = { kind: "slot" | "pact"; level: number };

/**
 * Spends the lowest slot that can hold a spell of this level: a spell slot of the same level or
 * higher, then a Pact Magic slot. Returns undefined, and changes nothing, when none is left.
 */
export function castSpell(
  play: PlayState,
  spellLevel: number,
  spellSlots: number[],
  pact?: { level: number; count: number },
): { play: PlayState; slot: CastSlot } | undefined {
  for (let level = Math.max(1, spellLevel); level <= spellSlots.length; level++) {
    const total = spellSlots[level - 1] ?? 0;
    if (total > 0 && slotsLeft(play, level, total) > 0)
      return {
        play: setSlotsUsed(play, level, (play.slotsUsed[level - 1] ?? 0) + 1, total),
        slot: { kind: "slot", level },
      };
  }
  if (pact && pact.level >= spellLevel && pactLeft(play, pact.count) > 0)
    return {
      play: setPactUsed(play, (play.pactUsed ?? 0) + 1, pact.count),
      slot: { kind: "pact", level: pact.level },
    };
  return undefined;
}

/** What a spell slot costs in sorcery points to make (Flexible Casting): the slot level and its price. */
export const SLOT_COSTS: Record<number, number> = { 1: 2, 2: 3, 3: 5, 4: 6, 5: 7 };

/** The pool of sorcery points: its id and how many there are at most. */
export interface PointPool {
  id: string;
  max: number;
}

/** Whether a slot of this level can be made now: it costs no more than the points left. */
export function canCreateSlot(play: PlayState, level: number, pool: PointPool): boolean {
  const cost = SLOT_COSTS[level];
  return cost !== undefined && resourceLeft(play, pool.id, pool.max) >= cost;
}

/**
 * Makes a spell slot of the level from sorcery points, up to the 5th: the points are spent and the
 * slot is there until a long rest. Nothing changes when the points do not reach.
 */
export function createSlot(play: PlayState, level: number, pool: PointPool): PlayState {
  const cost = SLOT_COSTS[level];
  if (cost === undefined || !canCreateSlot(play, level, pool)) return play;
  const created = [...(play.createdSlots ?? Array.from({ length: 9 }, () => 0))];
  created[level - 1] = (created[level - 1] ?? 0) + 1;
  const spent = setResourceUsed(
    play,
    pool.id,
    (play.resourcesUsed?.[pool.id] ?? 0) + cost,
    pool.max,
  );
  return { ...spent, createdSlots: created };
}

/** The sorcery points a slot of the level gives when it is spent, never more than the pool lacks. */
export function pointsFromSlot(play: PlayState, level: number, pool: PointPool): number {
  return Math.min(level, play.resourcesUsed?.[pool.id] ?? 0);
}

/**
 * Spends a spell slot to gain as many sorcery points as its level (the pool never goes over its
 * maximum). `total` is the slots of that level the character has now, made ones included. Nothing
 * changes when there is no slot, or when no point would be gained.
 */
export function convertSlot(
  play: PlayState,
  level: number,
  total: number,
  pool: PointPool,
): PlayState {
  const gain = pointsFromSlot(play, level, pool);
  if (gain <= 0 || slotsLeft(play, level, total) <= 0) return play;
  const spent = setSlotsUsed(play, level, (play.slotsUsed[level - 1] ?? 0) + 1, total);
  return setResourceUsed(spent, pool.id, (spent.resourcesUsed?.[pool.id] ?? 0) - gain, pool.max);
}

/** Hit dice of one size that are still unspent. */
export function hitDiceLeft(play: PlayState, die: string, total: number): number {
  return Math.max(0, total - (play.hitDiceUsed[die] ?? 0));
}

/**
 * Spends one hit die: heals the roll plus the Constitution modifier (at least 0).
 * The caller rolls the die so the roll can be shown to the player.
 */
export function spendHitDie(
  play: PlayState,
  max: number,
  die: string,
  rolled: number,
  conModifier: number,
): PlayState {
  const spent: PlayState = {
    ...play,
    hitDiceUsed: { ...play.hitDiceUsed, [die]: (play.hitDiceUsed[die] ?? 0) + 1 },
  };
  return applyHealing(spent, max, Math.max(0, rolled + conModifier));
}

/** Pact Magic slots still available. */
export function pactLeft(play: PlayState, total: number): number {
  return Math.max(0, total - (play.pactUsed ?? 0));
}

/** Sets how many Pact Magic slots are spent, never below 0 or above the total. */
export function setPactUsed(play: PlayState, used: number, total: number): PlayState {
  return { ...play, pactUsed: clamp(used, 0, total) };
}

/** What a short rest gives back: a lone warlock's slots, a multiclass warlock's pact slots, or nothing. */
export type ShortRestRecovery = "all" | "pact" | "none";

/**
 * A short rest. Warlocks get their pact slots back; everyone else's slots wait for a long rest.
 * Hit dice are spent separately, one at a time, so the player can stop when healthy enough.
 */
export function shortRest(
  play: PlayState,
  recovers: ShortRestRecovery,
  /** Ids of the class resources that come back on a short rest. */
  resources: string[] = [],
  /** Resources that get only some uses back on a short rest (the 2024 Rage: one). */
  partial: { id: string; count: number }[] = [],
): PlayState {
  // A rage and the cantrip Shillelagh last a minute: a short rest has ended them.
  let next = endMagicWeapon(endSacredWeapon(endShillelagh(endRage(play))));
  if (recovers === "all") next = { ...next, slotsUsed: next.slotsUsed.map(() => 0), pactUsed: 0 };
  else if (recovers === "pact") next = { ...next, pactUsed: 0 };
  if ((resources.length > 0 || partial.length > 0) && next.resourcesUsed) {
    const used = { ...next.resourcesUsed };
    for (const id of resources) delete used[id];
    for (const { id, count } of partial)
      if (used[id] !== undefined) used[id] = Math.max(0, used[id] - count);
    next = { ...next, resourcesUsed: used };
  }
  return next;
}

/** Uses of a class resource still available. */
export function resourceLeft(play: PlayState, id: string, max: number): number {
  return Math.max(0, max - (play.resourcesUsed?.[id] ?? 0));
}

/** Sets how many uses of a class resource are spent, never below 0 or above the maximum. */
export function setResourceUsed(play: PlayState, id: string, used: number, max: number): PlayState {
  return { ...play, resourcesUsed: { ...play.resourcesUsed, [id]: clamp(used, 0, max) } };
}

/** Starts concentrating on a spell, which ends any concentration already going. */
export function startConcentration(
  play: PlayState,
  spell: string,
  /** The rounds the spell lasts, when they can be counted: they run out and end it. */
  rounds?: number,
): PlayState {
  const next: PlayState = { ...withoutRounds(play, ["concentration"]), concentration: spell };
  return rounds ? setRounds(next, "concentration", rounds) : next;
}

export function endConcentration(play: PlayState): PlayState {
  const { concentration: _ended, ...rest } = play;
  return withoutRounds(rest, ["concentration"]);
}

/** The Constitution save DC to keep concentrating after taking damage: 10 or half, if higher. */
export function concentrationDc(damage: number): number {
  return Math.max(10, Math.floor(damage / 2));
}

/** The dice a Bardic Inspiration can be (d6 at the start, up to d12 at level 15). */
export const BARDIC_DICE = [6, 8, 10, 12] as const;

/** Gives or takes away the inspiration of the character (the DM's gift, or spent). */
export const setInspiration = (play: PlayState, on: boolean): PlayState => ({
  ...play,
  inspiration: on,
});

/** Holds a die of Bardic Inspiration (or lets go of it with `undefined`). */
export function setBardicDie(play: PlayState, die: number | undefined): PlayState {
  const { bardicDie: _gone, ...rest } = play;
  return die === undefined ? rest : { ...rest, bardicDie: die };
}

/**
 * A long rest: full hit points, no temporary hit points, all slots back, no death saves, and
 * half of the hit dice (at least one) regained, largest dice first.
 */
export function longRest(play: PlayState, hitDice: Record<string, number>): PlayState {
  const totalDice = Object.values(hitDice).reduce((sum, n) => sum + n, 0);
  let regain = Math.max(1, Math.floor(totalDice / 2));

  const hitDiceUsed = { ...play.hitDiceUsed };
  const bySize = Object.keys(hitDiceUsed).sort((a, b) => Number(b.slice(1)) - Number(a.slice(1)));
  for (const die of bySize) {
    const back = Math.min(regain, hitDiceUsed[die] ?? 0);
    hitDiceUsed[die] = (hitDiceUsed[die] ?? 0) - back;
    regain -= back;
  }

  return {
    ...createPlayState(),
    inspiration: play.inspiration,
    conditions: play.conditions,
    // The rounds of the conditions stay with them; a rest ended the rest (a concentration, a rage).
    ...keptRounds(play),
    hitDiceUsed: Object.fromEntries(Object.entries(hitDiceUsed).filter(([, n]) => n > 0)),
  };
}

/** The most rounds a condition can be given. */
export const MAX_ROUNDS = 999;

/** What a long rest keeps of the rounds: those of the conditions that are still in force. */
function keptRounds(play: PlayState): { rounds?: Record<string, number> } {
  const kept = Object.fromEntries(
    Object.entries(play.rounds ?? {}).filter(([id]) => play.conditions.includes(id)),
  );
  return Object.keys(kept).length > 0 ? { rounds: kept } : {};
}

export function toggleCondition(play: PlayState, id: string): PlayState {
  if (!play.conditions.includes(id)) return { ...play, conditions: [...play.conditions, id] };
  // A condition taken off takes its rounds with it.
  return withoutRounds({ ...play, conditions: play.conditions.filter((c) => c !== id) }, [id]);
}

function withoutRounds(play: PlayState, ids: string[]): PlayState {
  if (!play.rounds) return play;
  const left = Object.fromEntries(Object.entries(play.rounds).filter(([id]) => !ids.includes(id)));
  const { rounds: _gone, ...rest } = play;
  return Object.keys(left).length > 0 ? { ...rest, rounds: left } : rest;
}

/** The rounds left for something, or `undefined` when it has no limit. */
export const roundsLeft = (play: PlayState, id: string): number | undefined => play.rounds?.[id];

/** Sets the rounds left of a condition (0, or `undefined`, takes the limit off). */
export function setRounds(play: PlayState, id: string, rounds: number | undefined): PlayState {
  const n = Math.min(MAX_ROUNDS, Math.trunc(rounds ?? 0));
  if (!(n >= 1)) return withoutRounds(play, [id]);
  return { ...play, rounds: { ...play.rounds, [id]: n } };
}

/**
 * Passes a round: one round less for everything that has a limit, and what has none left ends (a
 * condition is taken off). Gives the new state and the ids of what ended.
 */
export function advanceRound(play: PlayState): { play: PlayState; ended: string[] } {
  const rounds = play.rounds;
  if (!rounds) return { play, ended: [] };
  const left: Record<string, number> = {};
  const ended: string[] = [];
  for (const [id, n] of Object.entries(rounds)) {
    if (n - 1 >= 1) left[id] = n - 1;
    else ended.push(id);
  }
  const { rounds: _old, ...rest } = play;
  let next: PlayState = {
    ...rest,
    conditions: play.conditions.filter((c) => !ended.includes(c)),
    ...(Object.keys(left).length > 0 && { rounds: left }),
  };
  // What the rounds were counting ends with them: the concentration, the rage, the cantrip.
  if (ended.includes("concentration")) next = endConcentration(next);
  if (ended.includes("rage")) next = endRage(next);
  if (ended.includes("shillelagh")) next = endShillelagh(next);
  if (ended.includes("sacredWeapon")) next = endSacredWeapon(next);
  return { play: next, ended };
}

/** Enters a rage, spending one of its uses (unless they are unlimited, `max` of 0). */
export function enterRage(
  play: PlayState,
  resource?: { id: string; max: number },
  rounds: number = RAGE_ROUNDS,
): PlayState {
  const spent = resource
    ? setResourceUsed(play, resource.id, (play.resourcesUsed?.[resource.id] ?? 0) + 1, resource.max)
    : play;
  // A rage lasts a minute: ten rounds (in 2024 up to ten minutes).
  return setRounds({ ...spent, raging: true }, "rage", rounds);
}

export function endRage(play: PlayState): PlayState {
  if (!play.raging) return play;
  const { raging: _over, ...rest } = play;
  return withoutRounds(rest, ["rage"]);
}

/** Puts the cantrip Shillelagh on a weapon, or takes it off (`undefined`). */
export function setShillelagh(play: PlayState, itemId: string | undefined): PlayState {
  if (itemId === undefined) return endShillelagh(play);
  // The cantrip lasts a minute: ten rounds.
  return setRounds({ ...play, shillelagh: itemId }, "shillelagh", SHILLELAGH_ROUNDS);
}

/** The cantrip lasts a minute: it ends at any rest, and when it is taken off. */
export function endShillelagh(play: PlayState): PlayState {
  if (play.shillelagh === undefined) return play;
  const { shillelagh: _over, ...rest } = play;
  return withoutRounds(rest, ["shillelagh"]);
}

/** Puts the Channel Divinity: Sacred Weapon on a weapon, or takes it off (`undefined`). */
export function setSacredWeapon(play: PlayState, itemId: string | undefined): PlayState {
  if (itemId === undefined) return endSacredWeapon(play);
  // It lasts a minute: ten rounds.
  return setRounds({ ...play, sacredWeapon: itemId }, "sacredWeapon", SACRED_WEAPON_ROUNDS);
}

/** Sacred Weapon lasts a minute: it ends at any rest, and when it is taken off. */
export function endSacredWeapon(play: PlayState): PlayState {
  if (play.sacredWeapon === undefined) return play;
  const { sacredWeapon: _over, ...rest } = play;
  return withoutRounds(rest, ["sacredWeapon"]);
}

/** Puts the spell Magic Weapon on a weapon with a bonus of 1 to 3, or takes it off (`undefined`). */
export function setMagicWeapon(
  play: PlayState,
  on: { itemId: string; bonus: number } | undefined,
): PlayState {
  if (!on) return endMagicWeapon(play);
  return { ...play, magicWeapon: { itemId: on.itemId, bonus: Math.min(3, Math.max(1, on.bonus)) } };
}

/** The spell lasts an hour: it ends at any rest, and when it is taken off. */
export function endMagicWeapon(play: PlayState): PlayState {
  if (play.magicWeapon === undefined) return play;
  const { magicWeapon: _over, ...rest } = play;
  return rest;
}

/** A rage ends when the barbarian is knocked unconscious. */
export function endRageIfDown(play: PlayState, max: number): PlayState {
  return play.raging && currentHp(play, max) === 0 ? endRage(play) : play;
}

/** Resistance halves the damage, rounding down. */
export const halveDamage = (amount: number): number => Math.floor(Math.max(0, amount) / 2);

/** What a creature does to the damage: nothing, a resistance (half, rounded down) or a vulnerability (double). */
export type DamageKind = "normal" | "resistant" | "vulnerable";

/** The damage that is dealt once the resistance or the vulnerability is counted. */
export function adjustDamage(amount: number, kind: DamageKind): number {
  const base = Math.max(0, Math.trunc(amount));
  return kind === "resistant" ? halveDamage(base) : kind === "vulnerable" ? base * 2 : base;
}

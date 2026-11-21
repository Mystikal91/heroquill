import type { Entry } from "../data/schema";
import { type RandomInt, cryptoRandomInt, parseDice, rollD20, rollExpression } from "./dice";
import { uuid } from "./uuid";

/**
 * The Dungeon Master's side: a fight with its creatures, the initiative order, the turns, hit points
 * and conditions. Pure: nothing here reads the screen or the storage, so the rules are tested alone.
 */

export type CombatantKind = "monster" | "character" | "manual";

/** A spell or an effect in force on a creature: not one of the conditions of the rules. */
export interface TrackedEffect {
  id: string;
  name: string;
  note?: string;
  /** The spell it was picked from, if it was. */
  spell?: string;
  /** Rounds left; none means it has no limit. */
  rounds?: number;
  /** The creature is concentrating on it: it holds only one such effect at a time. */
  concentration?: boolean;
}

export const MAX_EFFECTS = 20;

export interface Combatant {
  id: string;
  kind: CombatantKind;
  name: string;
  /** What it was made from: the monster entry, or the saved character. */
  source?: string;
  hp: number;
  maxHp: number;
  tempHp: number;
  ac: number;
  /** The walking speed in feet; undefined when it is not known. */
  speed?: number;
  /** What was rolled or typed for the order; undefined until then. */
  initiative?: number;
  /** Added to the d20 when the initiative is rolled (the Dexterity modifier of a monster). */
  initiativeBonus: number;
  /** Ids of the conditions in force. */
  conditions: string[];
  /** Rounds left of a condition that has a limit, by its id. */
  rounds: Record<string, number>;
  /** What else is in force on it: a spell, an effect written by hand, a concentration. */
  effects: TrackedEffect[];
  notes: string;
}

export interface Encounter {
  id: string;
  name: string;
  combatants: Combatant[];
  /** The round of a fight in progress; 0 before it starts. */
  round: number;
  /** The combatant whose turn it is. */
  turn?: string;
  notes: string;
  created: number;
  updated: number;
}

export const MAX_COMBATANTS = 60;
export const MAX_HP = 99999;
export const MAX_ROUNDS = 999;
export const MAX_SPEED = 999;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const whole = (n: unknown, fallback = 0) =>
  typeof n === "number" && Number.isFinite(n) ? Math.trunc(n) : fallback;

export function createEncounter(name: string, now = Date.now()): Encounter {
  return { id: uuid(), name, combatants: [], round: 0, notes: "", created: now, updated: now };
}

/** A fight is on while it has a round: the first turn starts round 1. */
export const isStarted = (encounter: Encounter): boolean => encounter.round > 0;

/** At 0 hit points: a monster is defeated, a character is down (and rolls death saves, by hand for now). */
export const isDown = (c: Combatant): boolean => c.hp <= 0;

/**
 * The turn order: the highest initiative first. A tie goes to the higher bonus, then to the one that
 * was added first (a stable sort). Those with no initiative yet follow, in the order they were added.
 */
export function initiativeOrder(combatants: readonly Combatant[]): Combatant[] {
  const rolled = combatants.filter((c) => c.initiative !== undefined);
  const waiting = combatants.filter((c) => c.initiative === undefined);
  const byOrder = [...rolled].sort(
    (a, b) => (b.initiative ?? 0) - (a.initiative ?? 0) || b.initiativeBonus - a.initiativeBonus,
  );
  return [...byOrder, ...waiting];
}

/** The combatant with the turn, if the fight is on. */
export const activeCombatant = (encounter: Encounter): Combatant | undefined =>
  encounter.combatants.find((c) => c.id === encounter.turn);

const touch = (encounter: Encounter, now = Date.now()): Encounter => ({
  ...encounter,
  updated: now,
});

/** Replaces one combatant. */
export function changeCombatant(
  encounter: Encounter,
  id: string,
  edit: (c: Combatant) => Combatant,
): Encounter {
  return touch({
    ...encounter,
    combatants: encounter.combatants.map((c) => (c.id === id ? edit(c) : c)),
  });
}

// ---- Making combatants ----

/** What a monster entry holds, as far as a fight needs it. */
interface MonsterNumbers {
  armorClass?: { value?: number }[];
  hitPoints?: number;
  hitPointsRoll?: string;
  abilities?: Record<string, number>;
  speed?: Record<string, number | true>;
}

export const abilityModifier = (score: number) => Math.floor((score - 10) / 2);

/** A creature of the rules at full health: the average hit points, or a roll of its hit dice. */
export function monsterCombatant(
  entry: Entry,
  name: string,
  options: { rollHp?: boolean } = {},
  random: RandomInt = cryptoRandomInt,
): Combatant {
  const data = entry.data as MonsterNumbers;
  const average = Math.max(1, whole(data.hitPoints, 1));
  const expression = data.hitPointsRoll ? parseDice(data.hitPointsRoll) : undefined;
  const maxHp =
    options.rollHp && expression ? Math.max(1, rollExpression(expression, random).total) : average;
  return {
    id: uuid(),
    kind: "monster",
    name,
    source: entry.id,
    hp: maxHp,
    maxHp,
    tempHp: 0,
    ac: whole(data.armorClass?.[0]?.value, 10),
    ...(typeof data.speed?.walk === "number" && { speed: data.speed.walk }),
    initiativeBonus: abilityModifier(whole(data.abilities?.dex, 10)),
    conditions: [],
    rounds: {},
    effects: [],
    notes: "",
  };
}

/** A creature made up on the spot. */
export function manualCombatant(fields: {
  name: string;
  maxHp: number;
  ac: number;
  speed?: number;
  initiativeBonus?: number;
}): Combatant {
  const maxHp = clamp(whole(fields.maxHp, 1), 1, MAX_HP);
  return {
    id: uuid(),
    kind: "manual",
    name: fields.name,
    hp: maxHp,
    maxHp,
    tempHp: 0,
    ac: clamp(whole(fields.ac, 10), 0, 99),
    ...(fields.speed !== undefined && { speed: clamp(whole(fields.speed), 0, MAX_SPEED) }),
    initiativeBonus: clamp(whole(fields.initiativeBonus, 0), -20, 30),
    conditions: [],
    rounds: {},
    effects: [],
    notes: "",
  };
}

/** A player character, from the numbers its sheet gives now. */
export function characterCombatant(fields: {
  characterId: string;
  name: string;
  hp: number;
  maxHp: number;
  tempHp: number;
  ac: number;
  speed?: number;
  initiativeBonus: number;
}): Combatant {
  const maxHp = clamp(whole(fields.maxHp, 1), 1, MAX_HP);
  return {
    id: uuid(),
    kind: "character",
    name: fields.name,
    source: fields.characterId,
    hp: clamp(whole(fields.hp, maxHp), 0, maxHp),
    maxHp,
    tempHp: Math.max(0, whole(fields.tempHp)),
    ac: clamp(whole(fields.ac, 10), 0, 99),
    ...(fields.speed !== undefined && { speed: clamp(whole(fields.speed), 0, MAX_SPEED) }),
    initiativeBonus: clamp(whole(fields.initiativeBonus, 0), -20, 30),
    conditions: [],
    rounds: {},
    effects: [],
    notes: "",
  };
}

/**
 * The names for `count` new creatures of a kind: a lone one keeps the plain name, several are
 * numbered ("Goblin 1", "Goblin 2"), and numbers continue after the ones already in the fight.
 */
export function newNames(base: string, existing: readonly string[], count: number): string[] {
  const pattern = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?: (\\d+))?$`);
  const taken = existing.flatMap((name) => {
    const match = pattern.exec(name);
    return match ? [match[1] === undefined ? 0 : Number(match[1])] : [];
  });
  if (count === 1 && taken.length === 0) return [base];
  const start = Math.max(0, ...taken) + 1;
  return Array.from({ length: count }, (_, i) => `${base} ${start + i}`);
}

/** Adds combatants at the end of the list. A fight holds at most `MAX_COMBATANTS`. */
export function addCombatants(encounter: Encounter, added: readonly Combatant[]): Encounter {
  const room = Math.max(0, MAX_COMBATANTS - encounter.combatants.length);
  return touch({ ...encounter, combatants: [...encounter.combatants, ...added.slice(0, room)] });
}

/** Takes a combatant out; if it had the turn, the turn passes to the next one. */
export function removeCombatant(encounter: Encounter, id: string): Encounter {
  const next = encounter.turn === id ? turnAfter(encounter, id) : undefined;
  const combatants = encounter.combatants.filter((c) => c.id !== id);
  const stillOn = isStarted(encounter) && combatants.length > 0;
  return touch({
    ...encounter,
    combatants,
    ...(encounter.turn === id
      ? stillOn
        ? { turn: next?.id }
        : { turn: undefined, round: combatants.length > 0 ? encounter.round : 0 }
      : {}),
  });
}

// ---- Initiative ----

/** The d20 and the bonus, as a total. */
export function rollInitiative(
  c: Combatant,
  random: RandomInt = cryptoRandomInt,
): { total: number; die: number } {
  const roll = rollD20(c.initiativeBonus, "normal", random);
  return { total: roll.total, die: roll.used };
}

export function setInitiative(
  encounter: Encounter,
  id: string,
  value: number | undefined,
): Encounter {
  return changeCombatant(encounter, id, (c) => {
    const { initiative: _old, ...rest } = c;
    return value === undefined || !Number.isFinite(value)
      ? rest
      : { ...rest, initiative: clamp(Math.trunc(value), -99, 999) };
  });
}

/**
 * Rolls the initiative of the creatures the DM rolls for. Characters keep what their players say
 * (typed in), unless `characters` is set. A combatant that already has a value keeps it unless `again` is set.
 */
export function rollAllInitiative(
  encounter: Encounter,
  options: { characters?: boolean; again?: boolean } = {},
  random: RandomInt = cryptoRandomInt,
): Encounter {
  return touch({
    ...encounter,
    combatants: encounter.combatants.map((c) => {
      if (c.kind === "character" && !options.characters) return c;
      if (c.initiative !== undefined && !options.again) return c;
      return { ...c, initiative: rollInitiative(c, random).total };
    }),
  });
}

/** A group of identical creatures acts together in many tables: one roll for the whole group, same name before the number. */
export function groupOf(encounter: Encounter, id: string): Combatant[] {
  const one = encounter.combatants.find((c) => c.id === id);
  if (!one?.source || one.kind !== "monster") return one ? [one] : [];
  return encounter.combatants.filter((c) => c.kind === "monster" && c.source === one.source);
}

// ---- Turns ----

/** The one after `id` in the turn order that can act (not down), wrapping round; undefined if none. */
function turnAfter(encounter: Encounter, id: string | undefined): Combatant | undefined {
  const order = initiativeOrder(encounter.combatants);
  const start = order.findIndex((c) => c.id === id);
  for (let step = 1; step <= order.length; step++) {
    const candidate = order[(start + step + order.length) % order.length];
    if (candidate && (candidate.kind === "character" || !isDown(candidate))) return candidate;
  }
  return undefined;
}

/** The first one in the order that can act. */
function firstToAct(encounter: Encounter): Combatant | undefined {
  const order = initiativeOrder(encounter.combatants);
  return order.find((c) => c.kind === "character" || !isDown(c)) ?? order[0];
}

/** Starts the fight: round 1, the turn to the top of the order. Nothing to do with nobody in it. */
export function startCombat(encounter: Encounter): Encounter {
  const first = firstToAct(encounter);
  if (!first) return encounter;
  return touch({ ...encounter, round: 1, turn: first.id });
}

/** Back to before the fight: no round, no turn. Initiatives and hit points stay as they are. */
export function endCombat(encounter: Encounter): Encounter {
  const { turn: _turn, ...rest } = encounter;
  return touch({ ...rest, round: 0 });
}

/** What passed when a turn ended: conditions and effects whose rounds ran out. */
export interface TurnReport {
  encounter: Encounter;
  /** The combatant whose turn ended, the ids of the conditions and the names of the effects that ended with it. */
  ended: { combatant: string; conditions: string[]; effects: string[] };
}

/**
 * Ends the turn of the active combatant and passes it on. The rounds of its conditions count down
 * at the end of its own turn ("until the end of its next turn"); one that reaches 0 ends. The turn
 * after the last one of the order is the first of the next round. Creatures at 0 hit points are skipped
 * (characters are not: they still take a turn to make death saves).
 */
export function nextTurn(encounter: Encounter): TurnReport {
  const current = activeCombatant(encounter);
  if (!isStarted(encounter) || !current) {
    return { encounter, ended: { combatant: "", conditions: [], effects: [] } };
  }
  const ended: string[] = [];
  const endedEffects: string[] = [];
  const ticked = encounter.combatants.map((c) => {
    if (c.id !== current.id) return c;
    const rounds: Record<string, number> = {};
    for (const [condition, left] of Object.entries(c.rounds)) {
      if (!c.conditions.includes(condition)) continue;
      if (left - 1 >= 1) rounds[condition] = left - 1;
      else ended.push(condition);
    }
    const effects = c.effects.flatMap((effect) => {
      if (effect.rounds === undefined) return [effect];
      if (effect.rounds - 1 >= 1) return [{ ...effect, rounds: effect.rounds - 1 }];
      endedEffects.push(effect.name);
      return [];
    });
    return { ...c, conditions: c.conditions.filter((x) => !ended.includes(x)), rounds, effects };
  });
  const base = { ...encounter, combatants: ticked };
  const order = initiativeOrder(ticked);
  const position = order.findIndex((c) => c.id === current.id);
  const next = turnAfter(base, current.id);
  // The round turns when the next one is at or before this one in the order (it wrapped).
  const nextPosition = order.findIndex((c) => c.id === next?.id);
  const wrapped = next !== undefined && nextPosition <= position;
  return {
    encounter: touch({
      ...base,
      turn: next?.id ?? encounter.turn,
      round: wrapped ? Math.min(MAX_ROUNDS, encounter.round + 1) : encounter.round,
    }),
    ended: { combatant: current.id, conditions: ended, effects: endedEffects },
  };
}

// ---- Hit points ----

/** Damage hits temporary hit points first, then the hit points, down to 0. */
export function hurt(c: Combatant, amount: number): Combatant {
  const damage = Math.max(0, Math.floor(amount));
  if (damage === 0) return c;
  const absorbed = Math.min(c.tempHp, damage);
  return { ...c, tempHp: c.tempHp - absorbed, hp: Math.max(0, c.hp - (damage - absorbed)) };
}

/** Healing raises hit points up to the maximum. */
export function heal(c: Combatant, amount: number): Combatant {
  const healed = Math.max(0, Math.floor(amount));
  if (healed === 0) return c;
  return { ...c, hp: Math.min(c.maxHp, c.hp + healed) };
}

/** Temporary hit points do not stack: a new amount only replaces a smaller one. */
export function giveTempHp(c: Combatant, amount: number): Combatant {
  const gained = Math.max(0, Math.floor(amount));
  return gained > c.tempHp ? { ...c, tempHp: gained } : c;
}

export function setMaxHp(c: Combatant, maxHp: number): Combatant {
  const max = clamp(whole(maxHp, c.maxHp), 1, MAX_HP);
  return { ...c, maxHp: max, hp: Math.min(c.hp, max) };
}

export function setHp(c: Combatant, hp: number): Combatant {
  return { ...c, hp: clamp(whole(hp, c.hp), 0, c.maxHp) };
}

// ---- Conditions ----

export function toggleCondition(c: Combatant, id: string): Combatant {
  if (!c.conditions.includes(id)) return { ...c, conditions: [...c.conditions, id] };
  const { [id]: _gone, ...rounds } = c.rounds;
  return { ...c, conditions: c.conditions.filter((x) => x !== id), rounds };
}

/** Sets the rounds left of a condition in force; 0 or nothing takes the limit off. */
export function setConditionRounds(
  c: Combatant,
  id: string,
  rounds: number | undefined,
): Combatant {
  if (!c.conditions.includes(id)) return c;
  const n = clamp(whole(rounds), 0, MAX_ROUNDS);
  const { [id]: _old, ...rest } = c.rounds;
  return { ...c, rounds: n >= 1 ? { ...rest, [id]: n } : rest };
}

// ---- Effects ----

/** How many conditions and effects are in force: the number the table shows. */
export const effectCount = (c: Combatant): number => c.conditions.length + c.effects.length;

/**
 * Puts an effect on a creature. A creature concentrates on one thing at a time: a new concentration
 * ends the old one. The rounds are kept between 1 and the most there is; none is no limit.
 */
export function addEffect(c: Combatant, effect: Omit<TrackedEffect, "id">): Combatant {
  if (c.effects.length >= MAX_EFFECTS) return c;
  const name = effect.name.trim().slice(0, 80);
  if (!name) return c;
  const rounds =
    effect.rounds !== undefined && effect.rounds >= 1
      ? Math.min(MAX_ROUNDS, Math.trunc(effect.rounds))
      : undefined;
  const note = effect.note?.trim().slice(0, 200);
  const added: TrackedEffect = {
    id: uuid(),
    name,
    ...(note && { note }),
    ...(effect.spell && { spell: effect.spell }),
    ...(rounds !== undefined && { rounds }),
    ...(effect.concentration && { concentration: true }),
  };
  const kept = added.concentration ? c.effects.filter((x) => !x.concentration) : c.effects;
  return { ...c, effects: [...kept, added] };
}

export const removeEffect = (c: Combatant, id: string): Combatant => ({
  ...c,
  effects: c.effects.filter((x) => x.id !== id),
});

/** Sets the rounds left of an effect; 0 or nothing takes the limit off. */
export function setEffectRounds(c: Combatant, id: string, rounds: number | undefined): Combatant {
  const n = clamp(whole(rounds), 0, MAX_ROUNDS);
  return {
    ...c,
    effects: c.effects.map((x) => {
      if (x.id !== id) return x;
      const { rounds: _old, ...rest } = x;
      return n >= 1 ? { ...rest, rounds: n } : rest;
    }),
  };
}

/** What is in force again after a combatant is reset for a new fight: nothing. */
export const withoutEffects = (c: Combatant): Combatant => ({
  ...c,
  conditions: [],
  rounds: {},
  effects: [],
});

// ---- Reading what was saved ----

const text = (value: unknown, fallback = "", max = 200): string =>
  typeof value === "string" ? value.slice(0, max) : fallback;

function readCombatant(raw: unknown): Combatant | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const kind: CombatantKind = r.kind === "monster" || r.kind === "character" ? r.kind : "manual";
  const maxHp = clamp(whole(r.maxHp, 1), 1, MAX_HP);
  const conditions = Array.isArray(r.conditions)
    ? r.conditions.filter((x): x is string => typeof x === "string")
    : [];
  const rounds: Record<string, number> = {};
  if (r.rounds && typeof r.rounds === "object")
    for (const [id, n] of Object.entries(r.rounds)) {
      const left = clamp(whole(n), 0, MAX_ROUNDS);
      if (left >= 1 && conditions.includes(id)) rounds[id] = left;
    }
  const effects = (Array.isArray(r.effects) ? r.effects : [])
    .slice(0, MAX_EFFECTS)
    .flatMap((e): TrackedEffect[] => {
      if (!e || typeof e !== "object") return [];
      const x = e as Record<string, unknown>;
      const name = text(x.name, "", 80).trim();
      if (!name) return [];
      const left = clamp(whole(x.rounds), 0, MAX_ROUNDS);
      const note = text(x.note, "", 200).trim();
      const spell = typeof x.spell === "string" ? x.spell : undefined;
      return [
        {
          id: text(x.id) || uuid(),
          name,
          ...(note && { note }),
          ...(spell && { spell }),
          ...(left >= 1 && { rounds: left }),
          ...(x.concentration === true && { concentration: true }),
        },
      ];
    });
  const source = typeof r.source === "string" ? r.source : undefined;
  return {
    id: text(r.id) || uuid(),
    kind,
    name: text(r.name, "?"),
    ...(source && { source }),
    hp: clamp(whole(r.hp, maxHp), 0, maxHp),
    maxHp,
    tempHp: Math.max(0, whole(r.tempHp)),
    ac: clamp(whole(r.ac, 10), 0, 99),
    ...(typeof r.speed === "number" &&
      Number.isFinite(r.speed) && { speed: clamp(Math.trunc(r.speed), 0, MAX_SPEED) }),
    ...(typeof r.initiative === "number" &&
      Number.isFinite(r.initiative) && { initiative: Math.trunc(r.initiative) }),
    initiativeBonus: clamp(whole(r.initiativeBonus), -20, 30),
    conditions,
    rounds,
    effects,
    notes: text(r.notes, "", 2000),
  };
}

/** An encounter read from storage or from a file; anything that is not one gives undefined. */
export function readEncounter(raw: unknown): Encounter | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || r.id === "") return undefined;
  const combatants = (Array.isArray(r.combatants) ? r.combatants : [])
    .map(readCombatant)
    .filter((c): c is Combatant => c !== undefined)
    .slice(0, MAX_COMBATANTS);
  const round = clamp(whole(r.round), 0, MAX_ROUNDS);
  const turn =
    typeof r.turn === "string" && combatants.some((c) => c.id === r.turn) ? r.turn : undefined;
  const now = Date.now();
  return {
    id: r.id,
    name: text(r.name),
    combatants,
    round: turn ? round : 0,
    ...(turn && { turn }),
    notes: text(r.notes, "", 5000),
    created: whole(r.created, now),
    updated: whole(r.updated, now),
  };
}

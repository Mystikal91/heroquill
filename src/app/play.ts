import { signal } from "@preact/signals";
import { healExpression } from "../engine/actions";
import type { PlayState } from "../engine/character";
import {
  type D20Mode,
  type D20Options,
  type D20Roll,
  type DiceRoll,
  cryptoRandomInt,
  parseDice,
  rollD20,
  rollExpression,
} from "../engine/dice";
import { RAGE_ROUNDS, RAGE_ROUNDS_2024 } from "../engine/durations";
import {
  type ExhaustionRoll,
  armorMode,
  exhaustionLevel,
  exhaustionMode,
} from "../engine/exhaustion";
import { healingOf, useOne } from "../engine/gear";
import { exhaustionRuleset } from "../engine/houseRules";
import {
  applyDamage,
  applyHealing,
  concentrationDc,
  currentHp,
  deathStatus,
  endConcentration,
  endRage,
  endRageIfDown,
  enterRage,
  resourceLeft,
  setBardicDie,
  setCustomEffectOn,
  setInspiration,
  setResourceUsed,
  setSpellActive,
} from "../engine/play";
import {
  type RollParts,
  addTerm,
  partsDetail,
  partsOfDice,
  partsTone,
  partsTotal,
  removeTerm,
  rerollTerm,
  setD20Mode,
} from "../engine/rollParts";
import { beastPool, damageBeast, endShapeIfDown } from "../engine/wildShape";
import { ui } from "../i18n/ui";
import { houseRules } from "./houseRules";
import { character, content, sheet, updateCharacter } from "./store";

/** The hit points before the last change, to take it back for a few seconds. */
export const hpUndo = signal<{ before: PlayState; change: number } | undefined>(undefined);
let undoTimer: ReturnType<typeof setTimeout> | undefined;
const UNDO_MS = 10_000;
/** Changes this close together (a held button, quick taps) are taken back as one. */
const BURST_MS = 1_500;
let lastChangeAt = 0;

/** Edits the play state of the open character and saves it like any other change. */
export function changePlay(edit: (play: PlayState) => PlayState, options: { undo?: boolean } = {}) {
  let remembered: { before: PlayState; change: number } | undefined;
  updateCharacter((draft) => {
    const before = draft.play;
    const after = edit(before);
    const max = vitals()?.max ?? 0;
    const change = currentHp(after, max) - currentHp(before, max);
    if (options.undo !== false && (change !== 0 || after.tempHp !== before.tempHp))
      remembered = {
        before: structuredClone(before),
        change: change || after.tempHp - before.tempHp,
      };
    draft.play = after;
  });
  if (options.undo === false) hpUndo.value = undefined;
  else if (remembered) {
    const now = Date.now();
    const earlier = hpUndo.value;
    hpUndo.value =
      earlier && now - lastChangeAt < BURST_MS
        ? { before: earlier.before, change: earlier.change + remembered.change }
        : remembered;
    lastChangeAt = now;
    clearTimeout(undoTimer);
    undoTimer = setTimeout(() => {
      hpUndo.value = undefined;
    }, UNDO_MS);
  }
}

/** Takes back the last change of hit points. */
export function undoHp() {
  const last = hpUndo.value;
  if (!last) return;
  clearTimeout(undoTimer);
  changePlay(() => last.before, { undo: false });
}

export interface LogEntry {
  id: number;
  label: string;
  /** How the total came about, e.g. `d20 [14, 7] → 14 +5`. */
  detail: string;
  total?: number;
  tone?: "critical" | "fumble";
  /** A d20 roll can be taken again or have a die added: what it takes to make it again. */
  redo?: {
    label: string;
    bonus: number;
    options: D20Options | undefined;
    check?: boolean;
    /** What kind of roll it is: exhaustion (2014) and armor worn without training give disadvantage on some. */
    kind?: ExhaustionRoll;
    /** The ability the roll uses, for the armor worn without training (Strength and Dexterity). */
    ability?: string;
  };
  /**
   * The pieces of the roll (the d20 and its mode, each die, the numbers), shown die by die and changed afterwards:
   * a die or a number added or taken away, a d20 turned into advantage. `total`, `detail` and `tone` follow them.
   */
  parts?: RollParts;
  /** Changed after it was rolled: how many times, so the online table can send it again. */
  edits?: number;
  /** A die of Bardic Inspiration is already in the total. */
  bardic?: boolean;
  /** A die of a feature (Tactical Mind) is already in the total, and this is the use it took: it can be given back. */
  boosted?: { resource: string };
}

const MAX_LOG = 40;
let nextId = 1;

/** Recent rolls, newest first. Kept in memory only: a roll history is not part of the character. */
export const rollLog = signal<LogEntry[]>([]);

/** The Constitution save DC the player owes after damage broke their concentration, if any. */
export const concentrationAlert = signal<number | undefined>(undefined);

/** The weapon whose next damage roll counts as a critical hit (dice doubled), if any. */
export const criticalWeapon = signal<string | undefined>(undefined);

/** The last attack was a critical hit, so the extra damage rolls double their dice. */
export const criticalExtra = signal(false);

/** How d20 checks are rolled until the player changes it. */
export const rollMode = signal<D20Mode>("normal");

export function addLog(entry: Omit<LogEntry, "id">) {
  // A short buzz on phones that have one, longer for a natural 20.
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function")
    navigator.vibrate(entry.tone === "critical" ? [20, 40, 20] : 12);
  rollLog.value = [{ id: nextId++, ...entry }, ...rollLog.value].slice(0, MAX_LOG);
}

export function clearLog() {
  rollLog.value = [];
}

let nextKey = 1;
/** A key for a piece of a roll, unique while the app is open. */
const newKey = () => nextKey++;

/** The numbers a log entry takes from the pieces of its roll. */
export const fromParts = (parts: RollParts) => {
  const tone = partsTone(parts);
  return { detail: partsDetail(parts), total: partsTotal(parts), ...(tone && { tone }) };
};

/** The pieces of a roll, or for a bare number (a feature that heals a fixed amount) the number as its one piece. */
function partsOf(entry: LogEntry): RollParts | undefined {
  if (entry.parts) return entry.parts;
  if (entry.total === undefined) return undefined;
  // The key is the one the roll on screen gives the bare number, so a change does not roll it again.
  return {
    terms: [{ key: -entry.id, value: Math.abs(entry.total), sign: entry.total < 0 ? -1 : 1 }],
  };
}

/** The name of what gave a die to a roll: an entry of a pack, or an effect written by hand. */
function sourceName(source: string): string {
  if (source.startsWith("custom:effect/")) {
    const id = source.slice("custom:effect/".length);
    return character.value.play.customEffects?.find((e) => e.id === id)?.name ?? id;
  }
  return content.value?.name(source) ?? source;
}

/**
 * The pieces of a d20 roll: the d20 (one or two faces), its bonus, and the dice an effect rolled with it. The DM's
 * creature rolls use it too, so they can be changed afterwards like the player's.
 */
export function d20Parts(
  roll: D20Roll,
  options?: D20Options,
  extras: { sides: number; value: number; source: string }[] = [],
): RollParts {
  return {
    d20: {
      faces: roll.dice,
      keys: roll.dice.map(() => newKey()),
      mode: roll.mode,
      critMin: options?.critMin ?? 20,
      floor: options?.floor ?? 0,
    },
    terms: [
      ...(roll.bonus !== 0
        ? [
            {
              key: newKey(),
              value: Math.abs(roll.bonus),
              sign: roll.bonus < 0 ? (-1 as const) : (1 as const),
            },
          ]
        : []),
      ...extras.map((e) => ({ key: newKey(), ...e, sign: 1 as const })),
    ],
  };
}

/** Rolls a d20 with a bonus in the current mode and records it. */
export function rollCheck(
  label: string,
  bonus: number,
  options?: D20Options,
  /** The roll is an ability check (a skill): a feature that helps with failed checks can add to it. */
  check?: boolean,
  /** An ability check, an attack roll or a saving throw: the 2014 exhaustion gives disadvantage on them. */
  kind?: ExhaustionRoll,
  /** The ability the roll uses: armor worn without training gives disadvantage on Strength and Dexterity. */
  ability?: string,
): D20Roll {
  const type = kind ?? (check ? "check" : undefined);
  const mode = armorMode(
    sheet.value?.armorClass.untrained ?? false,
    type,
    ability,
    exhaustionMode(
      exhaustionRuleset(character.value.ruleset, houseRules.value),
      exhaustionLevel(character.value.play),
      type,
      rollMode.value,
    ),
  );
  const roll = rollD20(bonus, mode, undefined, options);
  // Dice that an effect adds to this kind of roll (Bless: a d4 on attacks and saves) are rolled with it.
  const used = (sheet.value?.rollDice ?? []).filter(
    (d) => type !== undefined && d.on.includes(type),
  );
  const extras = used.map((d) => ({
    die: d.die,
    face: cryptoRandomInt(d.die) + 1,
    source: d.source,
  }));
  // A die that is spent by one roll (Guidance) ends the spell or the effect that gave it.
  const spent = used.filter((d) => d.once).map((d) => d.source);
  if (spent.length > 0)
    changePlay(
      (p) =>
        spent.reduce(
          (play, source) =>
            source.startsWith("custom:effect/")
              ? setCustomEffectOn(play, source.slice("custom:effect/".length), false)
              : setSpellActive(play, source, false),
          p,
        ),
      { undo: false },
    );
  const extra = extras.reduce((sum, e) => sum + e.face, 0);
  const parts = d20Parts(
    roll,
    options,
    extras.map((e) => ({ sides: e.die, value: e.face, source: sourceName(e.source) })),
  );
  addLog({
    label,
    ...fromParts(parts),
    parts,
    redo: {
      label,
      bonus,
      options,
      ...(check && { check }),
      ...(kind && { kind }),
      ...(ability && { ability }),
    },
  });
  return extra > 0 ? { ...roll, total: roll.total + extra } : roll;
}

/** Spends the inspiration to roll a d20 again: the new roll is the one that counts. */
export function rerollWithInspiration(entry: LogEntry) {
  const current = rollLog.value.find((e) => e.id === entry.id) ?? entry;
  const before = current.parts;
  if (!current.redo || !before?.d20 || !character.value.play.inspiration) return;
  changePlay((p) => setInspiration(p, false));
  // Only the d20 is rolled again: the bonus, the dice of effects and what was added by hand stay, and so does the
  // way of rolling (advantage given by hand is not lost).
  const faces = before.d20.faces.map(() => 1 + cryptoRandomInt(20));
  const parts: RollParts = {
    ...before,
    d20: { ...before.d20, faces, keys: faces.map(() => newKey()) },
  };
  addLog({
    label: `${current.redo.label} (${ui("play.rerolled")})`,
    ...fromParts(parts),
    parts,
    redo: current.redo,
    ...(current.bardic && { bardic: true }),
    ...(current.boosted && { boosted: current.boosted }),
  });
}

/** Spends the die of a Bardic Inspiration: it is rolled and added to the total of the d20 roll. */
export function addBardicDie(entry: LogEntry) {
  const die = character.value.play.bardicDie;
  const before = partsOf(entry);
  if (!entry.redo || !before || entry.bardic || die === undefined) return;
  changePlay((p) => setBardicDie(p, undefined));
  const parts = addTerm(before, { sides: die, sign: 1, source: ui("play.bardicShort") }, newKey());
  addLog({
    label: `${entry.label} + ${ui("play.bardicShort")}`,
    ...fromParts(parts),
    parts,
    redo: entry.redo,
    bardic: true,
    ...(entry.boosted && { boosted: entry.boosted }),
  });
}

/** What the character can add to this ability check by using a feature up: the boosts whose use is still there. */
export function boostsFor(entry: LogEntry) {
  const s = sheet.value;
  if (!s || !entry.redo?.check || entry.boosted) return [];
  const play = character.value.play;
  return s.checkBoosts.flatMap((boost) => {
    const counter = s.resources.find((r) => r.entry === boost.spends);
    return counter && resourceLeft(play, counter.id, counter.max) > 0
      ? [{ ...boost, counter }]
      : [];
  });
}

/**
 * Tactical Mind and the like: a failed ability check gets the die of the feature, and one use of the feature it
 * spends is taken. If the check fails anyway, `keepBoostedUse` gives the use back (the app does not know the DC).
 */
export function addCheckBoost(entry: LogEntry, feature: string) {
  const boost = boostsFor(entry).find((b) => b.feature === feature);
  const parsed = boost && parseDice(boost.dice);
  const before = partsOf(entry);
  if (!boost || !parsed || !entry.redo || !before) return;
  const { counter } = boost;
  changePlay((p) =>
    setResourceUsed(p, counter.id, (p.resourcesUsed?.[counter.id] ?? 0) + 1, counter.max),
  );
  const name = content.value?.name(feature) ?? feature;
  const boostParts = partsOfDice(rollExpression(parsed), newKey);
  const parts: RollParts = {
    ...before,
    terms: [...before.terms, ...boostParts.terms.map((t) => ({ ...t, source: name }))],
  };
  addLog({
    label: `${entry.label} + ${name}`,
    ...fromParts(parts),
    parts,
    redo: entry.redo,
    boosted: { resource: counter.id },
    ...(entry.bardic && { bardic: true }),
  });
}

/** The check failed even with the die: the use of the feature that was taken is given back. */
export function keepBoostedUse(entry: LogEntry) {
  const used = entry.boosted;
  const s = sheet.value;
  const counter = used && s?.resources.find((r) => r.id === used.resource);
  if (!used || !counter) return;
  changePlay((p) =>
    setResourceUsed(p, counter.id, (p.resourcesUsed?.[counter.id] ?? 0) - 1, counter.max),
  );
  const { boosted: _spent, ...rest } = entry;
  rollLog.value = rollLog.value.map((e) =>
    e.id === entry.id ? { ...rest, detail: `${entry.detail} (${ui("play.checkBoostKept")})` } : e,
  );
}

/** Rolls dice like `2d6+3` and records it. Returns undefined when the text is not a dice expression. */
export function rollDiceText(label: string, text: string): DiceRoll | undefined {
  const parsed = parseDice(text);
  if (!parsed) return undefined;
  const roll = rollExpression(parsed);
  const parts = partsOfDice(roll, newKey);
  addLog({ label, ...fromParts(parts), parts });
  return roll;
}

/**
 * Spends Heroic Inspiration (2024) to roll one die of a roll again: the new face counts and the total changes. Not
 * for the d20 of a check, which has its own button (`rerollWithInspiration`).
 */
export function rerollOneDie(entry: LogEntry, key: number) {
  if (!entry.parts || !character.value.play.inspiration) return;
  changePlay((p) => setInspiration(p, false));
  const parts = rerollTerm(entry.parts, key, newKey());
  addLog({ label: `${entry.label} (${ui("play.rerolled")})`, ...fromParts(parts), parts });
}

/**
 * Changes a roll that has landed, in place: the history, the roll on screen and the online table follow. For what
 * was forgotten before rolling (Bless, a penalty, advantage the DM granted).
 */
function editRoll(entry: LogEntry, change: (parts: RollParts) => RollParts) {
  const current = rollLog.value.find((e) => e.id === entry.id);
  const before = current && partsOf(current);
  if (!current || !before) return;
  const parts = change(before);
  if (parts === before) return;
  const { tone: _tone, ...rest } = current;
  const next: LogEntry = { ...rest, parts, ...fromParts(parts), edits: (current.edits ?? 0) + 1 };
  rollLog.value = rollLog.value.map((e) => (e.id === entry.id ? next : e));
}

/** Adds a die (rolled now) or a number to a roll that has landed; `sign` -1 takes it away. */
export const addToRoll = (
  entry: LogEntry,
  piece: { sides?: number; value?: number; sign: 1 | -1 },
) => editRoll(entry, (parts) => addTerm(parts, piece, newKey()));

/** Takes out of a roll a die or a number the person put in. */
export const removeFromRoll = (entry: LogEntry, key: number) =>
  editRoll(entry, (parts) => removeTerm(parts, key));

/** Turns the d20 of a roll that has landed into advantage, disadvantage or a plain roll. */
export const setRollModeAfter = (entry: LogEntry, mode: D20Mode) =>
  editRoll(entry, (parts) => setD20Mode(parts, mode, newKey()));

/** Hit points and the numbers the play screen needs, or undefined before the sheet exists. */
export function vitals() {
  const s = sheet.value;
  return s
    ? { max: s.hitPoints.max, hitDice: s.hitPoints.hitDice, conMod: s.abilities.con.modifier }
    : undefined;
}

/**
 * Uses up one of an item. A potion that says what it heals is rolled and the hit points are
 * restored; any other item only goes down by one and the log says it was used.
 */
export function useItem(itemId: string) {
  const c = content.value;
  const found = character.value.inventory.find((i) => i.itemId === itemId);
  if (!c || !found) return;
  const name = found.custom?.name ?? c.name(itemId);
  const heal = healingOf(c.index.get(itemId));
  updateCharacter((draft) => {
    useOne(draft.inventory, itemId);
  });
  const v = vitals();
  const roll = heal && v ? rollDiceText(name, heal) : undefined;
  if (roll && v) {
    changePlay((p) => applyHealing(p, v.max, roll.total));
    return;
  }
  addLog({ label: ui("play.used", { name }), detail: "" });
}

/**
 * A feature that heals the character when used (Second Wind: 1d10 plus the fighter level, Wholeness of Body: three
 * times the monk level): the dice are rolled and logged, and the hit points come back.
 */
export function healFromFeature(
  name: string,
  heal: { dice?: string; bonus: number; minimum?: number },
) {
  const v = vitals();
  if (!v) return;
  const rolled = heal.dice ? rollDiceText(name, healExpression(heal))?.total : heal.bonus;
  if (rolled === undefined) return;
  const total = Math.max(rolled, heal.minimum ?? 0);
  if (!heal.dice) addLog({ label: name, detail: String(heal.bonus), total });
  changePlay((p) => applyHealing(p, v.max, total));
}

/**
 * Damage to the open character, with what it does to concentration: the save to make, or the end
 * of it when the character falls unconscious.
 */
export function damageCharacter(amount: number) {
  const v = vitals();
  if (!v || amount <= 0) return;
  const play = character.value.play;
  // In the shape of a beast the beast takes the damage first; what is left over, once the shape
  // is gone, falls on the druid's own hit points.
  if (beastPool(play)) {
    const { overflow } = damageBeast(play, amount);
    changePlay((p) => damageBeast(p, amount).play, { undo: false });
    if (play.concentration) concentrationAlert.value = concentrationDc(amount);
    if (overflow > 0) damageCharacter(overflow);
    return;
  }
  const concentrating = Boolean(play.concentration);
  const after = applyDamage(play, v.max, amount);
  // A rage ends when the barbarian falls unconscious.
  const hit = (p: PlayState) =>
    endShapeIfDown(endRageIfDown(applyDamage(p, v.max, amount), v.max), v.max);
  if (concentrating && deathStatus(after, v.max) !== "alive") {
    changePlay((p) => endConcentration(hit(p)));
  } else {
    changePlay(hit);
    if (concentrating) concentrationAlert.value = concentrationDc(amount);
  }
}

/** Enters a rage, using up one of its uses; it does nothing when none is left. */
export function startRage() {
  const resource = sheet.value?.resources.find((r) => r.kind === "rage");
  const play = character.value.play;
  if (!resource || play.raging) return;
  if (!resource.unlimited && resourceLeft(play, resource.id, resource.max) === 0) return;
  changePlay(
    (p) =>
      enterRage(
        p,
        resource.unlimited ? undefined : resource,
        // 2024: the rage can be kept going for ten minutes; the person says when it ends.
        character.value.ruleset === "srd52" ? RAGE_ROUNDS_2024 : RAGE_ROUNDS,
      ),
    { undo: false },
  );
}

export function stopRage() {
  changePlay((p) => endRage(p), { undo: false });
}

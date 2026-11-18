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
  rerollDie,
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
  removeCustomEffect,
  resourceLeft,
  setBardicDie,
  setInspiration,
  setResourceUsed,
  setSpellActive,
} from "../engine/play";
import { beastPool, damageBeast, endShapeIfDown } from "../engine/wildShape";
import { ui } from "../i18n/ui";
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
  /** The dice of a roll of dice (damage, healing): with the 2024 Heroic Inspiration one of them can be rolled again. */
  dice?: DiceRoll;
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

const signedBonus = (n: number) => (n === 0 ? "" : n > 0 ? ` +${n}` : ` ${n}`);

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
      character.value.ruleset,
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
  const extras = used.map((d) => ({ die: d.die, face: cryptoRandomInt(d.die) + 1 }));
  // A die that is spent by one roll (Guidance) ends the spell or the effect that gave it.
  const spent = used.filter((d) => d.once).map((d) => d.source);
  if (spent.length > 0)
    changePlay(
      (p) =>
        spent.reduce(
          (play, source) =>
            source.startsWith("custom:effect/")
              ? removeCustomEffect(play, source.slice("custom:effect/".length))
              : setSpellActive(play, source, false),
          p,
        ),
      { undo: false },
    );
  const extra = extras.reduce((sum, e) => sum + e.face, 0);
  const faces =
    roll.dice.length > 1
      ? `[${roll.dice.join(", ")}] → ${roll.used}`
      : roll.used !== roll.natural
        ? `${roll.natural} → ${roll.used}`
        : `${roll.used}`;
  addLog({
    label,
    detail: `d20 ${faces}${signedBonus(bonus)}${extras.map((e) => ` + d${e.die} (${e.face})`).join("")}`,
    total: roll.total + extra,
    ...(roll.critical && { tone: "critical" as const }),
    ...(roll.fumble && { tone: "fumble" as const }),
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
  if (!entry.redo || !character.value.play.inspiration) return;
  changePlay((p) => setInspiration(p, false));
  const { label, bonus, options, check, kind, ability } = entry.redo;
  rollCheck(`${label} (${ui("play.rerolled")})`, bonus, options, check, kind, ability);
}

/** Spends the die of a Bardic Inspiration: it is rolled and added to the total of the d20 roll. */
export function addBardicDie(entry: LogEntry) {
  const die = character.value.play.bardicDie;
  if (!entry.redo || entry.total === undefined || entry.bardic || die === undefined) return;
  changePlay((p) => setBardicDie(p, undefined));
  const rolled = 1 + cryptoRandomInt(die);
  addLog({
    label: `${entry.label} + ${ui("play.bardicShort")}`,
    detail: `${entry.detail} + d${die} [${rolled}]`,
    total: entry.total + rolled,
    ...(entry.tone && { tone: entry.tone }),
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
  if (!boost || !parsed || !entry.redo || entry.total === undefined) return;
  const { counter } = boost;
  changePlay((p) =>
    setResourceUsed(p, counter.id, (p.resourcesUsed?.[counter.id] ?? 0) + 1, counter.max),
  );
  const rolled = rollExpression(parsed).total;
  addLog({
    label: `${entry.label} + ${content.value?.name(feature) ?? feature}`,
    detail: `${entry.detail} + ${boost.dice} [${rolled}]`,
    total: entry.total + rolled,
    ...(entry.tone && { tone: entry.tone }),
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
  addLog({ label, detail: diceDetail(roll), total: roll.total, dice: roll });
  return roll;
}

const diceDetail = (roll: DiceRoll) =>
  `${roll.rolls.map((group) => `[${group.join(", ")}]`).join(" + ")}${signedBonus(roll.modifier)}`;

/**
 * Spends Heroic Inspiration (2024) to roll one die of a roll again: the new face counts and the total changes. Not
 * for the d20 of a check, which has its own button (`rerollWithInspiration`).
 */
export function rerollOneDie(entry: LogEntry, term: number, index: number) {
  if (!entry.dice || !character.value.play.inspiration) return;
  changePlay((p) => setInspiration(p, false));
  const roll = rerollDie(entry.dice, term, index);
  addLog({
    label: `${entry.label} (${ui("play.rerolled")})`,
    detail: diceDetail(roll),
    total: roll.total,
    dice: roll,
  });
}

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

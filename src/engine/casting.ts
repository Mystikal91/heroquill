import type { PlayState } from "./character";
import type { SpellcastingResult } from "./derive";
import {
  pactLeft,
  resourceLeft,
  setPactUsed,
  setResourceUsed,
  setSlotsUsed,
  slotsLeft,
} from "./play";
import type { ClassResource } from "./resources";
import type { SpellLists } from "./spells";

/**
 * One way to pay for a spell: a slot of the spell slot table, a Pact Magic slot, a use that needs no
 * slot (a feat or a trait gives it) or the points of a reserve. `left` is how many are there now.
 */
export type CastOption =
  | { kind: "slot" | "pact"; level: number; left: number; total: number }
  | { kind: "free"; level: number; id: string; left: number; total: number }
  | {
      kind: "points";
      level: number;
      id: string;
      cost: number;
      left: number;
      total: number;
      /** The most points one spell may cost, when the class has such a limit. */
      limit?: number;
    };

/** What the character has to pay for spells with. */
export interface CastSources {
  spellSlots: number[];
  pact?: { level: number; count: number } | undefined;
  /** The counters of the sheet: those of this spell's free uses are found among them. */
  resources?: ClassResource[];
  /** The reserve of a class that pays with points instead of slots. */
  points?: { id: string; max: number; cost: number; limit?: number | undefined } | undefined;
}

/**
 * Every way the character has to pay for a spell, the spent ones included (with `left` 0): the free
 * uses first, then the slots that can hold it from the lowest, then the Pact Magic slots.
 */
export function castOptions(
  play: PlayState,
  spell: { id?: string; level: number },
  sources: CastSources,
): CastOption[] {
  const options: CastOption[] = [];
  for (const r of sources.resources ?? [])
    if (spell.id !== undefined && r.spell === spell.id)
      options.push({
        kind: "free",
        level: spell.level,
        id: r.id,
        left: resourceLeft(play, r.id, r.max),
        total: r.max,
      });
  if (sources.points) {
    const { id, max, cost, limit } = sources.points;
    options.push({
      kind: "points",
      level: spell.level,
      id,
      cost,
      left: resourceLeft(play, id, max),
      total: max,
      ...(limit !== undefined && { limit }),
    });
    return options;
  }
  for (let level = Math.max(1, spell.level); level <= sources.spellSlots.length; level++) {
    const total = sources.spellSlots[level - 1] ?? 0;
    if (total > 0)
      options.push({ kind: "slot", level, left: slotsLeft(play, level, total), total });
  }
  const { pact } = sources;
  if (pact && pact.count > 0 && pact.level >= spell.level)
    options.push({
      kind: "pact",
      level: pact.level,
      left: pactLeft(play, pact.count),
      total: pact.count,
    });
  return options;
}

/** Whether an option can be paid with now. */
export function canPay(option: CastOption): boolean {
  if (option.kind !== "points") return option.left > 0;
  return option.left >= option.cost && (option.limit === undefined || option.cost <= option.limit);
}

/**
 * The slot level a spell is cast at when the person says nothing else: the lowest the character has,
 * spent or not (a 5th-level warlock casts everything with 3rd-level slots). Undefined without slots.
 */
export function usualLevel(options: CastOption[]): number | undefined {
  const levels = options.filter((o) => o.kind === "slot" || o.kind === "pact").map((o) => o.level);
  return levels.length > 0 ? Math.min(...levels) : undefined;
}

/** What the button to cast does: nothing can pay, one option is spent at once, or the person is asked. */
export type CastPlan =
  | { type: "none" }
  | { type: "spend"; option: CastOption }
  | { type: "ask"; options: CastOption[] };

/**
 * Decides what casting does. The slot of the wanted level is spent at once; the only free use, or the
 * points, too. The person is asked when that slot is gone and another can do, and when there is both
 * a free use and something else to pay with: a dearer slot is never spent in silence.
 */
export function planCast(options: CastOption[], wanted?: number): CastPlan {
  const usable = options.filter(canPay);
  const first = usable[0];
  if (!first) return { type: "none" };
  if (first.kind === "free")
    return usable.length === 1
      ? { type: "spend", option: first }
      : { type: "ask", options: usable };
  if (first.kind === "points") return { type: "spend", option: first };
  const level = wanted ?? usualLevel(options);
  // A Pact Magic slot stands for a level only when the character has no other slots of it.
  const meant =
    options.find((o) => o.kind === "slot" && o.level === level) ??
    options.find((o) => o.kind === "pact" && o.level === level);
  return meant && canPay(meant)
    ? { type: "spend", option: meant }
    : { type: "ask", options: usable };
}

/** Spends what an option is paid with (`by` 1) or puts one payment back (`by` -1). */
function move(play: PlayState, option: CastOption, by: 1 | -1): PlayState {
  switch (option.kind) {
    case "slot": {
      const used = play.slotsUsed[option.level - 1] ?? 0;
      return setSlotsUsed(play, option.level, used + by, option.total);
    }
    case "pact":
      return setPactUsed(play, (play.pactUsed ?? 0) + by, option.total);
    default: {
      const cost = option.kind === "points" ? option.cost : 1;
      const used = play.resourcesUsed?.[option.id] ?? 0;
      return setResourceUsed(play, option.id, used + by * cost, option.total);
    }
  }
}

/** Pays for a spell with an option; nothing changes when it cannot be paid with. */
export const payCast = (play: PlayState, option: CastOption): PlayState =>
  canPay(option) ? move(play, option, 1) : play;

/**
 * Puts back what a cast was paid with, and only that. `paid` is the option as it was before paying:
 * when what is left is no longer what the payment left (a rest, a slot given back by hand, another
 * cast), nothing changes, so that nothing is ever given back twice.
 */
export function refundCast(play: PlayState, paid: CastOption): PlayState {
  const cost = paid.kind === "points" ? paid.cost : 1;
  return leftNow(play, paid) === paid.left - cost ? move(play, paid, -1) : play;
}

/** How many of what an option is paid with are left now. */
function leftNow(play: PlayState, option: CastOption): number {
  if (option.kind === "slot") return slotsLeft(play, option.level, option.total);
  if (option.kind === "pact") return pactLeft(play, option.total);
  return "id" in option ? resourceLeft(play, option.id, option.total) : 0;
}

/** The slots spent and made when a spell was cast, to tell later whether some came back. */
export interface SlotMark {
  slotsUsed: number[];
  pactUsed: number;
  created: string;
}

export const slotMark = (play: PlayState): SlotMark => ({
  slotsUsed: [...play.slotsUsed],
  pactUsed: play.pactUsed ?? 0,
  created: JSON.stringify(play.createdSlots ?? []),
});

/** Whether slots came back (a rest, an undo, a made slot) since the mark was taken. */
export function slotsCameBack(play: PlayState, mark: SlotMark): boolean {
  return (
    mark.slotsUsed.some((n, i) => (play.slotsUsed[i] ?? 0) < n) ||
    (play.pactUsed ?? 0) < mark.pactUsed ||
    JSON.stringify(play.createdSlots ?? []) !== mark.created
  );
}

/** The classes with Ritual Casting in the 2014 rules (the Artificer is of Eberron and Tasha's). */
const RITUAL_CLASSES = /\/(bard|cleric|druid|wizard|artificer)(-\d+)?$/;

/** The spells a class has ready: known or prepared, and those its subclass always prepares. */
const readySpells = (lists: SpellLists): string[] => [
  ...((lists.preparation === "known" ? lists.known : lists.prepared)?.chosen ?? []),
  ...lists.alwaysPrepared,
];

/**
 * Whether the character can cast a spell it has as a ritual. 2024: any spell with the ritual tag.
 * 2014: a spell of a class with Ritual Casting (known or prepared), or one picked by a choice of
 * rituals (Book of Ancient Secrets).
 */
export function canCastAsRitual(
  spell: { id: string; ritual: boolean },
  ruleset: string,
  sheet: {
    spellcasters: Pick<SpellcastingResult, "classId" | "lists">[];
    choices: { ritual?: boolean; selected: string[] }[];
  },
): boolean {
  if (!spell.ritual) return false;
  if (ruleset === "srd52") return true;
  return (
    sheet.spellcasters.some(
      (x) => RITUAL_CLASSES.test(x.classId) && readySpells(x.lists).includes(spell.id),
    ) || sheet.choices.some((x) => x.ritual === true && x.selected.includes(spell.id))
  );
}

/**
 * Whether a spell can be cast only as a ritual: in 2014 one picked by a choice of rituals (Book of
 * Ancient Secrets) that no class has known or prepared. In 2024 such spells are prepared.
 */
export function isRitualOnly(
  id: string,
  ruleset: string,
  sheet: Parameters<typeof canCastAsRitual>[2],
): boolean {
  return (
    ruleset !== "srd52" &&
    sheet.choices.some((x) => x.ritual === true && x.selected.includes(id)) &&
    !sheet.spellcasters.some((x) => readySpells(x.lists).includes(id))
  );
}

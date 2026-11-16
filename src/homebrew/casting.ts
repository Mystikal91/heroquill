import { MULTICLASS_SLOTS } from "../engine/multiclass";

/**
 * Spellcasting for a class or a subclass made from a few choices: how it casts, with what, and how
 * many cantrips. The tables of the 20 levels (slots, cantrips, spells known) follow from them, as the
 * rules give them, so the person does not write twenty rows by hand.
 */

export const CASTING_KINDS = ["none", "full", "half", "pact", "points"] as const;
export type CastingKind = (typeof CASTING_KINDS)[number];
export const PREPARATION_KINDS = ["prepared", "known", "spellbook"] as const;
export type Preparation = (typeof PREPARATION_KINDS)[number];

const ZERO_SLOTS = Array.from({ length: 9 }, () => 0);

/** Slots of a third caster (Eldritch Knight), from level 3 on, and its spells known. */
const THIRD_SLOTS: [number, number[]][] = [
  [3, [2]],
  [4, [3]],
  [7, [4, 2]],
  [10, [4, 3]],
  [13, [4, 3, 2]],
  [16, [4, 3, 3]],
  [19, [4, 3, 3, 1]],
];
const THIRD_KNOWN = [3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13];

export function thirdSlots(level: number): number[] {
  const row = [...THIRD_SLOTS].reverse().find(([from]) => from <= level)?.[1] ?? [];
  return [...row, ...ZERO_SLOTS].slice(0, 9);
}

/** Slots of a class on the standard tables: full casters, half casters, or Pact Magic. */
export function slotsFor(kind: "full" | "half" | "pact", level: number): number[] {
  if (kind === "full") return MULTICLASS_SLOTS[level - 1] ?? ZERO_SLOTS;
  if (kind === "half")
    return level < 2 ? ZERO_SLOTS : (MULTICLASS_SLOTS[Math.ceil(level / 2) - 1] ?? ZERO_SLOTS);
  const count = level === 1 ? 1 : level <= 10 ? 2 : level <= 16 ? 3 : 4;
  const spellLevel = Math.min(5, Math.ceil(level / 2));
  return ZERO_SLOTS.map((_, i) => (i === spellLevel - 1 ? count : 0));
}

type Row = { level: number; features: string[]; [key: string]: unknown };
const TABLE_KEYS = ["cantripsKnown", "spellsKnown", "spellSlots"];

/** A row of the level table without its spell columns. */
const bare = (row: Row): Row => {
  const copy = { ...row };
  for (const key of TABLE_KEYS) delete copy[key];
  return copy;
};

export interface ClassCasting {
  kind: CastingKind;
  ability: string;
  preparation: Preparation;
  cantrips: number;
  /** For a class that casts without slots (`points`): the reserve its spells take points from. */
  reserve?: string;
  /** The highest spell level it knows: `half` of the class level, or the name of a column of the table. */
  maxLevel?: string;
  /** The column of the table that limits the points one spell can take ("" for no limit). */
  limit?: string;
}

/** How a class casts, read from its data (the form shows it, and changing it writes it again). */
export function readClassCasting(data: Record<string, unknown>): ClassCasting {
  const c = data.spellcasting as
    | {
        ability?: string;
        startsAtLevel?: number;
        pact?: boolean;
        preparation?: { type?: string };
        slots?: string;
        reserve?: string;
        maxLevel?: string | { column?: string };
        limit?: string;
      }
    | undefined;
  const rows = (data.levels as { cantripsKnown?: number }[] | undefined) ?? [];
  return {
    kind: !c
      ? "none"
      : c.slots === "none"
        ? "points"
        : c.pact
          ? "pact"
          : (c.startsAtLevel ?? 1) > 1
            ? "half"
            : "full",
    // What only a class that casts with points has.
    ...(c?.slots === "none" && {
      reserve: c.reserve ?? "",
      maxLevel:
        typeof c.maxLevel === "object" ? (c.maxLevel.column ?? "half") : (c.maxLevel ?? "half"),
      limit: c.limit ?? "",
    }),
    ability: c?.ability ?? "int",
    preparation: (PREPARATION_KINDS as readonly string[]).includes(c?.preparation?.type ?? "")
      ? (c?.preparation?.type as Preparation)
      : "prepared",
    cantrips: rows.find((r) => r.cantripsKnown !== undefined)?.cantripsKnown ?? 0,
  };
}

/** The `spellcasting` and `levels` of a class's data for how it casts; the rest of the data is not touched. */
export function applyClassCasting(
  data: Record<string, unknown>,
  casting: ClassCasting,
): { spellcasting: Record<string, unknown> | undefined; levels: Row[] } {
  const rows = ((data.levels as Row[] | undefined) ?? []).map(bare);
  const none = casting.kind === "none";
  const points = casting.kind === "points";
  const kind = casting.kind === "none" || casting.kind === "points" ? "full" : casting.kind;
  const startsAt = kind === "half" ? 2 : 1;
  const cantrips = Math.max(0, Math.min(9, Math.trunc(casting.cantrips)));
  const levels = rows.map((row) => {
    if (none || row.level < startsAt) return row;
    return {
      ...row,
      ...(cantrips > 0 && {
        cantripsKnown: cantrips + (row.level >= 4 ? 1 : 0) + (row.level >= 10 ? 1 : 0),
      }),
      ...(casting.preparation === "known" && {
        spellsKnown:
          kind === "half"
            ? Math.floor(row.level / 2) + 1
            : Math.min(kind === "pact" ? 15 : 20, row.level + 1),
      }),
      // A class that casts with points has no slots, and keeps the values of the columns it has.
      ...(points ? {} : { spellSlots: slotsFor(kind, row.level) }),
    };
  });
  const spellcasting = none
    ? undefined
    : {
        ability: casting.ability,
        startsAtLevel: startsAt,
        ...(kind === "pact" && { pact: true }),
        ...(points && {
          slots: "none",
          ...(casting.reserve && { reserve: casting.reserve }),
          maxLevel:
            !casting.maxLevel || casting.maxLevel === "half"
              ? "half"
              : { column: casting.maxLevel },
          ...(casting.limit && { limit: casting.limit }),
        }),
        preparation:
          casting.preparation === "known"
            ? { type: "known" }
            : casting.preparation === "spellbook"
              ? { type: "spellbook", initial: 6, perLevel: 2 }
              : { type: "prepared", levelDivisor: kind === "half" ? 2 : 1 },
      };
  return { spellcasting, levels };
}

export interface SubclassCasting {
  enabled: boolean;
  ability: string;
  /** The class whose spell list it picks from. */
  list: string;
  schools: string[];
  cantrips: number;
}

export function readSubclassCasting(data: Record<string, unknown>): SubclassCasting {
  const c = data.spellcasting as
    | { ability?: string; list?: string; schools?: string[] }
    | undefined;
  const rows = (data.levels as { cantripsKnown?: number }[] | undefined) ?? [];
  return {
    enabled: Boolean(c),
    ability: c?.ability ?? "int",
    list: c?.list ?? "srd51:class/wizard",
    schools: c?.schools ?? [],
    cantrips: rows.find((r) => r.cantripsKnown !== undefined)?.cantripsKnown ?? 2,
  };
}

/** A subclass that gives a class spellcasting as a third caster does (Eldritch Knight, Arcane Trickster). */
export function applySubclassCasting(
  data: Record<string, unknown>,
  casting: SubclassCasting,
): { spellcasting: Record<string, unknown> | undefined; levels: Row[] } {
  const existing = new Map(
    ((data.levels as Row[] | undefined) ?? []).map((r) => [r.level, bare(r)]),
  );
  if (!casting.enabled) {
    const levels = [...existing.values()].filter((r) => r.features.length > 0);
    return { spellcasting: undefined, levels };
  }
  const cantrips = Math.max(0, Math.min(9, Math.trunc(casting.cantrips)));
  for (let level = 3; level <= 20; level++) {
    const row = existing.get(level) ?? { level, features: [] };
    existing.set(level, {
      ...row,
      ...(cantrips > 0 && { cantripsKnown: cantrips + (level >= 10 ? 1 : 0) }),
      spellsKnown: THIRD_KNOWN[level - 3] ?? 13,
      spellSlots: thirdSlots(level),
    });
  }
  return {
    spellcasting: {
      ability: casting.ability,
      list: casting.list,
      ...(casting.schools.length > 0 && { schools: casting.schools }),
      startsAtLevel: 3,
      kind: "third",
    },
    levels: [...existing.values()].sort((a, b) => a.level - b.level),
  };
}

import { type ClassData, subclassData } from "../data/progression";
import type { Entry } from "../data/schema";
import type { ClassSpells } from "./character";
import type { PackIndex } from "./derive";
import { spellFor2024 } from "./rulesets";
import { type Warning, warn } from "./warnings";

/** One list of spells a class picks: how many it may hold, the picks, and what it may pick from. */
export interface SpellPick {
  allowed: number;
  /** Valid picks only, at most `allowed`. */
  chosen: string[];
  pool: string[];
  /**
   * Only on a subclass caster limited to some schools (Eldritch Knight, Arcane Trickster): the
   * spells of other schools may be at most `free` of the picks.
   */
  restriction?: { schools: string[]; free: number };
}

/** The class levels at which a third caster may learn a spell of any school. */
export const FREE_SCHOOL_LEVELS = [3, 8, 14, 20];

export interface SpellLists {
  preparation: "known" | "prepared" | "spellbook";
  /** Highest spell level the class has slots for at its current level. */
  maxSpellLevel: number;
  cantrips?: SpellPick;
  /** Spells known (known casters) or the spellbook (wizards). */
  known?: SpellPick;
  /** Spells prepared today (prepared casters and wizards). */
  prepared?: SpellPick;
  /** Granted by the subclass, always prepared and not counted against any limit. */
  alwaysPrepared: string[];
}

interface Input {
  classId: string;
  /** The class the character has, when `classId` is only the list its subclass picks from. */
  ownerId?: string;
  data: ClassData;
  level: number;
  /** Modifier of the class's spellcasting ability. */
  abilityModifier: number;
  picks: ClassSpells | undefined;
  index: PackIndex;
  subclass: Entry | undefined;
  /** Schools the spells known are limited to (see `SpellPick.restriction`). */
  schools?: string[];
  warnings: Warning[];
}

const spellLevel = (entry: Entry) => entry.data.level as number;

/** Spell ids on a class's list with a level in [min, max], sorted by level then id. */
function classSpellPool(index: PackIndex, classId: string, min: number, max: number): string[] {
  const found: Entry[] = [];
  for (const entry of index.values()) {
    if (entry.kind !== "spell") continue;
    if (!(entry.data.classes as string[]).includes(classId)) continue;
    if (spellLevel(entry) >= min && spellLevel(entry) <= max) found.push(entry);
  }
  return found
    .sort((a, b) => spellLevel(a) - spellLevel(b) || a.id.localeCompare(b.id))
    .map((e) => e.id);
}

/** The spells a patron adds to the list, within the levels the class can cast. */
function expandedPool(
  index: PackIndex,
  subclass: Entry | undefined,
  min: number,
  max: number,
  twin = false,
) {
  const ids = (subclass ? subclassData(subclass).expanded : []).map((id) =>
    twin ? spellFor2024(id, index) : id,
  );
  return ids.filter((id) => {
    const level = index.get(id)?.data.level;
    return typeof level === "number" && level >= min && level <= max;
  });
}

/** Keeps the valid picks, warning about invalid and surplus ones. */
function resolvePick(
  requested: string[],
  allowed: number,
  pool: string[],
  classId: string,
  warnings: Warning[],
  limit?: { restriction: { schools: string[]; free: number }; schoolOf: (spell: string) => string },
): SpellPick {
  const chosen: string[] = [];
  let outside = 0;
  for (const spell of requested) {
    if (!pool.includes(spell)) warn(warnings, "invalidSpell", { spell, class: classId });
    else if (chosen.length >= allowed) warn(warnings, "tooManySpells", { class: classId });
    else if (chosen.includes(spell)) continue;
    else if (limit && !limit.restriction.schools.includes(limit.schoolOf(spell))) {
      if (outside >= limit.restriction.free)
        warn(warnings, "spellSchool", { spell, class: classId });
      else {
        outside++;
        chosen.push(spell);
      }
    } else chosen.push(spell);
  }
  return { allowed, chosen, pool, ...(limit && { restriction: limit.restriction }) };
}

/**
 * The highest spell level a class can know at a level: the highest it has slots for, or for a class
 * without slots the cap its data gives (half the level, rounded up, or a column of its table).
 */
export function highestSpellLevel(data: ClassData, level: number): number {
  const casting = data.spellcasting;
  const row = data.levels.find((l) => l.level === level);
  if (casting?.slots === "none") {
    const cap = casting.maxLevel;
    const n =
      cap === "half"
        ? Math.ceil(level / 2)
        : cap
          ? Number(row?.classSpecific?.[cap.column] ?? 0)
          : 9;
    return Math.max(0, Math.min(9, Math.trunc(Number.isFinite(n) ? n : 0)));
  }
  return (row?.spellSlots ?? []).reduce((max, n, i) => (n > 0 ? i + 1 : max), 0);
}

/** The spell lists of one casting class at its current level (call only once it can cast). */
export function deriveSpellLists(input: Input): SpellLists {
  const { classId, data, level, abilityModifier, picks, index, subclass, warnings } = input;
  const casting = data.spellcasting;
  if (!casting) throw new Error(`${classId} is not a spellcasting class`);
  // The spells the subclass of a book names are those of the 2014 SRD: a 2024 class takes the 2024 spells.
  const twin = (input.ownerId ?? classId).startsWith("srd52:");
  const row = data.levels.find((l) => l.level === level);
  const maxSpellLevel = highestSpellLevel(data, level);

  const alwaysPrepared = subclass
    ? subclassData(subclass)
        .spells.filter((s) => s.classLevel <= level)
        .map((s) => (twin ? spellFor2024(s.spell, index) : s.spell))
    : [];

  // What the subclass gives takes no pick: it is not offered, and a pick of it made before (the
  // subclass of an older import did not give it) is left aside without a warning.
  const free = (spells: string[] | undefined) =>
    (spells ?? []).filter((s) => !alwaysPrepared.includes(s));

  const lists: SpellLists = {
    preparation: casting.preparation.type,
    maxSpellLevel,
    alwaysPrepared,
  };

  if (row?.cantripsKnown) {
    lists.cantrips = resolvePick(
      free(picks?.cantrips),
      row.cantripsKnown,
      free([...classSpellPool(index, classId, 0, 0), ...expandedPool(index, subclass, 0, 0, twin)]),
      classId,
      warnings,
    );
  }

  const leveled = [
    ...new Set([
      ...classSpellPool(index, classId, 1, maxSpellLevel),
      ...expandedPool(index, subclass, 1, maxSpellLevel, twin),
    ]),
  ];
  const preparation = casting.preparation;
  if (preparation.type === "known") {
    const schools = input.schools ?? [];
    lists.known = resolvePick(
      free(picks?.known),
      row?.spellsKnown ?? 0,
      free(leveled),
      classId,
      warnings,
      schools.length > 0
        ? {
            restriction: { schools, free: FREE_SCHOOL_LEVELS.filter((l) => l <= level).length },
            schoolOf: (spell) => String(index.get(spell)?.data.school ?? ""),
          }
        : undefined,
    );
  } else if (preparation.type === "prepared") {
    const count = preparation.fromTable
      ? (row?.spellsKnown ?? 0)
      : Math.max(1, abilityModifier + Math.floor(level / preparation.levelDivisor));
    lists.prepared = resolvePick(free(picks?.prepared), count, free(leveled), classId, warnings);
  } else {
    const bookSize = preparation.initial + preparation.perLevel * (level - 1);
    lists.known = resolvePick(picks?.known ?? [], bookSize, leveled, classId, warnings);
    const count = preparation.fromTable
      ? (row?.spellsKnown ?? 0)
      : Math.max(1, abilityModifier + level);
    lists.prepared = resolvePick(
      free(picks?.prepared),
      count,
      free(lists.known.chosen),
      classId,
      warnings,
    );
  }
  return lists;
}

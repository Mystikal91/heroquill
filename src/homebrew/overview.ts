import type { Entry } from "../data/schema";

/** One level of a class or subclass, as the strip of levels shows it. */
export interface LevelCell {
  level: number;
  features: { id: string; name: string }[];
  /** An ability score improvement comes at this level. */
  asi: boolean;
  cantrips?: number;
  /** Spell slots of the levels that have any, as `[spell level, count]`. */
  slots: [number, number][];
}

type Row = {
  level: number;
  features?: string[];
  abilityScoreImprovements?: number;
  cantripsKnown?: number;
  spellSlots?: number[];
};

/**
 * The levels of a class (all twenty) or of a subclass (the ones that have something) at a glance:
 * what each gives, where the increases come, and the spell slots.
 */
export function levelOverview(entry: Entry, name: (id: string) => string): LevelCell[] {
  const rows = ((entry.data as { levels?: Row[] }).levels ?? [])
    .slice()
    .sort((a, b) => a.level - b.level);
  const isClass = entry.kind === "class";
  let before = 0;
  const cells = rows.map((row): LevelCell => {
    const total = row.abilityScoreImprovements ?? before;
    const asi = isClass && total > before;
    before = total;
    return {
      level: row.level,
      features: (row.features ?? []).map((id) => ({ id, name: name(id) })),
      asi,
      ...(row.cantripsKnown !== undefined && { cantrips: row.cantripsKnown }),
      slots: (row.spellSlots ?? []).flatMap((n, i): [number, number][] =>
        n > 0 ? [[i + 1, n]] : [],
      ),
    };
  });
  // A subclass lists only the levels that give something; a class lists all twenty.
  return isClass ? cells : cells.filter((c) => c.features.length > 0 || c.slots.length > 0);
}

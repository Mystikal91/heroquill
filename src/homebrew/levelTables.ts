/**
 * The tables of a class by level, as the editor shows them: the spell columns (cantrips, spells known,
 * slots of each spell level) and the values of the class (ki points, number of rages...). They live in
 * the rows of `levels`; these functions read and change the rows without touching what they do not name.
 */

export type LevelRow = { level: number; features?: string[]; [key: string]: unknown };

/** The rows of a class or subclass, sorted by level. */
export function levelRows(data: Record<string, unknown>): LevelRow[] {
  const rows = Array.isArray(data.levels) ? (data.levels as LevelRow[]) : [];
  return [...rows].sort((a, b) => a.level - b.level);
}

/** The row of a level changed, made when there is none; the rows stay sorted. */
function patchRow(
  rows: LevelRow[],
  level: number,
  change: (row: LevelRow) => LevelRow,
): LevelRow[] {
  const there = rows.some((r) => r.level === level);
  const base = there ? rows : [...rows, { level, features: [] } as LevelRow];
  return base.map((r) => (r.level === level ? change(r) : r)).sort((a, b) => a.level - b.level);
}

const clamp = (n: number, max: number) => Math.max(0, Math.min(max, Math.trunc(n)));

export type SpellColumn = "cantripsKnown" | "spellsKnown";

/** Sets the cantrips or the spells known of a level; empty takes the number away. */
export function setSpellCount(
  rows: LevelRow[],
  level: number,
  column: SpellColumn,
  value: number | undefined,
): LevelRow[] {
  return patchRow(rows, level, (row) => {
    const { [column]: _old, ...rest } = row;
    return value === undefined || Number.isNaN(value)
      ? rest
      : { ...rest, [column]: clamp(value, 99) };
  });
}

/** Sets the slots of one spell level (1 to 9) at a level of the class; the other slots stay. */
export function setSlot(
  rows: LevelRow[],
  level: number,
  spellLevel: number,
  value: number | undefined,
): LevelRow[] {
  return patchRow(rows, level, (row) => {
    const slots = Array.from({ length: 9 }, (_, i) => {
      const old = Array.isArray(row.spellSlots) ? (row.spellSlots as number[])[i] : 0;
      return typeof old === "number" ? old : 0;
    });
    slots[spellLevel - 1] = value === undefined || Number.isNaN(value) ? 0 : clamp(value, 99);
    return { ...row, spellSlots: slots };
  });
}

/** The slots of a row as nine numbers. */
export function slotsOf(row: LevelRow | undefined): number[] {
  const slots = Array.isArray(row?.spellSlots) ? (row?.spellSlots as number[]) : [];
  return Array.from({ length: 9 }, (_, i) =>
    typeof slots[i] === "number" ? (slots[i] as number) : 0,
  );
}

const specific = (row: LevelRow): Record<string, unknown> =>
  row.classSpecific && typeof row.classSpecific === "object"
    ? (row.classSpecific as Record<string, unknown>)
    : {};

/**
 * The columns of values of a class: the keys of `classSpecific` whose values are numbers (a key that
 * holds anything else is not a column the editor can draw, and is left as it is), in the order they appear.
 */
export function valueColumns(rows: LevelRow[]): string[] {
  const keys: string[] = [];
  const odd = new Set<string>();
  for (const row of rows)
    for (const [key, value] of Object.entries(specific(row))) {
      if (typeof value !== "number") odd.add(key);
      if (!keys.includes(key)) keys.push(key);
    }
  return keys.filter((k) => !odd.has(k));
}

/** The columns of values that the classes of a pack have, each named once. */
export function packColumns(entries: { kind: string; data: unknown }[]): string[] {
  return [
    ...new Set(
      entries
        .filter((e) => e.kind === "class")
        .flatMap((e) => valueColumns(levelRows(e.data as Record<string, unknown>))),
    ),
  ];
}

/** The value of a column at a level, when the row has one. */
export const valueAt = (rows: LevelRow[], level: number, key: string): number | undefined => {
  const v = specific(rows.find((r) => r.level === level) ?? { level })[key];
  return typeof v === "number" ? v : undefined;
};

/** Sets a value of a column at a level; empty takes it away from that level. */
export function setValue(
  rows: LevelRow[],
  level: number,
  key: string,
  value: number | undefined,
): LevelRow[] {
  return patchRow(rows, level, (row) => {
    const { [key]: _old, ...rest } = specific(row);
    const next = value === undefined || Number.isNaN(value) ? rest : { ...rest, [key]: value };
    return { ...row, classSpecific: next };
  });
}

/** A new column, with 0 at every level of the class (so it shows as a column from the start). */
export function addColumn(rows: LevelRow[], key: string): LevelRow[] {
  return rows.map((row) => ({
    ...row,
    classSpecific: { ...specific(row), [key]: specific(row)[key] ?? 0 },
  }));
}

/** Takes a column away from every level. */
export function removeColumn(rows: LevelRow[], key: string): LevelRow[] {
  return rows.map((row) => {
    const { [key]: _gone, ...rest } = specific(row);
    return { ...row, classSpecific: rest };
  });
}

/** Repeats the value of a level on every level after it. */
export function fillDown(rows: LevelRow[], key: string, from: number): LevelRow[] {
  const value = valueAt(rows, from, key);
  return rows.map((row) =>
    row.level > from
      ? {
          ...row,
          classSpecific: { ...specific(row), ...(value === undefined ? {} : { [key]: value }) },
        }
      : row,
  );
}

/** The ability score improvements gained by a level, as the table gives them (a running total). */
export const improvementsAt = (rows: LevelRow[], level: number): number => {
  const v = rows.find((r) => r.level === level)?.abilityScoreImprovements;
  return typeof v === "number" ? v : 0;
};

export function setImprovements(
  rows: LevelRow[],
  level: number,
  value: number | undefined,
): LevelRow[] {
  return patchRow(rows, level, (row) => ({
    ...row,
    abilityScoreImprovements: value === undefined || Number.isNaN(value) ? 0 : clamp(value, 20),
  }));
}

import { signal } from "@preact/signals";

/**
 * The columns of the initiative table, which of them show and in what order. The choice is kept on
 * the device (not in an encounter): it is how this person likes to read the table.
 */
export type DmColumn = "init" | "name" | "hp" | "ac" | "speed" | "cond";

/** The columns, in the order they have until the person changes it. */
export const DM_COLUMNS: readonly DmColumn[] = ["init", "name", "hp", "ac", "speed", "cond"];

/** The name cannot be hidden: a row without it says nothing, and it is what opens the details. */
export const REQUIRED_COLUMNS: readonly DmColumn[] = ["name"];

export interface ColumnSettings {
  /** Every column, hidden ones included, in the order of the table. */
  order: DmColumn[];
  hidden: DmColumn[];
}

export const defaultColumns = (): ColumnSettings => ({ order: [...DM_COLUMNS], hidden: [] });

/** Settings read from storage: unknown columns go, repeats go, missing ones are added in their usual place. */
export function readColumns(raw: unknown): ColumnSettings {
  const fresh = defaultColumns();
  if (!raw || typeof raw !== "object") return fresh;
  const r = raw as { order?: unknown; hidden?: unknown };
  const known = (list: unknown): DmColumn[] =>
    Array.isArray(list)
      ? list.filter((x): x is DmColumn => (DM_COLUMNS as readonly unknown[]).includes(x))
      : [];
  const seen = new Set<DmColumn>();
  const order = known(r.order).filter((c) => !seen.has(c) && !!seen.add(c));
  for (const column of DM_COLUMNS) if (!seen.has(column)) order.push(column);
  const hidden = [...new Set(known(r.hidden))].filter((c) => !REQUIRED_COLUMNS.includes(c));
  return { order, hidden };
}

/** The columns to draw, in order. */
export const visibleColumns = (settings: ColumnSettings): DmColumn[] =>
  settings.order.filter((c) => !settings.hidden.includes(c));

/** Moves a column one place up (`-1`) or down (`1`) in the list. At the end of the list it stays. */
export function moveColumn(
  settings: ColumnSettings,
  column: DmColumn,
  step: -1 | 1,
): ColumnSettings {
  const at = settings.order.indexOf(column);
  const to = at + step;
  if (at < 0 || to < 0 || to >= settings.order.length) return settings;
  const order = [...settings.order];
  [order[at], order[to]] = [order[to] as DmColumn, order[at] as DmColumn];
  return { ...settings, order };
}

/** Shows a hidden column or hides a shown one (the name stays). */
export function toggleColumn(settings: ColumnSettings, column: DmColumn): ColumnSettings {
  if (REQUIRED_COLUMNS.includes(column)) return settings;
  return {
    ...settings,
    hidden: settings.hidden.includes(column)
      ? settings.hidden.filter((c) => c !== column)
      : [...settings.hidden, column],
  };
}

/** How wide each column is; the name takes what is left. */
const WIDTHS: Record<DmColumn, string> = {
  init: "4.8rem",
  name: "minmax(0, 1fr)",
  hp: "7.5rem",
  ac: "2.8rem",
  speed: "4rem",
  cond: "3.4rem",
};

/** On a narrow table (a phone) these go into the second line of the name instead of a column of their own. */
export const FOLDED_WHEN_NARROW: readonly DmColumn[] = ["ac", "speed", "cond"];

/** Tighter widths for a narrow table. */
const NARROW_WIDTHS: Partial<Record<DmColumn, string>> = {
  init: "3.2rem",
  hp: "6rem",
};

/** The `grid-template-columns` of a row: the chosen columns. */
export function gridTemplate(columns: readonly DmColumn[], narrow = false): string {
  const shown = narrow ? columns.filter((c) => !FOLDED_WHEN_NARROW.includes(c)) : columns;
  const width = (c: DmColumn) => (narrow ? NARROW_WIDTHS[c] : undefined) ?? WIDTHS[c];
  return shown.map(width).join(" ");
}

// ---- Kept on the device ----

const KEY = "dmColumns";

function saved(): ColumnSettings {
  try {
    const raw = localStorage.getItem(KEY);
    return readColumns(raw ? JSON.parse(raw) : undefined);
  } catch {
    return defaultColumns();
  }
}

export const dmColumns = signal<ColumnSettings>(saved());

export function setDmColumns(next: ColumnSettings) {
  dmColumns.value = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Not remembered: it still holds for this visit.
  }
}

import type { Entry } from "../../../data/schema";
import { KIND_META } from "../../../homebrew/catalog";
import type { UserPackRecord } from "../../../storage/packs";

/** What to print: the open entry, the ticked ones, one kind of entry of the pack, or the whole pack. */
export type Scope = "entry" | "selection" | "kind" | "pack";

export interface ScopeContext {
  /** The entry open in the editor. */
  open?: string | undefined;
  /** The entries ticked in the list. */
  selected: readonly string[];
  /** The section (kind of entry, as the list names it) for the `kind` scope. */
  group?: string | undefined;
  /** How the list names a kind of entry. */
  groupOf: (entry: Entry) => string;
}

/** The entries of a pack that are written on their own: what they own is printed inside them. */
export const printable = (record: UserPackRecord): Entry[] =>
  record.pack.entries.filter((e) => KIND_META[e.kind].role !== "owned");

/** The ids of the entries a scope stands for, in the order of the pack. */
export function scopeIds(record: UserPackRecord, scope: Scope, context: ScopeContext): string[] {
  const all = printable(record);
  switch (scope) {
    case "entry":
      return all.filter((e) => e.id === context.open).map((e) => e.id);
    case "selection":
      return all.filter((e) => context.selected.includes(e.id)).map((e) => e.id);
    case "kind":
      return all.filter((e) => context.groupOf(e) === context.group).map((e) => e.id);
    default:
      return all.map((e) => e.id);
  }
}

/** The scope to start from: what the person was looking at when they asked to print. */
export function firstScope(context: Pick<ScopeContext, "open" | "selected">): Scope {
  if (context.selected.length > 0) return "selection";
  return context.open ? "entry" : "pack";
}

/** Kinds in the order a book lists them: who you are, what you can do, what you carry, the rest. */
const PRINT_ORDER = [
  "species",
  "subspecies",
  "class",
  "subclass",
  "background",
  "feat",
  "spell",
  "item",
  "property",
  "language",
  "deity",
  "monster",
];

/** Entries grouped by kind in the order of a book, and by title within a kind. */
export function inPrintOrder(entries: Entry[], title: (e: Entry) => string): Entry[] {
  const rank = (e: Entry) => {
    const at = PRINT_ORDER.indexOf(e.kind);
    return at < 0 ? PRINT_ORDER.length : at;
  };
  return [...entries].sort((a, b) => rank(a) - rank(b) || title(a).localeCompare(title(b)));
}

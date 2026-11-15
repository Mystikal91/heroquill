import type { Entry } from "../../data/schema";
import { type UiKey, ui } from "../../i18n/ui";
import { humanize } from "./Controls";

const HB = new Set([
  "spell",
  "language",
  "feat",
  "species",
  "background",
  "class",
  "subclass",
  "property",
]);
const SEARCH = new Set([
  "item",
  "condition",
  "feature",
  "trait",
  "subspecies",
  "skill",
  "deity",
  "monster",
]);

/** What an entry is called in a list: an item is a weapon, an armor or gear, the rest by their kind. */
export function kindName(entry: Pick<Entry, "kind" | "data">): string {
  if (entry.kind === "item") {
    const data = entry.data as { weapon?: unknown; armor?: unknown; rarity?: unknown };
    if (data.rarity !== undefined) return ui("studio.kind.magic");
    if (data.weapon) return ui("hb.kind.weapon");
    if (data.armor) return ui("hb.kind.armor");
    return ui("hb.kind.gear");
  }
  if (HB.has(entry.kind)) return ui(`hb.kind.${entry.kind}` as UiKey);
  if (SEARCH.has(entry.kind)) return ui(`search.kind.${entry.kind}` as UiKey);
  return humanize(entry.kind);
}

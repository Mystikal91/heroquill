import type { ItemKind } from "./gear";

/** The chips of the item picker: everything, or one sort of thing. */
export const ITEM_FILTERS = [
  "all",
  "potion",
  "weapon",
  "armor",
  "gear",
  "tool",
  "magic",
  "mount",
  "homebrew",
] as const;
export type ItemFilter = (typeof ITEM_FILTERS)[number];

/** One thing the picker can add. */
export interface ItemOption {
  id: string;
  /** The name in the language of the app. */
  name: string;
  kind: ItemKind;
  homebrew: boolean;
}

/** Lower case, without accents, so that "pozione" finds "Pozione" and "elixir" finds "Élixir". */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[’']/g, "'").trim();
}

/** Whether an entry id is a potion or another drink or oil that is used up: by its slug, in any language. */
export function isPotionId(id: string): boolean {
  const slug = id.split("/").pop() ?? id;
  return /(^|-)(potion|elixir|philter|antitoxin|draught)(s)?(-|$)|^oil-of-/.test(slug);
}

/** Whether an option belongs under a chip. A potion is also whatever else it is (a magic item). */
export function inFilter(option: ItemOption, filter: ItemFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "potion":
      return isPotionId(option.id);
    case "homebrew":
      return option.homebrew;
    default:
      return option.kind === filter;
  }
}

/** Every word of the search must be somewhere in the name, in any order. */
export function matchesQuery(name: string, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = fold(name);
  return words.every((w) => haystack.includes(w));
}

/**
 * Names that start with the search come first, then names with a word that starts with it, then
 * the rest, each group by name: "pot" gives "Potion of Healing" before "Spotted Cloak".
 */
function rank(name: string, query: string): number {
  const q = fold(query);
  const n = fold(name);
  if (!q) return 3;
  if (n.startsWith(q)) return 0;
  if (n.split(/[\s(),-]+/).some((word) => word.startsWith(q.split(/\s+/)[0] ?? q))) return 1;
  return 2;
}

/** The options a search and a chip leave, the best matches first. */
export function searchItems(
  options: readonly ItemOption[],
  query: string,
  filter: ItemFilter,
): ItemOption[] {
  return options
    .filter((o) => inFilter(o, filter) && matchesQuery(o.name, query))
    .sort((a, b) => rank(a.name, query) - rank(b.name, query) || a.name.localeCompare(b.name));
}

/**
 * A count at the start or the end of what was typed: "2 potions", "2x potions", "potions x2",
 * "potions ×2". Without one the count is 1 and the text is returned as it is.
 */
export function splitQuantity(text: string): { quantity: number; name: string } {
  const typed = text.trim();
  const lead = /^(\d{1,3})\s*[x×]?\s+(\S.*)$/i.exec(typed);
  if (lead) return { quantity: Number(lead[1]), name: (lead[2] ?? "").trim() };
  const tail = /^(\S.*?)\s*[x×]\s*(\d{1,3})$/i.exec(typed);
  if (tail) return { quantity: Number(tail[2]), name: (tail[1] ?? "").trim() };
  return { quantity: 1, name: typed };
}

/** The name of a free item: the first letter in capitals, the rest as it was typed. */
export function freeItemName(name: string): string {
  const clean = name.trim().replace(/\s+/g, " ");
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/** The most recent items first, each once, only the ones that are still known, and no more than `max`. */
export function rememberRecent(recent: readonly string[], id: string, max = 12): string[] {
  return [id, ...recent.filter((r) => r !== id)].slice(0, max);
}

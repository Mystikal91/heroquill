import type { Entry } from "../data/schema";

/**
 * The small vocabulary a pack can add to the rules: a reserve of points (psi points), a kind of damage
 * and a spell component. Each is an entry of its own kind; the data names it by a plain word, which is
 * the end of its id (`mypack:damage/sonic` is `sonic`), or, for a component, its code (`A`).
 */
export const WORD_KINDS = ["reserve", "damage", "component"] as const;
export type WordKind = (typeof WORD_KINDS)[number];

/** The end of an id: `mypack:damage/sonic` -> `sonic`. */
export const wordOf = (id: string): string => id.split("/")[1] ?? id;

/** The word the data uses for one of these entries: its slug, or the code of a component. */
export function wordOfEntry(entry: Pick<Entry, "id" | "kind" | "data">): string {
  if (entry.kind === "component") {
    const code = (entry.data as { code?: unknown }).code;
    if (typeof code === "string" && code.trim()) return code.trim().toUpperCase();
  }
  return wordOf(entry.id);
}

const lookups = new WeakMap<ReadonlyMap<string, Entry>, Map<string, Entry>>();

/** The entry that gives a word its meaning, from any pack (the first one when two packs use the same word). */
export function wordEntry(
  index: ReadonlyMap<string, Entry>,
  kind: WordKind,
  word: string,
): Entry | undefined {
  let found = lookups.get(index);
  if (!found) {
    found = new Map();
    for (const entry of index.values()) {
      if (!(WORD_KINDS as readonly string[]).includes(entry.kind)) continue;
      const key = `${entry.kind}:${wordOfEntry(entry)}`;
      if (!found.has(key)) found.set(key, entry);
    }
    lookups.set(index, found);
  }
  return found.get(`${kind}:${word}`);
}

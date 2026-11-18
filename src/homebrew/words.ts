import type { Entry } from "../data/schema";
import { type WordKind, wordOfEntry } from "../engine/words";
import { type UserPackRecord, damageSlug, packTexts } from "../storage/packs";
import { addEntry, newEntryId } from "./entries";

/** `psi-points` -> `Psi points`: what a word is called while no one has written its name. */
export const readable = (slug: string): string => {
  const words = slug.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** The entries of one of the small kinds (reserve, damage, component) that the pack holds. */
export const ownWords = (record: UserPackRecord, kind: WordKind): Entry[] =>
  record.pack.entries.filter((e) => e.kind === kind);

/** The name of such an entry in a language: the translation, else the original, else its word made readable. */
export function wordLabel(record: UserPackRecord, entry: Entry, language: string): string {
  const named = packTexts(record, [language])[`${entry.id}.name`];
  if (named) return named;
  const word = wordOfEntry(entry);
  return entry.kind === "component" ? word : readable(word);
}

/** The code a person typed for a component: upper case, at most three characters. */
export const componentCode = (text: string): string => text.trim().toUpperCase().slice(0, 3);

/**
 * Adds an entry of one of the small kinds from the name (or, for a component, the code) a person wrote.
 * Returns the pack and the word the data uses for it; the same pack when the word is already there.
 */
export function addWord(
  record: UserPackRecord,
  kind: WordKind,
  text: string,
): { record: UserPackRecord; word: string } | undefined {
  const name = kind === "component" ? componentCode(text) : text.trim();
  const slug = damageSlug(name);
  if (!slug) return undefined;
  const same = ownWords(record, kind).find(
    (e) => wordOfEntry(e) === (kind === "component" ? name : slug),
  );
  if (same) return { record, word: wordOfEntry(same) };
  const id = newEntryId(record, kind, slug);
  const data =
    kind === "reserve" ? { recharge: "long" } : kind === "component" ? { code: name } : {};
  const entry: Entry = { id, kind, effects: [], data };
  const made = addEntry(record, entry, { name });
  return { record: made, word: wordOfEntry(entry) };
}

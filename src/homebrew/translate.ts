import type { UserPackRecord } from "../storage/packs";
import { ownedEntries } from "./entries";

/**
 * Translating a pack: the texts of an entry are in the language of the pack, and the same texts
 * in other languages are kept apart (`translations`), so a person reads the pack in their own
 * language wherever it has been translated, and in the original everywhere else.
 */

/** The ids whose texts belong to an entry: itself, and what it owns (the traits, the features). */
export const textOwners = (record: UserPackRecord, id: string): string[] => [
  id,
  ...ownedEntries(record, id).map((e) => e.id),
];

/** The texts to translate for some entries: the keys of the original that say something, in reading order. */
export function textKeys(record: UserPackRecord, owners: readonly string[]): string[] {
  const rank = (key: string) => {
    const field = key.slice(key.indexOf(".") + 1);
    const order = ["name", "desc", "castingTime", "range", "duration", "material", "higherLevel"];
    const at = order.indexOf(field);
    return at < 0 ? order.length : at;
  };
  return Object.entries(record.strings)
    .filter(([key, text]) => text.trim() !== "" && owners.some((id) => key.startsWith(`${id}.`)))
    .map(([key]) => key)
    .sort((a, b) => {
      const ownerA = owners.findIndex((id) => a.startsWith(`${id}.`));
      const ownerB = owners.findIndex((id) => b.startsWith(`${id}.`));
      return (
        ownerA - ownerB || rank(a) - rank(b) || a.localeCompare(b, undefined, { numeric: true })
      );
    });
}

export interface Progress {
  done: number;
  total: number;
}

/** How many of the texts of some entries (all, when none are named) have a translation in a language. */
export function progress(
  record: UserPackRecord,
  language: string,
  owners?: readonly string[],
): Progress {
  const keys = (owners ? textKeys(record, owners) : Object.keys(record.strings)).filter(
    (key) => (record.strings[key] ?? "").trim() !== "",
  );
  const there = record.translations?.[language] ?? {};
  return { total: keys.length, done: keys.filter((k) => (there[k] ?? "").trim() !== "").length };
}

/** Starts a translation: the language is there, with nothing translated yet. */
export function addLanguage(record: UserPackRecord, language: string): UserPackRecord {
  if (language === record.lang || record.translations?.[language]) return record;
  return { ...record, translations: { ...record.translations, [language]: {} } };
}

/** Throws a translation away, with all its texts. */
export function removeLanguage(record: UserPackRecord, language: string): UserPackRecord {
  if (!record.translations?.[language]) return record;
  const { [language]: _gone, ...rest } = record.translations;
  const { translations: _all, ...base } = record;
  return Object.keys(rest).length > 0 ? { ...base, translations: rest } : base;
}

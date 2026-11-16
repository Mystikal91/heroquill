import { type UserPackRecord, damageSlug, packTexts } from "../storage/packs";
import { setText } from "./entries";

/** The place in the texts of a pack where the name of a kind of damage it adds is kept. */
export const DAMAGE_OWNER = "damage";

/** `acido-sonico` -> `Acido sonico`: what a kind of damage is called while no one has written its name. */
export const readable = (slug: string): string => {
  const words = slug.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** The kinds of damage a pack adds, by the word the data uses for them. */
export const ownDamageTypes = (record: UserPackRecord): string[] => record.meta?.damageTypes ?? [];

/** The name of a kind of damage the pack adds, in a language: the translation, else the original, else the word itself. */
export function damageLabel(record: UserPackRecord, slug: string, language: string): string {
  return packTexts(record, [language])[`${DAMAGE_OWNER}.${slug}`] || readable(slug);
}

/** Writes the name of a kind of damage in a language (the pack's own when none is given). */
export function setDamageName(
  record: UserPackRecord,
  slug: string,
  name: string,
  language?: string,
): UserPackRecord {
  return setText(record, DAMAGE_OWNER, slug, name, language);
}

/**
 * Adds a kind of damage by the name a person wrote. The name is kept as its text, in the language the
 * pack is written in, so it can be translated like any other. Returns the pack and the word the data uses.
 */
export function addDamageType(
  record: UserPackRecord,
  name: string,
): { record: UserPackRecord; slug: string } | undefined {
  const slug = damageSlug(name);
  if (!slug) return undefined;
  const own = ownDamageTypes(record);
  const next = own.includes(slug)
    ? record
    : { ...record, meta: { ...record.meta, damageTypes: [...own, slug] } };
  const named = record.strings[`${DAMAGE_OWNER}.${slug}`]
    ? next
    : setDamageName(next, slug, name.trim());
  return { record: named, slug };
}

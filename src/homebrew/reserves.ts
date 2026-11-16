import { type UserPackRecord, damageSlug, packTexts } from "../storage/packs";
import { setText } from "./entries";

/** The place in the texts of a pack where the name of a reserve it declares is kept. */
export const RESERVE_OWNER = "pool";

/** The reserves of points a pack declares (psi points, mana), by slug. */
export const ownReserves = (record: UserPackRecord): string[] => record.meta?.reserves ?? [];

/** `psi-points` -> `Psi points`: what a reserve is called while no one has written its name. */
export const readableReserve = (slug: string): string => {
  const words = slug.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** The name of a reserve in a language: the translation, else the original, else the slug made readable. */
export function reserveLabel(record: UserPackRecord, slug: string, language: string): string {
  return packTexts(record, [language])[`${RESERVE_OWNER}.${slug}`] || readableReserve(slug);
}

/** Writes the name of a reserve in a language (the pack's own when none is given). */
export function setReserveName(
  record: UserPackRecord,
  slug: string,
  name: string,
  language?: string,
): UserPackRecord {
  return setText(record, RESERVE_OWNER, slug, name, language);
}

/** Declares a reserve by the name a person wrote; the name is kept as a text so it can be translated. */
export function addReserve(
  record: UserPackRecord,
  name: string,
): { record: UserPackRecord; slug: string } | undefined {
  const slug = damageSlug(name);
  if (!slug) return undefined;
  const own = ownReserves(record);
  const next = own.includes(slug)
    ? record
    : { ...record, meta: { ...record.meta, reserves: [...own, slug] } };
  const named = record.strings[`${RESERVE_OWNER}.${slug}`]
    ? next
    : setReserveName(next, slug, name.trim());
  return { record: named, slug };
}

/** Takes a reserve away, with its names in every language. Effects that name it keep the name. */
export function removeReserve(record: UserPackRecord, slug: string): UserPackRecord {
  const key = `${RESERVE_OWNER}.${slug}`;
  const without = (texts: Record<string, string>) =>
    Object.fromEntries(Object.entries(texts).filter(([k]) => k !== key));
  const { translations } = record;
  return {
    ...record,
    meta: { ...record.meta, reserves: ownReserves(record).filter((r) => r !== slug) },
    strings: without(record.strings),
    ...(translations && {
      translations: Object.fromEntries(
        Object.entries(translations).map(([l, t]) => [l, without(t)]),
      ),
    }),
  };
}

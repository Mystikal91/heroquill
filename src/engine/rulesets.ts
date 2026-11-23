/**
 * Which rules an entry belongs to. The SRD packs carry their edition in the id prefix (`srd51:`,
 * `srd52:`); a pack the person added (Aurora, homebrew) has any other prefix and belongs to every
 * edition. A character sees its own edition's SRD plus those packs, never the other SRD.
 */
export const inRuleset = (entryId: string, ruleset: string): boolean =>
  entryId.startsWith(`${ruleset}:`) || !/^srd\d+:/.test(entryId);

/** The flag that the backgrounds of the 2024 books set: they give the ability increases, so the species gives none. */
const BACKGROUND_ASI_FLAG = "ID_INTERNAL_GRANTS_BACKGROUND_ASI";

/**
 * Whether a background is written for the 2024 rules, where the background gives the ability score increases
 * (an element of Aurora that sets the flag for it). A 2014 character cannot use one: the flag takes the increases
 * of its species away and the background's own are not given, so the scores are lost.
 */
export function isBackgroundOf2024(entry: {
  kind: string;
  effects: readonly { type: string; id?: string; effects?: unknown }[];
}): boolean {
  if (entry.kind !== "background") return false;
  const holds = (effects: readonly { type: string; id?: string; effects?: unknown }[]): boolean =>
    effects.some(
      (e) =>
        (e.type === "flag" && e.id === BACKGROUND_ASI_FLAG) ||
        (e.type === "when" && Array.isArray(e.effects) && holds(e.effects)),
    );
  return holds(entry.effects);
}

/**
 * The spell a 2024 character gets where a book wrote a 2014 one: `srd51:spell/fireball` becomes
 * `srd52:spell/fireball` when the 2024 SRD has a spell with that name (all but Branding Smite and Feeblemind do).
 * Anything else is left as it is.
 */
export function spellFor2024(id: string, index: { has(id: string): boolean }): string {
  const match = /^srd51:spell\/(.+)$/.exec(id);
  const twin = match ? `srd52:spell/${match[1]}` : undefined;
  return twin && index.has(twin) ? twin : id;
}

/** `value` with every 2014 spell id inside it (an effect, a list of ids) turned into the 2024 spell. */
export function localizeSpells<T>(value: T, index: { has(id: string): boolean }): T {
  if (typeof value === "string") return spellFor2024(value, index) as T;
  if (Array.isArray(value)) return value.map((v) => localizeSpells(v, index)) as T;
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, localizeSpells(v, index)]),
    ) as T;
  return value;
}

/**
 * Whether a subclass belongs to a class. The parent of a subclass from a book (Aurora) is the 2014 SRD class it
 * was written for (`srd51:class/fighter`): the 2024 class of the same name takes it too, as a table plays a 2014
 * subclass on the new class. The subclasses of the SRD itself stay with their own edition's class.
 */
export function subclassOf(
  sub: { id: string; parent?: string | undefined },
  classId: string,
): boolean {
  if (sub.parent === classId) return true;
  const slug = classId.startsWith("srd52:class/")
    ? classId.slice("srd52:class/".length)
    : undefined;
  return Boolean(slug && !/^srd\d+:/.test(sub.id) && sub.parent === `srd51:class/${slug}`);
}

import type { Character } from "../engine/character";
import { type UserPackRecord, parseUserPack, withoutRestricted } from "./packs";

/**
 * The homebrew packs a character uses: those with an entry the character refers to (a spell it
 * knows, an item it carries, a class or species of the pack), and the packs those entries need in
 * turn. Packs imported from Aurora are never included.
 */
export function homebrewUsedBy(character: Character, packs: UserPackRecord[]): UserPackRecord[] {
  const own = packs.filter((p) => p.origin === "homebrew");
  const used = new Map<string, UserPackRecord>();
  const pending = [JSON.stringify(character)];
  while (pending.length > 0) {
    const text = pending.pop() ?? "";
    for (const pack of own) {
      if (used.has(pack.id) || !text.includes(`"${pack.id}:`)) continue;
      used.set(pack.id, pack);
      pending.push(JSON.stringify(pack.pack.entries));
    }
  }
  // What was copied from imported content stays on this device, as the imported packs do.
  return [...used.values()].map(withoutRestricted);
}

/** Reads the packs that came with a character file; the ones that cannot be read are left out. */
export function carriedPacks(raw: unknown): UserPackRecord[] {
  const list = (raw as { homebrew?: unknown } | null)?.homebrew;
  if (!Array.isArray(list)) return [];
  const found: UserPackRecord[] = [];
  for (const item of list) {
    try {
      found.push({ ...parseUserPack(item), origin: "homebrew" });
    } catch {
      // A pack that cannot be read: the character still opens.
    }
  }
  return found;
}

/**
 * What to keep when a pack arrives with a character and the device may have it already: the
 * entries and texts it lacks are added, and what is here stays as it is, so nothing the person
 * wrote on this device is overwritten. `added` counts the entries brought in.
 */
export function mergeCarried(
  here: UserPackRecord | undefined,
  incoming: UserPackRecord,
): { record: UserPackRecord; added: number } {
  if (!here) return { record: incoming, added: incoming.pack.entries.length };
  const known = new Set(here.pack.entries.map((e) => e.id));
  const fresh = incoming.pack.entries.filter((e) => !known.has(e.id));
  if (fresh.length === 0) return { record: here, added: 0 };
  const names = new Set(fresh.map((e) => e.id));
  const isNew = (key: string) => [...names].some((id) => key.startsWith(`${id}.`));
  const strings = { ...here.strings };
  for (const [key, text] of Object.entries(incoming.strings))
    if (!(key in strings) && isNew(key)) strings[key] = text;
  // The translations of the new entries come along, language by language.
  const translations = { ...here.translations };
  for (const [language, texts] of Object.entries(incoming.translations ?? {})) {
    const merged = { ...translations[language] };
    for (const [key, text] of Object.entries(texts))
      if (!(key in merged) && isNew(key)) merged[key] = text;
    if (Object.keys(merged).length > 0) translations[language] = merged;
  }
  const provenance = { ...here.provenance };
  for (const [id, origin] of Object.entries(incoming.provenance ?? {}))
    if (names.has(id as never)) provenance[id] = origin;
  return {
    record: {
      ...here,
      strings,
      ...(Object.keys(translations).length > 0 && { translations }),
      ...(Object.keys(provenance).length > 0 && { provenance }),
      pack: { ...here.pack, entries: [...here.pack.entries, ...fresh] },
    },
    added: fresh.length,
  };
}

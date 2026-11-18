/**
 * The version of the pack format. A pack record and a pack file both carry it, so a newer app can
 * read an older pack (it is migrated step by step) and an older app can refuse a newer one.
 *
 * 1: one language per pack, no metadata (everything before the homebrew rework).
 * 2: a pack is a "book": metadata, texts in several languages, and where entries were copied from.
 * 3: the reserves of points, the kinds of damage and the spell components a pack adds are entries of their
 *    own kinds (`reserve`, `damage`, `component`), no longer lists in the metadata.
 */
export const PACK_FORMAT_VERSION = 3;

/** The name a pack file carries since version 2. Older files say `dnd-character-maker-pack`. */
export const PACK_FILE_FORMAT = "heroquill-pack";
export const LEGACY_PACK_FILE_FORMAT = "dnd-character-maker-pack";

/** Raised for a pack made by a newer version of the app than this one. */
export class PackTooNewError extends Error {}

type Raw = Record<string, unknown>;

/** One step per version: takes a record of version `n` and returns it as version `n + 1`. */
const STEPS: Record<number, (record: Raw) => Raw> = {
  // 1 -> 2: nothing is lost; the new fields are all optional and start empty.
  1: (record) => ({ ...record, formatVersion: 2 }),
  // 2 -> 3: the three lists of the metadata become entries, with their names where entries keep them.
  2: (record) => ({ ...wordsAsEntries(record), formatVersion: 3 }),
};

/** The word the data uses for a name: lower case, no accents, dashes between words. */
const slugOf = (name: string): string =>
  name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** The recharge the effects of a pack gave a reserve (the last one written), for the entry that now holds it. */
function rechargeOf(entries: Raw[], reserve: string): "short" | "long" {
  let found: "short" | "long" = "long";
  const visit = (effects: unknown) => {
    if (!Array.isArray(effects)) return;
    for (const e of effects as Raw[]) {
      if (
        e.type === "uses" &&
        e.reserve === reserve &&
        (e.recharge === "short" || e.recharge === "long")
      )
        found = e.recharge;
      if (e.type === "when") visit(e.effects);
    }
  };
  for (const entry of entries) visit(entry.effects);
  return found;
}

/**
 * Version 2 kept the reserves (`meta.reserves`), the kinds of damage (`meta.damageTypes`) and the
 * components (`meta.components`) a pack adds as lists of words, with their names in the texts under
 * `pool.<word>` and `damage.<word>`. Each becomes an entry, and its name moves to the entry.
 */
function wordsAsEntries(record: Raw): Raw {
  const { damageTypes, reserves, components, ...meta } = (record.meta ?? {}) as Raw;
  const lists: [kind: string, owner: string, list: unknown][] = [
    ["damage", "damage", damageTypes],
    ["reserve", "pool", reserves],
    ["component", "", components],
  ];
  const pack = record.pack as { manifest?: { id?: string }; entries?: Raw[] } | undefined;
  const hasWords = lists.some(([, , list]) => Array.isArray(list) && list.length > 0);
  const { meta: _meta, ...rest } = record;
  const next: Raw = Object.keys(meta).length > 0 ? { ...rest, meta } : rest;
  if (!hasWords || !pack || !Array.isArray(pack.entries) || !pack.manifest?.id) return next;

  const packId = pack.manifest.id;
  const entries = [...pack.entries];
  const strings = { ...((record.strings ?? {}) as Record<string, string>) };
  const translations = Object.fromEntries(
    Object.entries((record.translations ?? {}) as Record<string, Record<string, string>>).map(
      ([language, texts]) => [language, { ...texts }],
    ),
  );
  for (const [kind, owner, list] of lists) {
    if (!Array.isArray(list)) continue;
    for (const word of list) {
      if (typeof word !== "string" || !word.trim()) continue;
      const slug = slugOf(word) || kind;
      const id = `${packId}:${kind}/${slug}`;
      if (entries.some((e) => e.id === id)) continue;
      const data =
        kind === "reserve"
          ? { recharge: rechargeOf(pack.entries, word) }
          : kind === "component"
            ? { code: word }
            : {};
      entries.push({ id, kind, effects: [], data });
      const old = `${owner}.${word}`;
      if (owner && old in strings) {
        strings[`${id}.name`] = strings[old] as string;
        delete strings[old];
      } else if (!owner) strings[`${id}.name`] = word;
      for (const texts of Object.values(translations)) {
        if (owner && old in texts) {
          texts[`${id}.name`] = texts[old] as string;
          delete texts[old];
        }
      }
    }
  }
  return {
    ...next,
    pack: { ...pack, entries },
    strings,
    ...(Object.keys(translations).length > 0 && { translations }),
  };
}

/** The version a raw record says it is; a record without one is from before versions existed. */
export function versionOf(raw: unknown): number {
  const v = (raw as { formatVersion?: unknown } | null)?.formatVersion;
  return typeof v === "number" && Number.isInteger(v) && v >= 1 ? v : 1;
}

/**
 * Brings a raw pack record (from storage, a file, a character or a backup) up to the current
 * version. Anything that is not an object is returned as it is, for the schema to refuse.
 */
export function migratePackRecord(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  let version = versionOf(raw);
  if (version > PACK_FORMAT_VERSION)
    throw new PackTooNewError("This pack was made by a newer version of the app");
  let record = raw as Raw;
  while (version < PACK_FORMAT_VERSION) {
    const step = STEPS[version];
    if (!step) break;
    record = step(record);
    version += 1;
  }
  return record;
}

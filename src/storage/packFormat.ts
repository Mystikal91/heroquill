/**
 * The version of the pack format. A pack record and a pack file both carry it, so a newer app can
 * read an older pack (it is migrated step by step) and an older app can refuse a newer one.
 *
 * 1: one language per pack, no metadata (everything before the homebrew rework).
 * 2: a pack is a "book": metadata, texts in several languages, and where entries were copied from.
 */
export const PACK_FORMAT_VERSION = 2;

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
};

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

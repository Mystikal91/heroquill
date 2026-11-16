import * as v from "valibot";
import type { Overlay } from "../content/overlays";
import { EffectSchema, type Pack, parsePack } from "../data/schema";
import { dbDelete, dbGetAll, dbPut } from "./db";
import {
  LEGACY_PACK_FILE_FORMAT,
  PACK_FILE_FORMAT,
  PACK_FORMAT_VERSION,
  PackTooNewError,
  migratePackRecord,
} from "./packFormat";

/** The details of a pack as a "book": who wrote it and what it is. */
export interface PackMeta {
  author?: string;
  description?: string;
  /** The units numbers are typed in while editing: by default those of the language of the pack. */
  units?: "metric" | "imperial";
  /** A small picture for the cover, as a data address. */
  cover?: string;
}

/** Where an entry was copied from, so the copy can be traced and its limits kept. */
export interface EntryOrigin {
  /** The id of the entry it was copied from. */
  from: string;
  /**
   * The copy was made from content the person may not share (an imported pack): it stays on this
   * device and is left out of exports and of the packs that travel with a character.
   */
  restricted?: boolean;
}

/**
 * A pack the user added on this device, with its texts.
 *
 * `personal` packs come from files the user already has (such as content imported from other
 * tools). They stay on this device: they can be removed but never exported or shared as a pack.
 * `homebrew` packs are the user's own work and can be exported.
 * `edits` is the pack of quick edits (the texts the user rewrote), one per language.
 */
export interface UserPackRecord {
  id: string;
  name: string;
  origin: "personal" | "homebrew" | "edits";
  addedAt: number;
  pack: Pack;
  /** Texts keyed by `<entry id>.<field>` (`name`, `desc`, ...). */
  strings: Record<string, string>;
  /** Language the texts are written in, e.g. `en`. */
  lang: string;
  /** The version of the pack format; `parseUserPack` always sets it (see `packFormat.ts`). */
  formatVersion?: number;
  /** The details of the pack as a book. */
  meta?: PackMeta;
  /** The same texts in other languages: by language, then `<entry id>.<field>`. `strings` is in `lang`. */
  translations?: Record<string, Record<string, string>>;
  /** Where entries were copied from, by entry id. */
  provenance?: Record<string, EntryOrigin>;
  /** Where an imported pack came from: the address, or the names of the files. */
  source?: { url?: string; urls?: string[]; files?: string[] };
  /** The version of the importer that made it (see `AURORA_IMPORT_VERSION`); absent in old packs. */
  importVersion?: number;
  /** Whether the 2024 versions were kept when it was imported, so importing again does the same. */
  keepEditions?: boolean;
  /** The entry each Aurora id became, so importing again can tell which entry is which. */
  aids?: Record<string, string>;
  /** The book each listed entry comes from, by entry id (see `AuroraResult.books`). */
  books?: Record<string, string>;
  /** The Aurora ids that entries refer to and the files did not define, by entry id. */
  unresolved?: Record<string, string[]>;
  /** What the pack adds to entries of the app, by entry id (see `AuroraResult.overlays`). */
  overlays?: Record<string, Overlay>;
}

/**
 * Every address a pack was imported from: one, or several when the indexes of a set were read
 * together as one pack (`urls`; `url` is the first of them).
 */
export const addressesOf = (record: UserPackRecord): string[] =>
  record.source?.urls ?? (record.source?.url ? [record.source.url] : []);

const RecordSchema = v.object({
  id: v.string(),
  name: v.string(),
  origin: v.picklist(["personal", "homebrew", "edits"]),
  addedAt: v.number(),
  pack: v.unknown(),
  strings: v.record(v.string(), v.string()),
  lang: v.string(),
  formatVersion: v.optional(v.number()),
  meta: v.optional(
    v.object({
      author: v.optional(v.string()),
      description: v.optional(v.string()),
      units: v.optional(v.picklist(["metric", "imperial"])),
      cover: v.optional(v.pipe(v.string(), v.maxLength(300_000))),
    }),
  ),
  translations: v.optional(v.record(v.string(), v.record(v.string(), v.string()))),
  provenance: v.optional(
    v.record(v.string(), v.object({ from: v.string(), restricted: v.optional(v.boolean()) })),
  ),
  source: v.optional(
    v.object({
      url: v.optional(v.string()),
      urls: v.optional(v.array(v.string())),
      files: v.optional(v.array(v.string())),
    }),
  ),
  importVersion: v.optional(v.number()),
  keepEditions: v.optional(v.boolean()),
  aids: v.optional(v.record(v.string(), v.string())),
  books: v.optional(v.record(v.string(), v.string())),
  unresolved: v.optional(v.record(v.string(), v.array(v.string()))),
  overlays: v.optional(
    v.record(
      v.string(),
      v.object({
        effects: v.optional(v.array(EffectSchema)),
        activation: v.optional(v.string()),
      }),
    ),
  ),
});

/** Ids of the packs that ship with the app: a user pack may not take their place. */
const RESERVED_IDS = new Set(["srd51", "srd52"]);

/**
 * The order packs apply in: what comes later wins. Content read from other tools first, then the
 * user's homebrew, then the quick edits, which always have the last word. Within one kind, the
 * pack added later wins.
 */
const APPLY_RANK = { personal: 0, homebrew: 1, edits: 2 } as const;
export const orderUserPacks = (records: UserPackRecord[]): UserPackRecord[] =>
  [...records].sort((a, b) => APPLY_RANK[a.origin] - APPLY_RANK[b.origin] || a.addedAt - b.addedAt);

/** An address shortened for a list: the site, then "..." and the file (`github.com/.../index.xml`). */
export function shortAddress(address: string): string {
  const max = 42;
  try {
    const url = new URL(address);
    const parts = url.pathname.split("/").filter(Boolean);
    const last = decodeURIComponent(parts[parts.length - 1] ?? "");
    const short = parts.length > 1 ? `${url.host}/…/${last}` : `${url.host}/${last}`;
    return short.length > max ? `${short.slice(0, max - 1)}…` : short;
  } catch {
    return address.length > max ? `${address.slice(0, max - 1)}…` : address;
  }
}

export class PackParseError extends Error {}

/** Validates what comes out of storage or a file; throws `PackParseError` when it is not a pack. */
export function parseUserPack(raw: unknown): UserPackRecord {
  let migrated: unknown;
  try {
    migrated = migratePackRecord(raw);
  } catch (error) {
    if (error instanceof PackTooNewError) throw new PackParseError(error.message);
    throw error;
  }
  const parsed = v.safeParse(RecordSchema, migrated);
  if (!parsed.success) throw new PackParseError("Not a content pack");
  let pack: Pack;
  try {
    pack = parsePack(parsed.output.pack);
  } catch {
    throw new PackParseError("The pack data is not valid");
  }
  if (RESERVED_IDS.has(pack.manifest.id))
    throw new PackParseError("That pack id belongs to the content that ships with the app");
  if (pack.manifest.id !== parsed.output.id)
    throw new PackParseError("The pack id does not match its entries");
  return { ...parsed.output, formatVersion: PACK_FORMAT_VERSION, pack };
}

export async function listUserPacks(): Promise<UserPackRecord[]> {
  const records = await dbGetAll<unknown>("packs");
  const packs: UserPackRecord[] = [];
  for (const record of records) {
    try {
      packs.push(parseUserPack(record));
    } catch {
      // A damaged pack is skipped rather than blocking the app.
    }
  }
  return packs.sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveUserPack(record: UserPackRecord): Promise<void> {
  await dbPut("packs", parseUserPack(record));
}

export const deleteUserPack = (id: string) => dbDelete("packs", id);

/** The languages a pack has texts in: the one it was written in first, then its translations. */
export const packLanguages = (record: UserPackRecord): string[] => [
  record.lang,
  ...Object.keys(record.translations ?? {}).filter((l) => l !== record.lang),
];

/**
 * The texts of a pack for the languages in use, `locales` being the languages of the app in order
 * of preference. A text is taken from the first preferred language that has it; the language the
 * pack was written in is the last resort, so nothing is ever missing.
 */
export function packTexts(record: UserPackRecord, locales: string[]): Record<string, string> {
  const translations = record.translations;
  if (!translations) return record.strings;
  // Languages the person prefers over the original one; those after it never beat it.
  const own = locales.indexOf(record.lang);
  const preferred = own === -1 ? locales : locales.slice(0, own);
  const out = { ...record.strings };
  for (const locale of [...preferred].reverse()) {
    for (const [key, value] of Object.entries(translations[locale] ?? {}))
      if (value) out[key] = value;
  }
  return out;
}

/** The ids of the entries that may not leave this device (copies of imported content). */
export const restrictedIds = (record: UserPackRecord): string[] =>
  Object.entries(record.provenance ?? {}).flatMap(([id, from]) => (from.restricted ? [id] : []));

/**
 * The pack without the entries that may not be shared, and their texts and notes of origin. The
 * same pack when there are none.
 */
export function withoutRestricted(record: UserPackRecord): UserPackRecord {
  const gone = restrictedIds(record);
  if (gone.length === 0) return record;
  const goes = (key: string) => gone.some((id) => key.startsWith(`${id}.`));
  const keep = (texts: Record<string, string>) =>
    Object.fromEntries(Object.entries(texts).filter(([key]) => !goes(key)));
  const provenance = Object.fromEntries(
    Object.entries(record.provenance ?? {}).filter(([id]) => !gone.includes(id)),
  );
  const { translations, ...rest } = record;
  return {
    ...rest,
    strings: keep(record.strings),
    pack: { ...record.pack, entries: record.pack.entries.filter((e) => !gone.includes(e.id)) },
    ...(translations && {
      translations: Object.fromEntries(Object.entries(translations).map(([l, t]) => [l, keep(t)])),
    }),
    provenance,
  };
}

/**
 * The text of a pack file. Only homebrew packs may be exported, and the entries copied from
 * imported content are left out (`restrictedIds` tells which, so the person can be told).
 */
export function serializePack(record: UserPackRecord): string {
  if (record.origin !== "homebrew") throw new PackParseError("Personal packs cannot be exported");
  const { origin: _origin, addedAt: _addedAt, ...rest } = withoutRestricted(record);
  return `${JSON.stringify(
    { format: PACK_FILE_FORMAT, ...rest, formatVersion: PACK_FORMAT_VERSION },
    null,
    2,
  )}
`;
}

export function packFileName(record: UserPackRecord): string {
  const slug = record.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || record.id}.dndpack.json`;
}

/** Reads a pack file made by `serializePack`; the result is always a homebrew pack. */
export function parsePackFile(text: string, now = Date.now()): UserPackRecord {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new PackParseError("The file is not valid JSON");
  }
  const format = (raw as { format?: unknown } | null)?.format;
  if (
    typeof raw !== "object" ||
    raw === null ||
    (format !== PACK_FILE_FORMAT && format !== LEGACY_PACK_FILE_FORMAT)
  )
    throw new PackParseError("This is not a content pack file");
  return parseUserPack({ ...(raw as object), origin: "homebrew", addedAt: now });
}

/**
 * The units a pack is edited in: its own choice, else metric for every language but English. The
 * data is always in feet and pounds; this only says how the numbers are typed and shown in the editor.
 */
export const packUnits = (record: UserPackRecord): "metric" | "imperial" =>
  record.meta?.units ?? (record.lang === "en" ? "imperial" : "metric");

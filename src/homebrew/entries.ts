import * as v from "valibot";
import { type Effect, EffectSchema, type Entry, EntrySchema } from "../data/schema";
import { slugify } from "../import/aurora/xml";
import type { UserPackRecord } from "../storage/packs";
import { checkData } from "./catalog/data";
import { KIND_META } from "./catalog/kinds";

/**
 * Working on the entries of a pack directly: the entry is what is edited, not a form that is turned
 * into an entry. Nothing the editor does not know is lost, because nothing is rebuilt. Every
 * function takes a pack record and returns a new one.
 */

export class EntryError extends Error {}

type Id = Entry["id"];
const packOf = (id: string) => id.split(":")[0] ?? "";

/** What is wrong with an entry: its effects against the engine's schema, its data against the catalog. */
export function entryProblems(entry: Entry): string[] {
  const problems: string[] = [];
  const parsed = v.safeParse(EntrySchema, entry);
  if (!parsed.success) problems.push(...parsed.issues.map((i) => i.message));
  for (const effect of entry.effects) {
    const result = v.safeParse(EffectSchema, effect);
    if (!result.success) problems.push(`effects: ${result.issues[0]?.message ?? "not valid"}`);
  }
  problems.push(...checkData(entry.kind, entry.data));
  return problems;
}

/** An id for a new entry: the name as a slug, made unique within the pack. */
export function newEntryId(record: UserPackRecord, kind: Entry["kind"], name: string): Id {
  const base = slugify(name) || kind;
  const taken = new Set(record.pack.entries.map((e) => e.id));
  let slug = base;
  for (let n = 2; taken.has(`${record.id}:${kind}/${slug}`); n++) slug = `${base}-${n}`;
  return `${record.id}:${kind}/${slug}` as Id;
}

const withEntries = (record: UserPackRecord, entries: Entry[]): UserPackRecord => ({
  ...record,
  pack: { ...record.pack, entries },
});

/** Adds a new entry (with its texts, in the language of the pack). The id must start with the pack's. */
export function addEntry(
  record: UserPackRecord,
  entry: Entry,
  texts: Record<string, string> = {},
): UserPackRecord {
  if (packOf(entry.id) !== record.id) throw new EntryError("The id does not belong to this pack");
  if (record.pack.entries.some((e) => e.id === entry.id))
    throw new EntryError("An entry with this id exists already");
  const next = withEntries(record, [...record.pack.entries, entry]);
  return {
    ...next,
    strings: {
      ...record.strings,
      ...Object.fromEntries(
        Object.entries(texts).map(([field, text]) => [`${entry.id}.${field}`, text]),
      ),
    },
  };
}

/** What can change in an entry. Keys of `data` set to `undefined` are taken out. */
export interface EntryChange {
  effects?: Effect[];
  data?: Record<string, unknown>;
  parent?: Id | undefined;
}

/** Changes an entry in place: the effects are replaced, the data is merged, nothing else is touched. */
export function updateEntry(
  record: UserPackRecord,
  id: string,
  change: EntryChange,
): UserPackRecord {
  const entry = record.pack.entries.find((e) => e.id === id);
  if (!entry) throw new EntryError("No such entry");
  const data = { ...entry.data };
  for (const [key, value] of Object.entries(change.data ?? {})) {
    if (value === undefined) delete data[key];
    else data[key] = value;
  }
  const { parent: _parent, ...rest } = entry;
  const parent = "parent" in change ? change.parent : entry.parent;
  const next: Entry = {
    ...rest,
    ...(parent && { parent }),
    effects: change.effects ?? entry.effects,
    data,
  };
  return withEntries(
    record,
    record.pack.entries.map((e) => (e.id === id ? next : e)),
  );
}

/**
 * Writes a text of an entry in a language: in the texts of the pack when it is the language the
 * pack was written in, else in its translations. An empty text takes the text away.
 */
export function setText(
  record: UserPackRecord,
  id: string,
  field: string,
  value: string,
  language: string = record.lang,
): UserPackRecord {
  const key = `${id}.${field}`;
  const put = (texts: Record<string, string>) => {
    const { [key]: _old, ...rest } = texts;
    return value.trim() ? { ...rest, [key]: value } : rest;
  };
  if (language === record.lang) return { ...record, strings: put(record.strings) };
  return {
    ...record,
    translations: {
      ...record.translations,
      [language]: put(record.translations?.[language] ?? {}),
    },
  };
}

/** Every id an entry refers to as something it owns: traits it gives, features it lists by level. */
function referencedIds(entry: Entry): string[] {
  const found: string[] = [];
  const visit = (effects: Effect[]) => {
    for (const effect of effects) {
      if (effect.type === "trait") found.push(effect.id);
      else if (effect.type === "when") visit(effect.effects);
    }
  };
  visit(entry.effects);
  const levels = (entry.data as { levels?: { features?: string[] }[] }).levels ?? [];
  for (const row of levels) found.push(...(row.features ?? []));
  return found;
}

/** The entries of the pack that `id` owns (and what they own in turn), by what the catalog says each kind owns. */
export function ownedEntries(record: UserPackRecord, id: string): Entry[] {
  const byId = new Map(record.pack.entries.map((e) => [e.id as string, e]));
  const owned: Entry[] = [];
  const seen = new Set([id]);
  const queue = [byId.get(id)];
  while (queue.length > 0) {
    const entry = queue.shift();
    if (!entry) continue;
    const kinds = KIND_META[entry.kind].owns ?? [];
    for (const ref of referencedIds(entry)) {
      const child = byId.get(ref);
      if (!child || seen.has(ref) || packOf(ref) !== record.id || !kinds.includes(child.kind))
        continue;
      seen.add(ref);
      owned.push(child);
      queue.push(child);
    }
  }
  return owned;
}

/** Takes entries out of a pack with their texts, translations and notes of origin. */
export function dropEntries(record: UserPackRecord, ids: readonly string[]): UserPackRecord {
  const gone = new Set(ids);
  const goes = (key: string) => ids.some((id) => key.startsWith(`${id}.`));
  const keep = (texts: Record<string, string>) =>
    Object.fromEntries(Object.entries(texts).filter(([key]) => !goes(key)));
  const { translations, provenance, ...rest } = record;
  return {
    ...rest,
    strings: keep(record.strings),
    ...(translations && {
      translations: Object.fromEntries(Object.entries(translations).map(([l, t]) => [l, keep(t)])),
    }),
    ...(provenance && {
      provenance: Object.fromEntries(Object.entries(provenance).filter(([id]) => !gone.has(id))),
    }),
    pack: { ...record.pack, entries: record.pack.entries.filter((e) => !gone.has(e.id)) },
  };
}

/** Deletes an entry together with the entries it owns (the traits of a species, the features of a class). */
export function deleteEntry(record: UserPackRecord, id: string): UserPackRecord {
  return dropEntries(record, [id, ...ownedEntries(record, id).map((e) => e.id)]);
}

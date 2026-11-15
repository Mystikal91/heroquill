import type { Entry } from "../data/schema";
import { slugify } from "../import/aurora/xml";
import type { EntryOrigin, UserPackRecord } from "../storage/packs";
import { dropEntries, ownedEntries, ownedFrom } from "./entries";

/**
 * Moving, copying and renaming entries between packs. An entry's id carries its pack
 * (`pack:kind/slug`), so every one of these means new ids, and everything that points at an entry
 * has to follow it: other entries, the texts that are keyed by id, and the characters (the caller
 * puts those right with the same map of old ids to new ones).
 */

const ID = /\b([a-z][a-z0-9]*):([a-z]+\/[a-z0-9-]+)/g;

type IdMap = ReadonlyMap<string, string>;

/** The value with every id in the map replaced, wherever it is written (in a text, a list, a key). */
export function rewriteIds<T>(value: T, map: IdMap): T {
  if (map.size === 0) return value;
  const text = JSON.stringify(value);
  const fixed = text.replace(ID, (id) => map.get(id) ?? id);
  return fixed === text ? value : (JSON.parse(fixed) as T);
}

const slugOf = (id: string) => id.split("/")[1] ?? "";
const kindOf = (id: string) => (id.split(":")[1] ?? "").split("/")[0] ?? "";
const packOf = (id: string) => id.split(":")[0] ?? "";

/** A group of entries lifted out of a pack, with their texts, ready to be put into another. */
export interface Bundle {
  /** The pack they come from (an id of a pack, or of the rules). */
  source: string;
  /** The language the texts are in. */
  lang: string;
  entries: Entry[];
  strings: Record<string, string>;
  translations: Record<string, Record<string, string>>;
  provenance: Record<string, EntryOrigin>;
  /** The entries a person asked for; the others came with them (what they own). */
  chosen: string[];
}

/** The entries, with what each owns, and their texts. */
export function bundleOf(record: UserPackRecord, ids: readonly string[]): Bundle {
  const wanted = new Set<string>();
  for (const id of ids) {
    if (!record.pack.entries.some((e) => e.id === id)) continue;
    wanted.add(id);
    for (const owned of ownedEntries(record, id)) wanted.add(owned.id);
  }
  const entries = record.pack.entries.filter((e) => wanted.has(e.id));
  const mine = (key: string) => [...wanted].some((id) => key.startsWith(`${id}.`));
  const pick = (texts: Record<string, string>) =>
    Object.fromEntries(Object.entries(texts).filter(([key]) => mine(key)));
  return {
    source: record.id,
    lang: record.lang,
    entries,
    strings: pick(record.strings),
    translations: Object.fromEntries(
      Object.entries(record.translations ?? {}).map(([l, texts]) => [l, pick(texts)]),
    ),
    provenance: Object.fromEntries(
      Object.entries(record.provenance ?? {}).filter(([id]) => wanted.has(id)),
    ),
    chosen: ids.filter((id) => wanted.has(id)),
  };
}

/**
 * A bundle of entries of the rules (or of content read from another tool): the entries and what they
 * own, with their texts as they read now. `read` gives a text; `fields` lists the texts an entry has.
 */
export function bundleFromIndex(
  index: ReadonlyMap<string, Entry>,
  texts: { fields: (id: string) => string[]; read: (id: string, field: string) => string },
  ids: readonly string[],
  lang: string,
): Bundle {
  const wanted = new Set<string>();
  for (const id of ids) {
    if (!index.has(id)) continue;
    wanted.add(id);
    for (const owned of ownedFrom(index, id)) wanted.add(owned.id);
  }
  const entries = [...wanted].map((id) => index.get(id) as Entry);
  const strings: Record<string, string> = {};
  for (const e of entries)
    for (const field of texts.fields(e.id)) {
      const text = texts.read(e.id, field);
      if (text) strings[`${e.id}.${field}`] = text;
    }
  return {
    source: ids[0] ? packOf(ids[0]) : "",
    lang,
    entries,
    strings,
    translations: {},
    provenance: {},
    chosen: ids.filter((id) => wanted.has(id)),
  };
}

/** Entries of the same pack that these refer to and that are not among them (and what those own). */
export function dependenciesOf(record: UserPackRecord, ids: readonly string[]): string[] {
  const byId = new Map(record.pack.entries.map((e) => [e.id as string, e]));
  const have = new Set(bundleOf(record, ids).entries.map((e) => e.id as string));
  const found: string[] = [];
  const queue = [...have];
  while (queue.length > 0) {
    const entry = byId.get(queue.shift() ?? "");
    if (!entry) continue;
    for (const [id] of JSON.stringify(entry).matchAll(ID)) {
      if (have.has(id) || packOf(id) !== record.id || !byId.has(id)) continue;
      // What a dependency owns comes with it.
      for (const e of bundleOf(record, [id]).entries) {
        if (have.has(e.id)) continue;
        have.add(e.id);
        queue.push(e.id);
        if (e.id === id) found.push(id);
      }
    }
  }
  return found;
}

/** A new id for an entry in a pack: its slug, made unique among the ids already there. */
function freshId(taken: Set<string>, pack: string, old: string): string {
  const base = slugOf(old).replace(/-\d+$/, "") || kindOf(old);
  let slug = slugOf(old);
  for (let n = 2; taken.has(`${pack}:${kindOf(old)}/${slug}`); n++) slug = `${base}-${n}`;
  const id = `${pack}:${kindOf(old)}/${slug}`;
  taken.add(id);
  return id;
}

export interface ImportOptions {
  /** Changes the name of the entries that were chosen (not of what they own): `(copy)` after a duplicate. */
  rename?: (name: string) => string;
  /** The entries were copied from content that may not be shared: they stay on this device. */
  restricted?: boolean;
  /** Notes where each came from (an id of the rules, for a copy of an entry of the rules). */
  from?: (id: string) => string | undefined;
}

/**
 * Puts a bundle into a pack under new ids. Returns the pack and the map from the old ids to the new
 * ones. References among the bundled entries follow; references to anything else stay as they are.
 */
export function importBundle(
  bundle: Bundle,
  target: UserPackRecord,
  options: ImportOptions = {},
): { record: UserPackRecord; idMap: Map<string, string>; newIds: string[] } {
  const taken = new Set(target.pack.entries.map((e) => e.id as string));
  const idMap = new Map<string, string>();
  for (const entry of bundle.entries) idMap.set(entry.id, freshId(taken, target.id, entry.id));

  const entries = bundle.entries.map((e) => {
    const next = rewriteIds(e, idMap);
    return { ...next, id: idMap.get(e.id) as Entry["id"] };
  });
  const rekey = (texts: Record<string, string>) =>
    Object.fromEntries(
      Object.entries(texts).map(([key, text]) => {
        const old = bundle.entries.find((e) => key.startsWith(`${e.id}.`))?.id;
        return [old ? `${idMap.get(old)}${key.slice(old.length)}` : key, text];
      }),
    );
  const strings = rekey(bundle.strings);
  const translations = Object.fromEntries(
    Object.entries(bundle.translations).map(([l, texts]) => [l, rekey(texts)]),
  );
  if (options.rename) {
    for (const id of bundle.chosen) {
      const key = `${idMap.get(id)}.name`;
      if (strings[key]) strings[key] = options.rename(strings[key]);
      for (const texts of Object.values(translations))
        if (texts[key]) texts[key] = options.rename(texts[key]);
    }
  }

  const provenance: Record<string, EntryOrigin> = { ...target.provenance };
  for (const e of bundle.entries) {
    const mapped = idMap.get(e.id) as string;
    const before = bundle.provenance[e.id];
    const from = options.from?.(e.id);
    const restricted = options.restricted || before?.restricted;
    if (from || before)
      provenance[mapped] = {
        from: before?.from ?? from ?? e.id,
        ...(restricted && { restricted: true }),
      };
    else if (restricted) provenance[mapped] = { from: e.id, restricted: true };
  }

  // The texts go where their language is: the pack's own, or its translations.
  const texts: Record<string, string> = { ...target.strings };
  const translated: Record<string, Record<string, string>> = { ...target.translations };
  const put = (lang: string, more: Record<string, string>) => {
    if (lang === target.lang) Object.assign(texts, more);
    else translated[lang] = { ...translated[lang], ...more };
  };
  put(bundle.lang, strings);
  for (const [lang, more] of Object.entries(translations)) put(lang, more);
  return {
    record: {
      ...target,
      strings: texts,
      pack: { ...target.pack, entries: [...target.pack.entries, ...entries] },
      ...(Object.keys(translated).length > 0 && { translations: translated }),
      ...(Object.keys(provenance).length > 0 && { provenance }),
    },
    idMap,
    newIds: bundle.chosen.map((id) => idMap.get(id) as string),
  };
}

/**
 * Applies a map of old ids to new ones to a pack: the entries it holds under an old id take the new
 * one (with their texts), and every reference to an old id, in any entry, becomes the new one.
 */
export function applyIdMap(record: UserPackRecord, map: IdMap): UserPackRecord {
  if (map.size === 0) return record;
  const renameKey = (key: string) => {
    for (const [from, to] of map)
      if (key.startsWith(`${from}.`)) return `${to}${key.slice(from.length)}`;
    return key;
  };
  const rekey = (texts: Record<string, string>) =>
    Object.fromEntries(Object.entries(texts).map(([k, t]) => [renameKey(k), t]));
  const entries = record.pack.entries.map((e) => {
    const next = rewriteIds(e, map);
    return next === e && !map.has(e.id)
      ? e
      : { ...next, id: (map.get(e.id) ?? next.id) as Entry["id"] };
  });
  const { translations, provenance, ...rest } = record;
  const same = entries.every((e, i) => e === record.pack.entries[i]);
  if (same && ![...map.keys()].some((from) => record.pack.entries.some((e) => e.id === from)))
    return record;
  return {
    ...rest,
    strings: rekey(record.strings),
    ...(translations && {
      translations: Object.fromEntries(Object.entries(translations).map(([l, t]) => [l, rekey(t)])),
    }),
    ...(provenance && {
      provenance: Object.fromEntries(
        Object.entries(provenance).map(([id, o]) => [map.get(id) ?? id, o]),
      ),
    }),
    pack: { ...record.pack, entries },
  };
}

/** The records of a list that a map changes (the others are the same objects, so they are left out). */
const changed = (before: UserPackRecord[], after: UserPackRecord[]) =>
  after.filter((r, i) => r !== before[i]);

export interface Arrangement {
  /** The records that are different now: put these in storage. */
  records: UserPackRecord[];
  /** Old ids to new: for the characters, and for taking the move back. */
  idMap: Map<string, string>;
  /** The ids the chosen entries have now. */
  newIds: string[];
}

/** Copies entries (with what they own) into a pack; the originals stay. `target` may be the source: a duplicate. */
export function copyEntries(
  source: UserPackRecord,
  target: UserPackRecord,
  ids: readonly string[],
  options: ImportOptions = {},
): Arrangement {
  const done = importBundle(bundleOf(source, ids), target, options);
  return { records: [done.record], idMap: new Map(), newIds: done.newIds };
}

/**
 * Moves entries (with what they own) from a pack into another. Whatever referred to them follows:
 * the other entries of both packs and of `others`. The caller migrates the characters by `idMap`.
 */
export function moveEntries(
  source: UserPackRecord,
  target: UserPackRecord,
  ids: readonly string[],
  others: UserPackRecord[] = [],
): Arrangement {
  if (source.id === target.id) return { records: [], idMap: new Map(), newIds: [...ids] };
  const bundle = bundleOf(source, ids);
  const into = importBundle(bundle, target);
  const left = dropEntries(
    source,
    bundle.entries.map((e) => e.id),
  );
  // Whatever pointed at the old ids, in either pack and in the others, points at the new ones.
  const map = into.idMap;
  const results = [
    applyIdMap(left, map),
    applyIdMap(into.record, map),
    ...others.map((o) => applyIdMap(o, map)),
  ];
  return {
    records: changed([source, target, ...others], results),
    idMap: map,
    newIds: into.newIds,
  };
}

/** Whether another entry of the packs refers to this id (so renaming it would change them). */
export function isReferenced(records: UserPackRecord[], id: string): boolean {
  return records.some((r) =>
    r.pack.entries.some((e) => e.id !== id && JSON.stringify(e).includes(id)),
  );
}

/** A new slug for an entry that got its id before it had a name (`spell`, `spell-2`): from the name it has now. */
export function nameBasedId(record: UserPackRecord, id: string, name: string): string | undefined {
  const kind = kindOf(id);
  if (!new RegExp(`^${kind}(-\\d+)?$`).test(slugOf(id))) return undefined;
  const base = slugify(name);
  if (!base) return undefined;
  const taken = new Set(record.pack.entries.map((e) => e.id as string));
  let slug = base;
  for (let n = 2; taken.has(`${record.id}:${kind}/${slug}`); n++) slug = `${base}-${n}`;
  const next = `${record.id}:${kind}/${slug}`;
  return next;
}

/** Renames the id of an entry (its slug) and everything that refers to it. */
export function renameId(
  record: UserPackRecord,
  id: string,
  to: string,
  others: UserPackRecord[] = [],
): Arrangement {
  const map = new Map([[id, to]]);
  const results = [applyIdMap(record, map), ...others.map((o) => applyIdMap(o, map))];
  return { records: changed([record, ...others], results), idMap: map, newIds: [to] };
}

import { relinkEdits } from "../app/quickEdit.logic";
import { withOriginRules } from "../data/originRules";
import { type Pack, parsePack } from "../data/schema";
import { type PackIndex, indexPacks } from "../engine/derive";
import { convertText } from "../i18n/units";
import { type UserPackRecord, orderUserPacks, packTexts } from "../storage/packs";
import { autoText, displayedText } from "../translate/auto";
import { applyOverlays } from "./overlays";
import { spellTerm } from "./spellTerms";

/** Loaded rules content plus helpers to read its translated texts. */
export interface Content {
  packs: Pack[];
  index: PackIndex;
  /** The monsters of the rules are in `packs` (they load only when asked for). */
  monsters: boolean;
  /** A text field of an entry (`name`, `desc`, ...), falling back through the locale chain. */
  text(id: string, field: string): string | undefined;
  /** An entry's display name; falls back to a readable form of its id. */
  name(id: string): string;
  /** The text fields an entry has (`name`, `desc`, ...). */
  fields(id: string): string[];
  /** The text as it reads on screen now (a kept machine translation included), asking for none. */
  displayed(id: string, field: string): string | undefined;
  /** A text exactly as stored: no units converted, no machine translation. */
  raw(id: string, field: string): string | undefined;
  /** The text before the quick edits, if a quick edit changed it. */
  base(id: string, field: string): string | undefined;
  /** A quick edit changed this text. */
  isEdited(id: string, field: string): boolean;
}

// The monsters are a large pack that only the creature views need; they load on demand.
const packFiles = import.meta.glob<Pack>(["/data/*/*.json", "!/data/*/monsters.json"], {
  import: "default",
});
const monsterFiles = import.meta.glob<Pack>("/data/*/monsters.json", { import: "default" });
const stringFiles = import.meta.glob<Record<string, string>>("/locales/*/*/*.json", {
  import: "default",
});

/** `species.json` of pack `srd51` -> `/data/srd51/species.json`, `/locales/<locale>/srd51/...`. */
const localePath = (locale: string, dataPath: string) =>
  dataPath.replace("/data/", `/locales/${locale}/`);

export const prettify = (slug: string) => {
  const words = slug.replace(/-+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/**
 * Loads every content pack and the texts for `locales`, in priority order
 * (e.g. `["it", "en"]`: Italian where translated, English otherwise). The monsters come only
 * when asked for.
 */
export async function loadContent(
  locales: string[],
  userPacks: UserPackRecord[] = [],
  { monsters = false }: { monsters?: boolean } = {},
): Promise<Content> {
  const texts = new Map<string, string>();
  // Texts that are in English although another language is wanted: machine translation may help.
  const english = new Set<string>();
  const packs: Pack[] = [];

  await Promise.all(
    Object.entries(monsters ? { ...packFiles, ...monsterFiles } : packFiles).map(
      async ([path, load]) => {
        const pack = withOriginRules(parsePack(await load()));
        packs.push(pack);
        const idBySlug = new Map(pack.entries.map((e) => [e.id.split("/")[1] ?? "", e.id]));

        // Lowest priority first, so higher-priority locales overwrite.
        for (const locale of [...locales].reverse()) {
          const loadStrings = stringFiles[localePath(locale, path)];
          if (!loadStrings) continue;
          for (const [key, value] of Object.entries(await loadStrings())) {
            const dot = key.indexOf(".");
            const id = idBySlug.get(key.slice(0, dot));
            if (!id || !value) continue;
            const full = `${id}.${key.slice(dot + 1)}`;
            texts.set(full, value);
            if (locale === "en" && locales[0] !== "en") english.add(full);
            else english.delete(full);
          }
        }
      },
    ),
  );

  // Packs the user added: their texts are keyed by full entry id and carry their own language.
  // They apply in order, so a quick edit (the last kind) wins over everything.
  const original = new Map<string, string | undefined>();
  const edited = new Map<string, string>();
  for (const record of orderUserPacks(userPacks)) {
    // Quick edits are written in one language and only apply while it is in use.
    if (record.origin === "edits" && record.lang !== locales[0]) continue;
    const pack = parsePack(record.pack);
    if (packs.some((p) => p.manifest.id === pack.manifest.id)) continue;
    packs.push(pack);
    for (const [key, value] of Object.entries(packTexts(record, locales))) {
      if (!value) continue;
      if (record.origin === "edits") {
        if (!original.has(key)) original.set(key, texts.get(key));
        texts.set(key, value);
        english.delete(key);
        edited.set(key, value);
        continue;
      }
      texts.set(key, value);
      // Content read from other tools is English; what a person wrote is in their own language.
      if (record.origin === "personal" && record.lang !== locales[0]) english.add(key);
    }
  }

  // A quick edit made when the pack had another id (it was imported or downloaded again since)
  // is put on the entry as it is called now, unless that entry has an edit of its own.
  const index = indexPacks(...packs);
  for (const record of orderUserPacks(userPacks))
    if (record.origin === "personal") applyOverlays(index, record.overlays);
  for (const [key, value] of Object.entries(relinkEdits(Object.fromEntries(edited), index))) {
    if (edited.has(key)) continue;
    if (!original.has(key)) original.set(key, texts.get(key));
    texts.set(key, value);
    english.delete(key);
  }

  // Distances and weights read in the units in use. The call reads the unit signal, so whatever
  // shows a text follows a change of units.
  const text = (id: string, field: string) => {
    const key = `${id}.${field}`;
    const value = texts.get(key);
    if (value === undefined) return undefined;
    if (english.has(key)) {
      // The standard words of a spell (1 action, Instantaneous...) are known: no machine needed.
      const term = spellTerm(key.slice(key.lastIndexOf(".") + 1), value, locales[0] ?? "en");
      if (term !== undefined) return term;
    }
    const converted = convertText(value);
    return english.has(key) ? autoText(key, converted) : converted;
  };
  return {
    packs,
    index,
    monsters,
    text,
    name: (id) => text(id, "name") ?? prettify(id.split("/")[1] ?? id),
    fields: (id) => {
      const prefix = `${id}.`;
      return [...texts.keys()]
        .filter((key) => key.startsWith(prefix))
        .map((key) => key.slice(prefix.length))
        .filter((field) => !/^\d+$/.test(field));
    },
    displayed: (id, field) => {
      const key = `${id}.${field}`;
      const value = texts.get(key);
      if (value === undefined) return undefined;
      if (english.has(key)) {
        const term = spellTerm(key.slice(key.lastIndexOf(".") + 1), value, locales[0] ?? "en");
        if (term !== undefined) return term;
      }
      const converted = convertText(value);
      return english.has(key) ? displayedText(key, converted) : converted;
    },
    raw: (id, field) => texts.get(`${id}.${field}`),
    base: (id, field) => {
      const key = `${id}.${field}`;
      return original.has(key) ? original.get(key) : texts.get(key);
    },
    isEdited: (id, field) => original.has(`${id}.${field}`),
  };
}

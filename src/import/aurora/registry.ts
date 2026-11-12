import type { Entry } from "../../data/schema";
import type { Overlay } from "./overlays";
import pairs from "./srdPairs.json";
import { clean, setters, slugify, supportsOf } from "./xml";

export interface AuroraOptions {
  /** Id of the pack the entries are created in, e.g. `imp1a2b3c`. */
  packId: string;
  /** Everything the app already has, so references can be checked and duplicates skipped. */
  index: ReadonlyMap<string, Entry>;
  /** The display name of an entry of the app (used to recognise duplicates by name). */
  nameOf: (id: string) => string;
  /** Keep the 2024 version of what already has a 2014 one (by default the 2014 one is used). */
  keepEditions?: boolean;
}

export interface AuroraResult {
  entries: Entry[];
  /** Texts keyed by `<entry id>.<field>`. */
  strings: Record<string, string>;
  /** Names of the books or sources the elements say they come from. */
  sources: string[];
  /** Elements that were not imported, by Aurora type (`Deity`, `Companion`, ...). */
  skipped: Record<string, number>;
  /** Elements the app already has, so they were left out. */
  duplicates: number;
  /** Entries that repeated another one (same name, text and effects) and were merged into it. */
  merged: number;
  /** 2024 versions left out because the 2014 version of the same thing is there. */
  editions: number;
  /** Rules (stat formulas, conditions...) that the app cannot apply by itself. */
  unsupportedRules: number;
  /** The same, element by element (by Aurora id): only those with some. Checks use it, nothing stored. */
  unsupportedBy: Record<string, number>;
  /** What became of the rules, by kind (`grant/Spell`, `stat/hp:level`...): for the report of the corpus run only. */
  ruleKinds: Record<string, RuleKind>;
  /** The name the files give themselves, if any. */
  title: string;
  /** The entry each Aurora id became, by Aurora id: what a later import matches on. */
  aids: Record<string, string>;
  /**
   * The entry of the app that each element left out as a duplicate was taken for, by Aurora id. A
   * pack imported before the duplicate was recognised made an entry of its own, and the
   * characters that use it move to this one.
   */
  existing: Record<string, string>;
  /**
   * What Aurora adds to entries of the app that its elements are (`srdPairs.json`), by entry id:
   * the numbers a feature shows and how it is used. The pack keeps them and they are put on the
   * entries when the content is built.
   */
  overlays: Record<string, Overlay>;
  /**
   * The book each listed entry (species, class, feat...) says it comes from, by entry id. Two
   * entries of the same name that were imported apart (the core books and the supplements) are
   * told apart by it in a list.
   */
  books: Record<string, string>;
  /**
   * What entries refer to that the files do not define, by entry id: the Aurora ids they miss. It
   * says which entries are incomplete because a book they depend on was not read with them.
   */
  unresolved: Record<string, string[]>;
}

/** How the rules of one kind fared: counts, a few examples, and what the unsupported ones asked for. */
export interface RuleKind {
  applied: number;
  /** Read but turned into nothing, on purpose or not (a flag with nothing to set, a table read elsewhere). */
  silent: number;
  /** Not applied: the app cannot. */
  unsupported: number;
  /** Left out because the requirement does not hold in the plain case. */
  unmet: number;
  examples: string[];
  /** The id or `supports` text of the unsupported rules, with how many asked for it. */
  details: Record<string, number>;
}

/** One `<element>` of an Aurora file. */
export interface Source {
  el: Element;
  type: string;
  name: string;
  /** The Aurora id, e.g. `ID_PHB_SPELL_ALARM`. */
  aid: string;
  source: string;
  /** The kind of entry it becomes, when it becomes one. */
  kind?: string;
  /** The id in the app: a new one in this pack, or the one of an entry the app already has. */
  id?: string;
  /** True when the app already has it, so nothing new is created. */
  existing?: boolean;
}

export interface Context {
  options: AuroraOptions;
  result: AuroraResult;
  /** Every element of the files, by Aurora id. */
  byAid: Map<string, Source>;
  all: Source[];
  /** The same elements, by Aurora type: the files can hold fifteen thousand of them. */
  byType: Map<string, Source[]>;
  /** Elements that must be created, in file order. */
  needed: Set<Source>;
  usedSlugs: Set<string>;
  /** The slug planned for each element that becomes an entry, the same whatever else is imported. */
  slugs?: Map<Source, string>;
  /** Entries of the app by kind and lowercase name. */
  existingByName: Map<string, string>;
}

/** The kind of entry each Aurora element type becomes. Types not listed here are skipped. */
export const KIND_OF: Record<string, string> = {
  Spell: "spell",
  Weapon: "item",
  Armor: "item",
  Item: "item",
  "Magic Item": "item",
  Deity: "deity",
  // A creature a character has: a familiar, a beast, a defender. Its traits and actions are read with it.
  Companion: "monster",
  // A rule a table may switch on (Tasha's customised origin); only the ones other rules ask for.
  Option: "option",
  Language: "language",
  Background: "background",
  Race: "species",
  "Sub Race": "subspecies",
  "Race Variant": "subspecies",
  "Racial Trait": "trait",
  Feat: "feat",
  "Feat Feature": "trait",
  Class: "class",
  "Class Feature": "feature",
  Archetype: "subclass",
  "Archetype Feature": "feature",
};

/** Element types that start something on their own, as opposed to being granted by another. */
export const ROOT_TYPES = new Set([
  "Spell",
  "Weapon",
  "Armor",
  "Item",
  "Magic Item",
  "Deity",
  "Companion",
  "Language",
  "Background",
  "Race",
  "Sub Race",
  "Race Variant",
  "Feat",
  "Class",
  "Archetype",
]);

/**
 * The two ways an origin's free ability increase can be taken (+2 and +1, or +1 three times):
 * elements of the type "Ability Score Improvement" that a select of the race offers by their
 * `supports`. The other elements of that type are single abilities, read by the select itself.
 */
export const isAsiOption = (source: Source): boolean =>
  source.type === "Ability Score Improvement" &&
  elementTags(source).includes("Custom Ability Score Improvement Option");

/**
 * Optional features a character switches on, as options: Tasha's optional class features (hidden
 * items a character "equips" in Aurora) and the optional features of backgrounds, which stand in
 * for the background's own feature.
 */
export const isOptionalBackgroundFeature = (source: Source): boolean =>
  source.type === "Background Feature" &&
  elementTags(source).includes("Optional Background Feature");

export const isOptionalFeatureItem = (source: Source): boolean =>
  (source.type === "Item" &&
    slugify(setters(source.el).get("category")?.text ?? "") === "optional-class-features") ||
  isOptionalBackgroundFeature(source);

/** The kind of entry an element becomes, if it becomes one. */
export const kindOf = (source: Source): string | undefined =>
  isOptionalFeatureItem(source)
    ? "option"
    : (KIND_OF[source.type] ?? (isAsiOption(source) ? "trait" : undefined));

/** Types that are granted or offered by other elements. */
export const FEATURE_TYPES = new Set([
  "Racial Trait",
  "Class Feature",
  "Archetype Feature",
  "Background Feature",
  "Feat Feature",
]);

/**
 * The SRD calls some spells by a name without the wizard's: the books of Aurora keep it
 * (`Melf's Acid Arrow` is `Acid Arrow`). Written by hand, since the SRD hardly changes.
 */
const SPELL_ALIASES: Record<string, string> = {
  "bigby's hand": "arcane hand",
  "drawmij's instant summons": "instant summons",
  "evard's black tentacles": "black tentacles",
  "leomund's secret chest": "secret chest",
  "leomund's tiny hut": "tiny hut",
  "melf's acid arrow": "acid arrow",
  "mordenkainen's faithful hound": "faithful hound",
  "mordenkainen's magnificent mansion": "magnificent mansion",
  "mordenkainen's private sanctum": "private sanctum",
  "mordenkainen's sword": "arcane sword",
  "nystul's magic aura": "arcanist's magic aura",
  "otiluke's freezing sphere": "freezing sphere",
  "otiluke's resilient sphere": "resilient sphere",
  "otto's irresistible dance": "irresistible dance",
  "rary's telepathic bond": "telepathic bond",
  "tasha's hideous laughter": "hideous laughter",
  "tenser's floating disk": "floating disk",
};

/**
 * What an element and an entry of the app share when they are the same thing: kind and name, with
 * the case, the curly quotes of the books and the spaces set aside, and a spell named after a
 * wizard under the name the SRD gives it.
 */
export function nameKey(kind: string, name: string): string {
  const plain = name
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return `${kind}|${kind === "spell" ? (SPELL_ALIASES[plain] ?? plain) : plain}`;
}

export const SRD_PAIRS: Record<string, string[]> = pairs;

/**
 * The entry of the app that an element of the Player's Handbook is, when the names do not say so
 * (`Path of the Berserker` is the SRD's `Berserker`). `srdPairs.json` is made by
 * `scripts/aurora-pairs/pair.py`; what is not in the app's index is left out.
 */
export function pairedEntry(options: AuroraOptions, kind: string, aid: string): string | undefined {
  return (SRD_PAIRS[aid] ?? []).find((id) => options.index.get(id)?.kind === kind);
}

/** Builds the lookup of the app's entries by kind and name, to recognise what it already has. */
export function indexExisting(options: AuroraOptions): Map<string, string> {
  const found = new Map<string, string>();
  for (const entry of options.index.values()) {
    // Only the 2014 SRD: Aurora's books are 2014 rules, and a 2014 character cannot see the entries of the 2024 SRD,
    // so an element that is named like one of them (Goliath, a spell) must stay a pack entry of its own.
    if (!entry.id.startsWith("srd51:")) continue;
    // A magic item of the app has only its text; the one of Aurora also gives what it does.
    if (entry.kind === "item" && entry.data.rarity) continue;
    found.set(nameKey(entry.kind, options.nameOf(entry.id)), entry.id);
  }
  return found;
}

export function readSources(doc: Document): Source[] {
  const sources: Source[] = [];
  for (const el of Array.from(doc.documentElement.getElementsByTagName("element"))) {
    const aid = el.getAttribute("id") ?? "";
    const type = el.getAttribute("type") ?? "";
    const name = clean(el.getAttribute("name"));
    if (aid && type)
      sources.push({ el, type, name, aid, source: clean(el.getAttribute("source")) });
  }
  return sources;
}

/** Aurora's `supports` text of a rule, as tags (`Standard||Exotic` becomes two tags). */
export function tagsOf(text: string | null | undefined): string[] {
  return clean(text)
    .split(/\s*(?:,|\|\||\|)\s*/)
    .filter(Boolean);
}

/** True when two lists of tags share one, ignoring case. */
export const sharesTag = (a: string[], b: string[]) => {
  const lower = new Set(a.map((t) => t.toLowerCase()));
  return b.some((t) => lower.has(t.toLowerCase()));
};

/**
 * The slug of every element that becomes an entry: its name as a slug, and when several elements
 * share a name, a number in the order of their Aurora ids. Counting every element of the files,
 * and not only the ones that end up as entries, keeps an id the same when the importer changes
 * what it makes or the files list their elements in another order.
 */
function planSlugs(ctx: Context): Map<Source, string> {
  const groups = new Map<string, Source[]>();
  for (const source of ctx.all) {
    const kind = kindOf(source);
    const base = slugify(source.name);
    if (!kind || !base || source.id) continue;
    const key = `${kind}/${base}`;
    groups.set(key, [...(groups.get(key) ?? []), source]);
  }
  const planned = new Map<Source, string>();
  for (const [key, sources] of groups) {
    const base = key.slice(key.indexOf("/") + 1);
    sources
      .sort((a, b) => (a.aid < b.aid ? -1 : a.aid > b.aid ? 1 : 0))
      .forEach((source, i) => planned.set(source, i === 0 ? base : `${base}-${i + 1}`));
  }
  return planned;
}

/** Allocates the id of an element: its slug, made unique among the pack's entries. */
export function allocate(ctx: Context, source: Source): void {
  const kind = kindOf(source);
  if (!kind || source.id) return;
  ctx.slugs ??= planSlugs(ctx);
  const base = ctx.slugs.get(source);
  if (!base) return;
  let slug = base;
  // Only a name that already ends in a number can still meet another slug here.
  for (let n = 2; ctx.usedSlugs.has(`${kind}/${slug}`); n++) slug = `${base}-x${n}`;
  ctx.usedSlugs.add(`${kind}/${slug}`);
  source.kind = kind;
  source.id = `${ctx.options.packId}:${kind}/${slug}`;
  ctx.result.aids[source.aid] = source.id;
}
/** The elements of one type, in file order. */
export const ofType = (ctx: Context, type: string): Source[] => ctx.byType.get(type) ?? [];

const tagCache = new WeakMap<Source, string[]>();

/** The supports tags of an element (what it can be selected as). Read once per element. */
export function elementTags(source: Source): string[] {
  let tags = tagCache.get(source);
  if (!tags) {
    tags = supportsOf(source.el);
    tagCache.set(source, tags);
  }
  return tags;
}

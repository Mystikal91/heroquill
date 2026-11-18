import {
  ABILITIES,
  type Ability,
  type Effect,
  type FeatureTerm,
  type ModifierCondition,
  type ModifierTarget,
  type MovementMode,
  type Sense,
  type SpendPool,
} from "../../data/schema";
import { evaluateRequirements } from "../../engine/requirements";
import { classIdByName } from "./emit";
import {
  type Context,
  FEATURE_TYPES,
  type RuleKind,
  type Source,
  elementTags,
  isAsiOption,
  ofType,
} from "./registry";
import { is2024 } from "./repeats";
import { clean, number, setters, slugify, supportsOf } from "./xml";

/** The `<rules>` of an element, as plain data. */
export interface Rule {
  tag: "grant" | "select" | "stat";
  type: string;
  id: string;
  name: string;
  supports: string;
  number: number;
  level: number | undefined;
  value: string;
  requirements: string;
  optional: boolean;
  /** `<item>` children of a list select (personality traits and the like). */
  items: string[];
  attrs: Element;
}

export function readRules(el: Element): Rule[] {
  const rules = el.querySelector(":scope > rules");
  if (!rules) return [];
  return Array.from(rules.children)
    .filter((c) => c.tagName === "grant" || c.tagName === "select" || c.tagName === "stat")
    .map((c) => ({
      tag: c.tagName as Rule["tag"],
      type: c.getAttribute("type") ?? "",
      id: c.getAttribute("id") ?? "",
      name: c.getAttribute("name") ?? "",
      supports: c.getAttribute("supports") ?? "",
      number: Number.parseInt(c.getAttribute("number") ?? "1", 10) || 1,
      level: c.hasAttribute("level")
        ? Number.parseInt(c.getAttribute("level") ?? "", 10)
        : undefined,
      value: c.getAttribute("value") ?? "",
      requirements: c.getAttribute("requirements") ?? "",
      optional: c.getAttribute("optional") === "true",
      items: Array.from(c.querySelectorAll("item")).map((i) => clean(i.textContent)),
      attrs: c,
    }));
}

/**
 * Whether a rule applies in the plain case: nothing optional is chosen. A requirement written as
 * `!SOMETHING` holds, a bare `SOMETHING` does not, unless it is one of the ids in `holds`.
 * Commas mean "and", `||` means "or", brackets group, and `!` negates a word or a whole group:
 * `!(A||B)` holds when neither is held.
 */
export function requirementsMet(
  requirements: string,
  holds: ReadonlySet<string> = new Set(),
): boolean {
  return evaluateRequirements(requirements, (word) => holds.has(word));
}

const ABILITY_BY_NAME: Record<string, Ability> = {
  strength: "str",
  dexterity: "dex",
  constitution: "con",
  intelligence: "int",
  wisdom: "wis",
  charisma: "cha",
};

export const abilityFromWord = (word: string): Ability | undefined =>
  ABILITY_BY_NAME[word.toLowerCase()] ?? ABILITIES.find((a) => a === word.toLowerCase());

/** `selectMatches("Fighting Style, Fighter", option)`: does an option fit what a select offers? */
export function selectMatches(expression: string, option: Source): boolean {
  const tags = elementTags(option).map((t) => t.toLowerCase());
  const parts = expression
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return false;
  const has = (alt: string) => alt === option.aid.toLowerCase() || tags.includes(alt);
  return parts.every((part) => {
    // `!TCOE Base` asks for options that do not carry the tag.
    if (part.startsWith("!")) return !has(part.slice(1).trim().toLowerCase());
    return part
      .split(/\|\|?/)
      .map((alt) => alt.trim().toLowerCase())
      .some(has);
  });
}

/** The words after the last underscore-separated prefix: `ID_LANGUAGE_COMMON` gives `common`. */
const tail = (id: string, prefix: string): string =>
  slugify(id.replace(prefix, "").replace(/_/g, " "));

/** The proficiency (`category`, `target`) an Aurora proficiency id stands for, if the app knows it. */
export function proficiencyOf(
  ctx: Context,
  aid: string,
): { category: "skill" | "save" | "weapon" | "armor" | "tool"; target: string } | undefined {
  const has = (slug: string) => ctx.options.index.has(`srd51:proficiency/${slug}`);

  let m = aid.match(/^ID_PROFICIENCY_SKILL_(.+)$/);
  if (m?.[1]) return { category: "skill", target: slugify(m[1].replace(/_/g, " ")) };

  m =
    aid.match(/^ID_PROFICIENCY_SAVINGTHROW_(.+)$/) ??
    aid.match(/^ID_PROFICIENCY_SAVING_THROW_(.+)$/);
  if (m?.[1]) {
    const ability = abilityFromWord(m[1]);
    return ability ? { category: "save", target: ability } : undefined;
  }

  m = aid.match(/^ID_PROFICIENCY_ARMOR_PROFICIENCY_(.+)$/);
  if (m?.[1]) {
    const x = slugify(m[1].replace(/_/g, " "));
    const target = [x, `${x}-armor`, x.replace(/-armor$/, ""), x.replace(/s$/, ""), `${x}s`].find(
      has,
    );
    return target ? { category: "armor", target } : undefined;
  }

  m = aid.match(/^ID_PROFICIENCY_WEAPON_PROFICIENCY_(.+)$/);
  if (m?.[1]) {
    const x = slugify(m[1].replace(/_/g, " "));
    // Aurora writes `CROSSBOW_HAND`, the app has `hand-crossbows`; and `crossbows-light`.
    const words = x.split("-");
    const target = [
      x,
      `${x}s`,
      `${x}-weapons`,
      x.replace(/-weapon$/, "s"),
      `${[...words].reverse().join("-")}s`,
      [`${words[0]}s`, ...words.slice(1)].join("-"),
    ].find(has);
    return target ? { category: "weapon", target } : undefined;
  }

  m =
    aid.match(/^ID_PROFICIENCY_TOOL_PROFICIENCY_(.+)$/) ??
    aid.match(/^ID_PROFICIENCY_(?:ARTISAN|GAMING|INSTRUMENT)[A-Z_]*?_(.+)$/);
  if (m?.[1]) {
    const x = slugify(m[1].replace(/_/g, " "));
    const target = [x, `${x}-tools`, `${x}s-tools`, `${x}-supplies`].find(has) ?? x;
    return { category: "tool", target };
  }
  return undefined;
}

/** The ids of every language the app or the pack offers, as proficiency slugs. */
function allLanguages(ctx: Context): string[] {
  const slugs = new Set<string>();
  for (const id of ctx.options.index.keys()) {
    const m = id.match(/^srd\d+:language\/(.+)$/);
    if (m?.[1]) slugs.add(m[1]);
  }
  for (const source of ofType(ctx, "Language")) {
    if (source.id && !source.existing) slugs.add(slugify(source.name));
  }
  return [...slugs];
}

/** The tools a select can ask for by group, as the app names them. */
const TOOL_GROUPS: Record<string, string[]> = {
  "artisan tools": [
    "alchemists-supplies",
    "brewers-supplies",
    "calligraphers-supplies",
    "carpenters-tools",
    "cartographers-tools",
    "cobblers-tools",
    "cooks-utensils",
    "glassblowers-tools",
    "jewelers-tools",
    "leatherworkers-tools",
    "masons-tools",
    "painters-supplies",
    "potters-tools",
    "smiths-tools",
    "tinkers-tools",
    "weavers-tools",
    "woodcarvers-tools",
  ],
  "musical instrument": [
    "bagpipes",
    "drum",
    "dulcimer",
    "flute",
    "lute",
    "lyre",
    "horn",
    "pan-flute",
    "shawm",
    "viol",
  ],
  "gaming set": ["dice-set", "playing-card-set"],
};
TOOL_GROUPS.tool = [
  ...(TOOL_GROUPS["artisan tools"] ?? []),
  ...(TOOL_GROUPS["gaming set"] ?? []),
  ...(TOOL_GROUPS["musical instrument"] ?? []),
  "disguise-kit",
  "forgery-kit",
  "herbalism-kit",
  "navigators-tools",
  "poisoners-kit",
  "thieves-tools",
];

/** "Artisan tools", "Skill||Tool"...: the options when every word names a group of skills or tools. */
/**
 * The proficiencies a select offers by the tags they carry (`Simple||Tool`, `Weapon,Martial`):
 * the Proficiency elements whose tags match, as far as the app has what they name.
 */
function taggedProficiencies(ctx: Context, supports: string): string[] {
  return [
    ...new Set(
      ofType(ctx, "Proficiency")
        .filter((s) => selectMatches(supports, s))
        .flatMap((s) => {
          const p = proficiencyOf(ctx, s.aid);
          return p ? [`${p.category}:${p.target}`] : [];
        }),
    ),
  ];
}

function groupedProficiencies(supports: string): string[] | undefined {
  const words = supports.split("||").map((w) => w.trim().toLowerCase());
  if (words.length === 0 || words.some((w) => w !== "skill" && !TOOL_GROUPS[w])) return undefined;
  return [
    ...new Set(
      words.flatMap((w) =>
        w === "skill"
          ? ALL_SKILLS.map((s) => `skill:${s}`)
          : (TOOL_GROUPS[w] ?? []).map((t) => `tool:${t}`),
      ),
    ),
  ];
}

const ALL_SKILLS = [
  "acrobatics",
  "animal-handling",
  "arcana",
  "athletics",
  "deception",
  "history",
  "insight",
  "intimidation",
  "investigation",
  "medicine",
  "nature",
  "perception",
  "performance",
  "persuasion",
  "religion",
  "sleight-of-hand",
  "stealth",
  "survival",
];

export const SCHOOLS = new Set([
  "abjuration",
  "conjuration",
  "divination",
  "enchantment",
  "evocation",
  "illusion",
  "necromancy",
  "transmutation",
]);

interface SpellFacts {
  id: string;
  level: number;
  school: string;
  ritual: boolean;
  classes: Set<string>;
}

const factsCache = new WeakMap<Context, SpellFacts[]>();

/** Every spell the app has and every spell this pack creates, with what a select can ask about. */
function allSpells(ctx: Context): SpellFacts[] {
  const cached = factsCache.get(ctx);
  if (cached) return cached;
  const found: SpellFacts[] = [];
  for (const entry of ctx.options.index.values()) {
    if (entry.kind !== "spell") continue;
    found.push({
      id: entry.id,
      level: Number(entry.data.level ?? 0),
      school: String(entry.data.school ?? ""),
      ritual: entry.data.ritual === true,
      classes: new Set((entry.data.classes as string[] | undefined) ?? []),
    });
  }
  for (const source of ofType(ctx, "Spell")) {
    if (!source.id || source.existing) continue;
    const set = setters(source.el);
    found.push({
      id: source.id,
      level: number(set.get("level")?.text ?? "") ?? 0,
      school: slugify(set.get("school")?.text ?? ""),
      ritual: set.get("isRitual")?.text === "true",
      classes: new Set(
        supportsOf(source.el)
          .map((name) => classIdByName(ctx, name))
          .filter((id): id is string => Boolean(id)),
      ),
    });
  }
  factsCache.set(ctx, found);
  return found;
}

/** Splits at commas that are not inside brackets. */
function splitTop(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (depth === 0 && text.startsWith(separator, i)) {
      parts.push(text.slice(from, i));
      from = i + separator.length;
      i += separator.length - 1;
    }
  }
  parts.push(text.slice(from));
  return parts.map((p) => p.trim()).filter(Boolean);
}

const unwrap = (text: string) => {
  let t = text.trim();
  while (t.startsWith("(") && t.endsWith(")") && splitTop(t.slice(1, -1), "||").length >= 1) {
    const inner = t.slice(1, -1);
    // Only strip brackets that wrap the whole text.
    let depth = 0;
    let whole = true;
    for (let i = 0; i < inner.length; i++) {
      if (inner[i] === "(") depth++;
      else if (inner[i] === ")" && --depth < 0) whole = false;
    }
    if (!whole) break;
    t = inner.trim();
  }
  return t;
};

/**
 * The spells a select offers, from its `supports`: spell levels, classes, schools and "Ritual"
 * joined by commas (all must hold) with `||` between alternatives, or a plain list of spells.
 * Returns undefined for what cannot be worked out here (slot levels that depend on the class).
 */
function spellChoices(ctx: Context, supports: string, className: string): string[] | undefined {
  const text = supports.replace(/\$\(spellcasting:list\)/g, className).trim();
  if (!text || text.includes("$(")) return undefined;
  if (/^ID_[A-Z0-9_]+(\s*[|,]\s*ID_[A-Z0-9_]+)*$/.test(text)) {
    const ids = text
      .split(/\s*[|,]\s*/)
      .map((aid) => ctx.byAid.get(aid)?.id)
      .filter((id): id is string => Boolean(id));
    return ids.length > 0 ? ids : undefined;
  }
  const tests: ((s: SpellFacts) => boolean)[] = [];
  for (const part of splitTop(text, ",")) {
    const alternatives: ((s: SpellFacts) => boolean)[] = [];
    for (const raw of splitTop(unwrap(part), "||")) {
      const token = unwrap(raw);
      const lower = token.toLowerCase();
      const classId = classIdByName(ctx, token);
      if (/^\d+$/.test(token)) alternatives.push((s) => s.level === Number(token));
      else if (lower === "ritual") alternatives.push((s) => s.ritual);
      else if (SCHOOLS.has(lower)) alternatives.push((s) => s.school === lower);
      else if (classId) alternatives.push((s) => s.classes.has(classId));
      else return undefined;
    }
    if (alternatives.length === 0) return undefined;
    tests.push((s) => alternatives.some((test) => test(s)));
  }
  const found = allSpells(ctx)
    .filter((s) => tests.every((test) => test(s)))
    .map((s) => s.id);
  return found.length > 0 ? found : undefined;
}

/**
 * The stats of a magic item that the sheet can apply: armor class, saving throws, initiative,
 * speed and an ability score that is raised to a value. Returns false for the rest.
 */
function itemStat(name: string, value: number, mapped: MappedRules, saves: Map<string, number>) {
  const key = name.toLowerCase();
  const modifier = (
    target: "ac" | "initiative" | "speed",
    when?: "wearingArmor" | "wearingShield",
  ) => mapped.effects.push({ type: "modifier", target, value, ...(when && { when }) });
  if (key === "ac:misc") modifier("ac");
  else if (key === "ac:armored:enhancement") modifier("ac", "wearingArmor");
  else if (key === "ac:shield") modifier("ac", "wearingShield");
  else if (key === "initiative") modifier("initiative");
  else if (key === "speed:misc") modifier("speed");
  else {
    const save = key.match(/^([a-z]+):save:misc$/);
    const floor = key.match(/^([a-z]+):score:set$/);
    const saveAbility = save?.[1] ? abilityFromWord(save[1]) : undefined;
    const floorAbility = floor?.[1] ? abilityFromWord(floor[1]) : undefined;
    if (saveAbility) saves.set(saveAbility, value);
    else if (floorAbility)
      mapped.effects.push({ type: "abilityFloor", ability: floorAbility, value });
    else return false;
  }
  return true;
}

/**
 * Features that make a weapon use another ability. Aurora does not say it in a way a program can
 * read, so these few are listed by id; others are reported by users.
 */
const WEAPON_ABILITIES: Record<string, Effect> = {
  ID_WOTC_XGTE_ARCHETYPE_FEATURE_HEXBLADE_HEX_WARRIOR: {
    type: "weaponAbility",
    ability: "cha",
    when: "oneHanded",
    proficient: true,
  },
  ID_WOTC_ERLW_ARCHETYPE_FEATURE_BATTLE_SMITH_BATTLE_READY: {
    type: "weaponAbility",
    ability: "int",
    when: "magic",
  },
};

/** The last words of a stat that is a number (or text) a feature shows: `breath weapon:dc`. */
const FEATURE_VALUE_NAME =
  /(?::|^.+ )(?:dc|usages?|hp|temp hp|temporary hp|damage|damage type|range|distance|value|amount|creatures|creature-count|count|dice count|dice|num die|lift|plane|cantrip|objects|charges|attack)$/;

/** Names whose value is a word (a damage type, a plane), not a number. */
const TEXT_VALUE_NAME = /(?:damage type|plane|cantrip)$/;

/**
 * What a stat that a feature shows is made of: a number, the proficiency bonus, the level (in a
 * class), the modifier or score of an ability, or text for a damage type. Nothing for a stat
 * that the sheet works out by itself or that depends on more than that.
 */
export function featureValueOf(rule: Rule): FeatureTerm | undefined {
  const name = rule.name.toLowerCase();
  if (rule.tag !== "stat" || !FEATURE_VALUE_NAME.test(name) || name.startsWith("spellcasting:"))
    return undefined;
  // A value that depends on what is worn or on a variant of an item is not one number.
  if (rule.attrs.hasAttribute("equipped") || rule.attrs.hasAttribute("alt")) return undefined;
  const value = rule.value.trim();
  return (
    termOfWord(value) ??
    (TEXT_VALUE_NAME.test(name) && /^[A-Za-z ]+$/.test(value) ? { text: value } : undefined)
  );
}

/** A number, the proficiency bonus, a level, or the modifier or score of an ability. */
function termOfWord(value: string): FeatureTerm | undefined {
  if (/^-?\d+$/.test(value)) return Number(value);
  const word = value.toLowerCase();
  if (word === "proficiency") return { of: "proficiency" };
  if (word === "level") return { of: "level" };
  const level = word.match(/^level:([a-z ]+)$/);
  if (level?.[1]) return { classLevel: slugify(level[1]) };
  const ability = word.match(/^([a-z]+):(modifier|score)$/);
  const which = abilityFromWord(ability?.[1] ?? "");
  if (ability && which) return ability[2] === "score" ? { score: which } : { mod: which };
  return undefined;
}

/** What the `usage` of a sheet says: how many times (a number or a stat's name) and the rest ("day" is a long rest). */
const USAGE_TEXT =
  /^(\d+|\{\{\s*([^{}]+?)\s*\}\})\s*\/\s*(long rest|short rest|long or short rest|short or long rest|day)\.?$/i;

/**
 * The limited uses a feature says it has between rests: `1/Long Rest`, or a count that a stat of
 * the element gives (`{{divine sense:count}}/Long Rest`: 1 plus the Charisma modifier). The name of
 * a shared pool (`Ki`), a kind of action or a use per turn is not a count of the feature and gives
 * nothing, and neither does a count that changes with the level (the stats add up there, and the
 * sheet cannot tell a step from a total): the person sets those in the sheet.
 */
export function usesOf(el: Element): Effect[] {
  const sheet = el.querySelector(":scope > sheet");
  const text = [sheet, ...(sheet?.querySelectorAll("[usage]") ?? [])]
    .map((node) => node?.getAttribute("usage"))
    .find(Boolean);
  const found = text?.trim().match(USAGE_TEXT);
  if (!found) return [];
  // "Long or short rest" comes back on the short one.
  const rest = /short|\bor\b/i.test(found[3] ?? "") ? "short" : "long";
  const effect = (term: FeatureTerm): Effect => ({ type: "uses", term, recharge: rest });
  if (found[2] === undefined) return [effect(Number(found[1]))];
  const name = found[2].toLowerCase();
  const stats = readRules(el).filter((r) => r.tag === "stat" && r.name.toLowerCase() === name);
  if (stats.length > 0) {
    if (stats.some((r) => r.level !== undefined || r.attrs.hasAttribute("alt"))) return [];
    const terms = stats.map((r) => termOfWord(r.value.trim()));
    return terms.every((t) => t !== undefined) ? terms.map((t) => effect(t as FeatureTerm)) : [];
  }
  // `{{proficiency}}` and `{{wisdom:modifier}}` name the value itself.
  const term = termOfWord(name);
  return term === undefined ? [] : [effect(term)];
}

/** The pools of the class that Aurora names in a `usage`, as the kind of resource the app has for them. */
const SPEND_POOL_NAMES: Record<string, SpendPool> = {
  ki: "ki",
  "channel divinity": "channelDivinity",
  "sorcery point": "sorceryPoints",
  "sorcery points": "sorceryPoints",
  "wild shape": "wildShape",
  "bardic inspiration": "bardicInspiration",
};

/**
 * The pool a feature takes points from, when its `usage` is the name of one the class has
 * (`<sheet usage="Ki">`): the feature then spends from that counter. Aurora does not say how many,
 * and the text is not read for it, so it takes one; the person can change that. A pool the app does
 * not have (Superiority Die, Channel Arcana) gives nothing.
 */
export function spendsOf(el: Element): Effect[] {
  const sheet = el.querySelector(":scope > sheet");
  const text = [sheet, ...(sheet?.querySelectorAll("[usage]") ?? [])]
    .map((node) => node?.getAttribute("usage"))
    .find(Boolean);
  const pool = text ? SPEND_POOL_NAMES[text.trim().toLowerCase()] : undefined;
  return pool ? [{ type: "spends", pool }] : [];
}

export interface MappedRules {
  effects: Effect[];
  /** Granted elements, with the class level they come at (undefined: right away). */
  grants: { source: Source; level: number | undefined; requires?: string }[];
  /** Selects that offer elements (features, traits, archetypes), with the options they offer. */
  offers: { rule: Rule; options: Source[] }[];
  speed?: number | undefined;
  size?: string | undefined;
  /** Rules that were read but that the app cannot apply. */
  unsupported: number;
}

interface MapOptions {
  /** Ids that count as held when checking requirements (e.g. the class is the starting one). */
  holds?: ReadonlySet<string>;
  /** Skip the rules that depend on a level: the class importer reads those itself. */
  skipLevelled?: boolean;
  /** The class being described, so `$(spellcasting:list)` knows which list to use. */
  classSlug?: string;
  /** The element is a magic item: its stats (armor class, saves...) are read as bonuses. */
  item?: boolean;
  /**
   * Keep the rules whose requirement is not met right now, wrapped in a `when` that the sheet
   * checks each time (a rule that says "unless you have a sub-race"), and set the flags that
   * `Grants` rules name. Without it a rule whose requirement fails is left out.
   */
  live?: boolean;
  idPrefix: string;
}

/**
 * How an Aurora id is known to a `when`: an element is held by the id it has here, anything
 * else (a flag only some `Grants` rule sets) by its own name.
 */
export const heldName = (ctx: Context, aid: string): string => ctx.byAid.get(aid)?.id ?? aid;

/** A requirement with its words renamed to what the app holds. */
export function translateRequirement(ctx: Context, requirements: string): string {
  return requirements.replace(/[A-Za-z][A-Za-z0-9_]*/g, (word) =>
    word.startsWith("ID_") ? heldName(ctx, word) : word,
  );
}

const spellSlugs = new WeakMap<Context, Map<string, string>>();

/**
 * The id of the spell an Aurora id names: the one imported, or, when its files are not among the
 * ones being imported (the spells are in Core and the race in Supplements), the spell of the app
 * with that name (`ID_PHB_SPELL_DISGUISE_SELF` is `disguise-self`), the ones of the app first.
 */
/** The level of a spell that a rule grants, from its element or from the spell the app has. */
function spellLevelOf(ctx: Context, aid: string, id: string): number | undefined {
  const el = ctx.byAid.get(aid)?.el;
  const written = el ? Number.parseInt(setters(el).get("level")?.text ?? "", 10) : Number.NaN;
  if (Number.isFinite(written)) return written;
  const known = ctx.options.index.get(id)?.data.level;
  return typeof known === "number" ? known : undefined;
}

/** The level a select of spells asks for: `1,(Divination||Enchantment)` is of the 1st level. */
function selectLevel(supports: string): number | undefined {
  const level = supports.match(/^\s*(\d+)\s*,/);
  return level?.[1] ? Number(level[1]) : undefined;
}

/** Feats and species traits that give a spell say it can be cast once between rests without a slot. */
const FREE_CAST_OWNERS = new Set(["Feat", "Feat Feature", "Racial Trait"]);

/**
 * Whether a spell that a feat or a species trait gives is cast once between rests without a slot:
 * a spell of the 1st level or higher, not one that is only prepared and not one that can only be
 * cast as a ritual. Aurora says it in words only, so this is a reading of what such grants are,
 * and the person can change the uses in the sheet.
 */
function freeCast(source: Source, rule: Rule, level: number | undefined): boolean {
  return (
    FREE_CAST_OWNERS.has(source.type) &&
    !rule.attrs.hasAttribute("prepared") &&
    !/ritual/i.test(rule.supports) &&
    level !== undefined &&
    level >= 1
  );
}

export function spellIdOf(ctx: Context, aid: string): string | undefined {
  const known = ctx.byAid.get(aid)?.id;
  if (known) return known;
  const slug = aid
    .replace(/^ID_.*?_SPELL_/, "")
    .toLowerCase()
    .replace(/_/g, "-");
  if (slug === aid.toLowerCase() || !slug) return undefined;
  let bySlug = spellSlugs.get(ctx);
  if (!bySlug) {
    bySlug = new Map();
    for (const entry of ctx.options.index.values()) {
      if (entry.kind !== "spell") continue;
      const name = entry.id.split("/")[1] ?? "";
      if (!bySlug.has(name) || entry.id.startsWith("srd")) bySlug.set(name, entry.id);
    }
    spellSlugs.set(ctx, bySlug);
  }
  return bySlug.get(slug);
}

/**
 * The tally of one kind of rule: `stat/<name>` for a stat, `grant/<type>` or `select/<type>`
 * otherwise, and the same with `[2024] ` before it for the books of 2024, which the app does not
 * follow yet, so that they do not count among what is left to do.
 */
function ruleKindOf(ctx: Context, source: Source, rule: Rule): RuleKind {
  const name = rule.tag === "stat" ? `stat/${rule.name}` : `${rule.tag}/${rule.type}`;
  const key = is2024(source) ? `[2024] ${name}` : name;
  let kind = ctx.result.ruleKinds[key];
  if (!kind) {
    kind = { applied: 0, silent: 0, unsupported: 0, unmet: 0, examples: [], details: {} };
    ctx.result.ruleKinds[key] = kind;
  }
  return kind;
}

/** Turns an element's rules into the app's effects, and lists what it grants or offers. */
export function mapRules(ctx: Context, source: Source, options: MapOptions): MappedRules {
  const mapped: MappedRules = { effects: [], grants: [], offers: [], unsupported: 0 };
  let choiceCount = 0;
  const saves = new Map<string, number>();
  // Bonuses to skills, by skill: all of them at the same value make one bonus to every skill.
  const skillBonuses = new Map<string, number>();
  const nextChoiceId = () => `${options.idPrefix}-${++choiceCount}`;
  // The parts of a way of working out armor class that an element describes (a lizardfolk's scales:
  // a base of 13 plus Dexterity), put together when the element says to use it.
  const armorParts = new Map<string, { base?: number; add: Ability[] }>();

  /**
   * The names of the formulas that the element says to use (`ac:calculation` with the name as its
   * value): the rules of that name are the parts of the formula, whether they say `base` and
   * `ability` or not, and whether the name starts with `ac:` or not.
   */
  const formulas = new Set(
    readRules(source.el)
      .filter((r) => r.tag === "stat" && r.name.toLowerCase() === "ac:calculation")
      .map((r) => r.value.toLowerCase().replace(/^ac:/, "")),
  );

  /** A rule of `ac:...` or of a formula: the base or the ability of it, or the order to use it. */
  const armorStat = (rule: Rule): boolean => {
    const name = rule.name.toLowerCase();
    const label = name.replace(/^ac:/, "");
    if (!name.startsWith("ac:") && !formulas.has(label)) return false;
    const bonus = rule.attrs.getAttribute("bonus");
    const named = formulas.has(label);
    if (label === "calculation") {
      const part = armorParts.get(rule.value.toLowerCase().replace(/^ac:/, ""));
      if (!part || part.base === undefined) return false;
      const equipped = rule.attrs.getAttribute("equipped") ?? "";
      // The sheet adds Dexterity by itself, so it is left out of the list; a formula without it
      // (a tortle's 17) says so.
      mapped.effects.push({
        type: "unarmoredDefense",
        base: part.base,
        add: part.add.filter((a) => a !== "dex"),
        shield: !/\[shield:none\]/.test(equipped),
        ...(!part.add.includes("dex") && { noDex: true }),
      });
      return true;
    }
    const part = armorParts.get(label) ?? { add: [] };
    armorParts.set(label, part);
    const base = Number(rule.value);
    if ((bonus === "base" || (named && bonus === null)) && Number.isFinite(base)) {
      part.base = base;
      return true;
    }
    const ability =
      bonus === "ability" || (named && bonus === null)
        ? abilityFromWord(rule.value.split(":")[0] ?? "")
        : undefined;
    if (ability && /:modifier$/i.test(rule.value)) {
      part.add.push(ability);
      return true;
    }
    return false;
  };

  /** What `equipped` asks for, if the sheet can check it: nothing, or no heavy armor. */
  const equippedWhen = (rule: Rule): { when?: ModifierCondition } | undefined => {
    const equipped = (rule.attrs.getAttribute("equipped") ?? "").replace(/\s/g, "");
    if (equipped === "") return {};
    const when: Record<string, ModifierCondition> = {
      "![armor:heavy]": "noHeavyArmor",
      "[armor:none]": "unarmored",
      "[armor:none],[shield:none]": "unarmoredNoShield",
    };
    const found = when[equipped];
    return found ? { when: found } : undefined;
  };

  /** `persuasion:misc` with a number, and nothing that depends on how it is worn. */
  const skillStat = (rule: Rule): boolean => {
    const m = rule.name.toLowerCase().match(/^([a-z ]+):misc$/);
    const slug = m?.[1] ? slugify(m[1]) : "";
    const value = Number(rule.value);
    if (!ALL_SKILLS.includes(slug) || !Number.isFinite(value)) return false;
    if (rule.attrs.hasAttribute("equipped") || rule.attrs.hasAttribute("alt")) return false;
    skillBonuses.set(slug, (skillBonuses.get(slug) ?? 0) + value);
    return true;
  };

  const BONUS_TARGETS: Record<string, ModifierTarget> = {
    initiative: "initiative",
    "ac:misc": "ac",
    hp: "hp",
    "spellcasting:attack": "spellAttack",
    "spellcasting:dc": "spellDc",
  };

  /**
   * A bonus to initiative, armor class, hit points or the spell attack and save DC: a number, the
   * proficiency bonus or the modifier of an ability (`charisma:modifier`), and for hit points
   * `level` (one for each level). A variant of an item (`alt`) is left out: its siblings would add up.
   */
  const bonusStat = (rule: Rule): boolean => {
    const target = BONUS_TARGETS[rule.name.toLowerCase()];
    const needs = equippedWhen(rule);
    if (!target || !needs || rule.attrs.hasAttribute("alt")) return false;
    const value = rule.value.trim().toLowerCase();
    if (target === "hp" && /^level(:[a-z ]+)?$/.test(value)) {
      mapped.effects.push({ type: "modifier", target: "hpPerLevel", value: 1, ...needs });
      return true;
    }
    const number = Number(value);
    const ability = value.endsWith(":modifier")
      ? abilityFromWord(value.split(":")[0] ?? "")
      : undefined;
    const plus = value === "proficiency" ? "proficiency" : ability;
    if (!Number.isFinite(number) && !plus) return false;
    mapped.effects.push({
      type: "modifier",
      target,
      value: plus ? 0 : number,
      ...(plus && { plus }),
      ...needs,
    });
    return true;
  };

  /** A bonus to the speed (`innate speed:misc`) by a plain number, with what it needs. */
  const speedBonusOf = (rule: Rule) => {
    const value = Number(rule.value);
    const needs = equippedWhen(rule);
    if (!/^(?:innate )?speed:misc$/i.test(rule.name) || !Number.isFinite(value) || !needs)
      return undefined;
    return { value, ...needs };
  };

  /**
   * A speed of climbing, swimming, flying or burrowing, or a sense with a range. The bonuses to
   * these speeds (`innate speed:climb:misc`) say what a bonus to the speed already does to all of
   * them, so they count as read when the same element gives that bonus to the speed.
   */
  const movementStat = (rule: Rule): boolean => {
    const name = rule.name.toLowerCase();
    const sense = name.match(/^(darkvision|blindsight|tremorsense|truesight):range$/);
    const mode = name.match(/^(?:innate )?speed:(climb|swim|fly|burrow)(:misc)?$/);
    const needs = equippedWhen(rule);
    if (!needs) return false;
    const number = Number(rule.value);
    const bonus = rule.attrs.getAttribute("bonus");
    if (sense?.[1]) {
      if (!Number.isFinite(number) || (bonus !== null && bonus !== "base" && bonus !== ""))
        return false;
      if (number > 0)
        mapped.effects.push({
          type: "sense",
          sense: sense[1] as Sense,
          range: number,
          ...needs,
        });
      return true;
    }
    if (!mode?.[1]) return false;
    if (mode[2]) {
      const siblings = readRules(source.el).map(speedBonusOf);
      const mine = speedBonusOf({ ...rule, name: "speed:misc" });
      return Boolean(mine && siblings.some((s) => s?.value === mine.value && s.when === mine.when));
    }
    if (bonus !== null && bonus !== "base" && bonus !== "") return false;
    const equalsWalk = /^(?:innate )?speed$/i.test(rule.value.trim());
    if (!equalsWalk && !Number.isFinite(number)) return false;
    if (equalsWalk || number > 0)
      mapped.effects.push({
        type: "movement",
        mode: mode[1] as MovementMode,
        feet: equalsWalk ? "walk" : number,
        ...needs,
      });
    return true;
  };

  const mapRule = (rule: Rule): void => {
    if (rule.tag === "stat") {
      const ability = abilityFromWord(rule.name);
      const value = Number.parseInt(rule.value, 10);
      if (options.item && Number.isFinite(value) && itemStat(rule.name, value, mapped, saves))
        return;
      if (ability && Number.isFinite(value) && !rule.attrs.hasAttribute("level")) {
        mapped.effects.push({ type: "abilityBonus", ability, value });
      } else if (rule.name === "innate speed" && Number.isFinite(value)) {
        mapped.speed = value;
      } else if (armorStat(rule)) {
        // Armor class from natural armor: told to the effect that works it out.
      } else if (/^attunement:max$/i.test(rule.name) && Number.isInteger(value) && value > 3) {
        mapped.effects.push({ type: "attunementMax", value });
      } else if (skillStat(rule)) {
        // A bonus to a skill: put together when the rules are all read.
      } else if (bonusStat(rule)) {
        // A bonus to a number of the sheet: pushed as a modifier.
      } else if (movementStat(rule)) {
        // Another speed or a sense: pushed as an effect.
      } else if (/^innate speed:misc$/i.test(rule.name) && speedBonusOf(rule)) {
        const bonus = speedBonusOf(rule);
        if (bonus)
          mapped.effects.push({
            type: "modifier",
            target: "speed",
            value: bonus.value,
            ...(bonus.when && { when: bonus.when }),
          });
      } else if (featureValueOf(rule) !== undefined) {
        const term = featureValueOf(rule);
        if (term !== undefined)
          mapped.effects.push({
            type: "featureValue",
            name: rule.name.toLowerCase(),
            term,
            ...(rule.level !== undefined && { minLevel: rule.level }),
            ...(rule.attrs.getAttribute("bonus") && {
              bonus: rule.attrs.getAttribute("bonus") as string,
            }),
          });
        // An Extra Attack is also a rule of the sheet: the Attack action makes that many attacks (the most counts).
        if (
          rule.name.toLowerCase() === "extra attack:count" &&
          typeof term === "number" &&
          term >= 2
        )
          mapped.effects.push({
            type: "extraAttack",
            attacks: term,
            ...(rule.level !== undefined && { minLevel: rule.level }),
          });
      } else {
        mapped.unsupported += 1;
      }
      return;
    }

    if (rule.tag === "grant") {
      if (rule.type === "Proficiency") {
        const p = proficiencyOf(ctx, rule.id);
        const expertise = rule.id.match(/^ID_INTERNAL_PROFICIENCY_SKILL_EXPERTISE_(.+)$/);
        if (p) mapped.effects.push({ type: "proficiency", ...p });
        else if (expertise?.[1])
          mapped.effects.push({
            type: "expertise",
            skill: slugify(expertise[1].replace(/_/g, " ")),
          });
        else mapped.unsupported += 1;
      } else if (rule.type === "Language") {
        const slug = tail(rule.id, "ID_LANGUAGE_");
        if (slug) mapped.effects.push({ type: "proficiency", category: "language", target: slug });
      } else if (rule.type === "Size") {
        mapped.size = tail(rule.id, "ID_SIZE_");
      } else if (rule.type === "Vision") {
        const trait = `srd51:trait/${tail(rule.id, "ID_VISION_")}`;
        // A vision the rules of the app do not have (lesser darkvision, blindsight) is a sense
        // with a range, which the `...:range` stat of the same element gives.
        const sense = tail(rule.id, "ID_VISION_")?.replace(/^(?:lesser|superior)-?/, "");
        const ranged = readRules(source.el).some(
          (r) => r.tag === "stat" && r.name.toLowerCase() === `${sense}:range`,
        );
        if (ctx.options.index.has(trait)) mapped.effects.push({ type: "trait", id: trait });
        else if (!ranged) mapped.unsupported += 1;
      } else if (rule.type === "Spell") {
        const spell = spellIdOf(ctx, rule.id);
        // A spell that comes at a level (the legacy of a tiefling) counts from that level.
        if (spell)
          mapped.effects.push({
            type: "grantSpell",
            spell,
            ...(rule.level !== undefined && { minLevel: rule.level }),
            ...(freeCast(source, rule, spellLevelOf(ctx, rule.id, spell)) && { free: true }),
          });
        else mapped.unsupported += 1;
      } else if (rule.type === "Dragonmark") {
        // A mark sets the flags that its own rules name, which the race tests for.
        const mark = ctx.byAid.get(rule.id);
        if (mark && options.live)
          for (const flag of readRules(mark.el))
            if (flag.tag === "grant" && flag.type === "Grants")
              mapped.effects.push({ type: "flag", id: heldName(ctx, flag.id) });
      } else if (rule.type === "Condition") {
        const m = rule.id.match(
          /^ID_INTERNAL_CONDITION_DAMAGE_(RESISTANCE|IMMUNITY|VULNERABILITY|VULNERAILITY)_([A-Z_]+)$/,
        );
        if (m?.[1] && m[2])
          mapped.effects.push({
            type: "defense",
            kind:
              m[1] === "RESISTANCE"
                ? "resistance"
                : m[1] === "IMMUNITY"
                  ? "immunity"
                  : "vulnerability",
            damage: slugify(m[2].replace(/_/g, " ")),
          });
        else mapped.unsupported += 1;
      } else if (rule.type === "Feat") {
        // A feat that comes with the race, background or class.
        const feat = ctx.byAid.get(rule.id)?.id;
        if (feat) mapped.effects.push({ type: "trait", id: feat });
        else mapped.unsupported += 1;
      } else if (FEATURE_TYPES.has(rule.type)) {
        const target = ctx.byAid.get(rule.id);
        if (target) mapped.grants.push({ source: target, level: rule.level });
      } else if (rule.type === "Grants") {
        if (options.live) mapped.effects.push({ type: "flag", id: heldName(ctx, rule.id) });
      } else {
        mapped.unsupported += 1;
      }
      return;
    }

    // select
    if (rule.type === "Language") {
      mapped.effects.push({
        type: "choice",
        id: nextChoiceId(),
        choose: rule.number,
        grants: "language",
        from: allLanguages(ctx),
      });
    } else if (rule.type === "Proficiency") {
      const listed = rule.supports.split(/\s*[,|]+\s*/).filter((t) => t.startsWith("ID_"));
      const from =
        listed.length > 0
          ? listed
              .map((aid) => proficiencyOf(ctx, aid))
              .filter((p): p is NonNullable<typeof p> => Boolean(p))
              .map((p) => `${p.category}:${p.target}`)
          : (groupedProficiencies(rule.supports) ??
            (/skill/i.test(rule.supports)
              ? ALL_SKILLS.map((s) => `skill:${s}`)
              : taggedProficiencies(ctx, rule.supports)));
      if (from.length > 0)
        mapped.effects.push({
          type: "choice",
          id: nextChoiceId(),
          choose: rule.number,
          grants: "proficiency",
          from,
        });
      else mapped.unsupported += 1;
    } else if (rule.type === "Spell") {
      const from =
        spellChoices(ctx, rule.supports, (options.classSlug ?? "").replace(/-/g, " ")) ?? [];
      if (from.length > 0 && rule.level === undefined)
        mapped.effects.push({
          type: "choice",
          id: nextChoiceId(),
          choose: rule.number,
          grants: "spell",
          from,
          ...(freeCast(source, rule, selectLevel(rule.supports)) && { free: true }),
        });
      else if (rule.level === undefined) mapped.unsupported += 1;
    } else if (rule.type === "Feat" && !rule.optional) {
      // "One feat of your choice": every feat, or the ones the select asks for.
      const listed = rule.supports
        ? ofType(ctx, "Feat")
            .filter((s) => s.id && selectMatches(rule.supports, s))
            .map((s) => s.id as string)
        : [];
      if (!rule.supports || listed.length > 0)
        mapped.effects.push({
          type: "choice",
          id: nextChoiceId(),
          choose: rule.number,
          grants: "feat",
          from: listed,
        });
      else mapped.unsupported += 1;
    } else if (
      rule.type === "Ability Score Improvement" &&
      /Custom Ability Score Improvement Option/i.test(rule.supports)
    ) {
      // "+2 and +1, or +1 three times": two entries to choose from, each with its own picks.
      const list = ofType(ctx, rule.type).filter(
        (s) => isAsiOption(s) && selectMatches(rule.supports, s),
      );
      mapped.offers.push({ rule, options: list });
    } else if (rule.type === "Ability Score Improvement") {
      const abilities = [...rule.supports.matchAll(/ASI_([A-Z]+)/g)]
        .map((m) => abilityFromWord(m[1] ?? ""))
        .filter((a): a is Ability => Boolean(a));
      // Tasha's customised origins: "one ability score of your choice increases by 2".
      const custom = rule.supports.match(/Custom Ability Score Increase\s*(\d+)/i);
      if (abilities.length > 0 || custom)
        mapped.effects.push({
          type: "choice",
          id: nextChoiceId(),
          choose: rule.number,
          grants: "abilityBonus",
          from: abilities.length > 0 ? abilities : [...ABILITIES],
          value: custom ? Number(custom[1]) : 1,
        });
      else if (/^(?:Ability Score Improvement\s*,\s*Class|Feat)$/i.test(rule.supports.trim())) {
        // The increase of a class at its levels, or a feat in its place: the app offers them itself.
      } else mapped.unsupported += 1;
    } else if (rule.type === "Background Feature" && rule.optional) {
      // "Variant Feature", `optional="true"`: the person may leave it empty. The optional features it
      // would list are already in the optional rules of the build screen (`data.backgroundFeature`),
      // so a choice here would stay to be made forever and show the same thing twice.
    } else if (
      FEATURE_TYPES.has(rule.type) ||
      rule.type === "Archetype" ||
      rule.type === "Sub Race"
    ) {
      const list = ofType(ctx, rule.type).filter((s) => selectMatches(rule.supports, s));
      mapped.offers.push({ rule, options: list });
    } else if (rule.type === "List") {
      // Personality tables of a background: read by the background importer.
    } else if (!rule.optional) {
      mapped.unsupported += 1;
    }
  };

  const note = (
    rule: Rule,
    outcome: "applied" | "silent" | "unsupported" | "unmet",
    detail = "",
  ) => {
    const kind = ruleKindOf(ctx, source, rule);
    kind[outcome] += 1;
    if (kind.examples.length < 3 && !kind.examples.includes(source.aid))
      kind.examples.push(source.aid);
    if (outcome === "unsupported" && detail) kind.details[detail] = (kind.details[detail] ?? 0) + 1;
  };

  for (const rule of readRules(source.el)) {
    const met = requirementsMet(rule.requirements, options.holds);
    if (!met && !options.live) {
      note(rule, "unmet");
      continue;
    }
    if (options.skipLevelled && rule.level !== undefined && featureValueOf(rule) === undefined)
      continue;
    const gated = options.live && rule.requirements.trim() !== "";
    const effectsFrom = mapped.effects.length;
    const grantsFrom = mapped.grants.length;
    const offersFrom = mapped.offers.length;
    const unsupportedFrom = mapped.unsupported;
    const [speed, size] = [mapped.speed, mapped.size];
    mapRule(rule);
    if (mapped.unsupported > unsupportedFrom)
      note(rule, "unsupported", rule.tag === "select" ? rule.supports : rule.id || rule.value);
    else if (
      mapped.effects.length > effectsFrom ||
      mapped.grants.length > grantsFrom ||
      mapped.offers.length > offersFrom ||
      mapped.speed !== speed ||
      mapped.size !== size
    )
      note(rule, "applied");
    else note(rule, "silent");
    if (!gated) continue;
    if (!met) {
      // Speed and size are plain numbers of the entry: a rule that fails for now does not set them.
      mapped.speed = speed;
      mapped.size = size;
    }
    // The rule holds only while its requirement does, which is checked with the sheet.
    const requires = translateRequirement(ctx, rule.requirements);
    const inner = mapped.effects.splice(effectsFrom);
    const before = mapped.effects[effectsFrom - 1];
    if (inner.length === 0) {
      // nothing to wrap
    } else if (before?.type === "when" && before.requires === requires) {
      before.effects.push(...inner); // one `when` for the rules in a row that ask the same
    } else mapped.effects.push({ type: "when", requires, effects: inner });
    for (const grant of mapped.grants.slice(grantsFrom)) grant.requires = requires;
  }
  // Aurora only describes these in words (or in a stat that feeds the text), so they are known by id.
  const weaponAbility = WEAPON_ABILITIES[source.aid];
  if (weaponAbility) mapped.effects.push(weaponAbility);
  // The same bonus to all six saving throws is one bonus to saving throws.
  const first = [...saves.values()][0];
  if (saves.size === 6 && [...saves.values()].every((v) => v === first) && first !== undefined)
    mapped.effects.push({ type: "modifier", target: "save", value: first });
  else mapped.unsupported += saves.size;
  const firstSkill = [...skillBonuses.values()][0];
  if (
    skillBonuses.size === ALL_SKILLS.length &&
    [...skillBonuses.values()].every((v) => v === firstSkill) &&
    firstSkill !== undefined
  )
    mapped.effects.push({ type: "modifier", target: "skill", value: firstSkill });
  else
    for (const [skill, value] of skillBonuses)
      mapped.effects.push({ type: "modifier", target: "skill", value, skill });
  if (!options.item) mapped.effects.push(...usesOf(source.el), ...spendsOf(source.el));
  ctx.result.unsupportedRules += mapped.unsupported;
  if (mapped.unsupported > 0)
    ctx.result.unsupportedBy[source.aid] =
      (ctx.result.unsupportedBy[source.aid] ?? 0) + mapped.unsupported;
  return mapped;
}

/**
 * Converts the 2024 5e-database JSON (SRD 5.2.1) into content-pack entries plus English strings.
 *
 * This is the PILOT: it converts the plain kinds (abilities, skills, languages, proficiencies), every
 * feat, and the one class / subclass / background / species the pilot character uses (Fighter,
 * Champion, Soldier, Human). Widen `PILOT` to convert more. Effects are written by hand in
 * `effects.ts`, as for the 5.1 build; a feature with no effect there is text only.
 */
import type { Effect, Entry, ProficiencyCategory } from "../../src/data/schema";
import { ACTIVATION, FEATURE_EFFECTS, FEAT_EFFECTS, FEAT_PICKS } from "./effects";

const PACK = "srd52";

// biome-ignore lint/suspicious/noExplicitAny: raw third-party JSON, shaped by the source database
type Raw = any;

export type Strings = Record<string, string>;
export interface Converted {
  entries: Entry[];
  strings: Strings;
}
export interface RawSource {
  abilityScores: Raw[];
  skills: Raw[];
  languages: Raw[];
  proficiencies: Raw[];
  feats: Raw[];
  backgrounds: Raw[];
  species: Raw[];
  traits: Raw[];
  classes: Raw[];
  levels: Raw[];
  features: Raw[];
  subclasses: Raw[];
  weaponMastery: Raw[];
  equipment: Raw[];
  weaponProperties: Raw[];
}

/** What the pilot converts for the kinds that are big; everything of the small kinds is converted. */
export const PILOT = {
  classes: ["fighter"],
  subclasses: ["champion"],
  backgrounds: ["soldier"],
  species: ["human"],
};

const id = (kind: string, slug: string) => `${PACK}:${kind}/${slug}`;
const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** The book's paragraphs use a hard wrap and a two-space indent; keep the paragraphs, drop the indent. */
const text = (value: string | undefined | null): string =>
  (value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();

const PROFICIENCY_TYPES: Record<string, ProficiencyCategory> = {
  Skills: "skill",
  "Saving Throws": "save",
  Armor: "armor",
  Weapons: "weapon",
  "Artisan's Tools": "tool",
  Tools: "tool",
  "Musical Instruments": "tool",
  Other: "tool",
};

/** proficiency index -> `category:target` */
function proficiencyTable(raw: RawSource): Map<string, string> {
  const table = new Map<string, string>();
  for (const p of raw.proficiencies) {
    const category = PROFICIENCY_TYPES[p.type];
    if (!category) throw new Error(`Unknown proficiency type: ${p.type}`);
    const target = category === "skill" || category === "save" ? p.reference.index : p.index;
    table.set(p.index, `${category}:${target}`);
  }
  return table;
}

function proficiencyEffect(table: Map<string, string>, index: string): Effect {
  const resolved = table.get(index);
  if (!resolved) throw new Error(`Unknown proficiency: ${index}`);
  const [category, target] = resolved.split(":") as [ProficiencyCategory, string];
  return { type: "proficiency", category, target };
}

/** A 5e-database choice of proficiencies as a `choice` effect (options are `category:target`). */
function proficiencyChoice(table: Map<string, string>, choiceId: string, set: Raw): Effect {
  const from = (set.from.options as Raw[]).map((o) => {
    const index: string = o.item.index;
    // Skill options of a trait are the skill index itself ("acrobatics"), the others are proficiencies.
    return table.get(index) ?? table.get(`skill-${index}`) ?? `skill:${index}`;
  });
  return { type: "choice", id: choiceId, choose: set.choose, grants: "proficiency", from };
}

function convertAbilities(raw: RawSource): Converted {
  const entries: Entry[] = [];
  const strings: Strings = {};
  for (const a of raw.abilityScores) {
    entries.push({ id: id("ability", a.index), kind: "ability", effects: [], data: {} });
    strings[`${a.index}.name`] = a.full_name;
    strings[`${a.index}.abbreviation`] = a.name;
    strings[`${a.index}.desc`] = text(a.description);
  }
  return { entries, strings };
}

function convertSkills(raw: RawSource): Converted {
  const entries: Entry[] = [];
  const strings: Strings = {};
  for (const s of raw.skills) {
    entries.push({
      id: id("skill", s.index),
      kind: "skill",
      effects: [],
      data: { ability: s.ability_score.index },
    });
    strings[`${s.index}.name`] = s.name;
    strings[`${s.index}.desc`] = text(s.description);
  }
  return { entries, strings };
}

function convertLanguages(raw: RawSource): Converted {
  const entries: Entry[] = [];
  const strings: Strings = {};
  for (const l of raw.languages) {
    entries.push({
      id: id("language", l.index),
      kind: "language",
      effects: [],
      data: { type: l.is_rare ? "exotic" : "standard" },
    });
    strings[`${l.index}.name`] = l.name;
    if (l.note) strings[`${l.index}.note`] = l.note;
  }
  return { entries, strings };
}

function convertProficiencies(raw: RawSource, table: Map<string, string>): Converted {
  const entries: Entry[] = [];
  const strings: Strings = {};
  for (const p of raw.proficiencies) {
    const [category, target] = (table.get(p.index) ?? "").split(":");
    entries.push({
      id: id("proficiency", p.index),
      kind: "proficiency",
      effects: [],
      data: { category, target },
    });
    strings[`${p.index}.name`] = p.name;
  }
  return { entries, strings };
}

/** Feats keep their book category (origin, general, fighting-style, epic-boon) and what they ask for. */
function convertFeats(raw: RawSource, table: Map<string, string>): Converted {
  const entries: Entry[] = [];
  const strings: Strings = {};
  // Skilled: three skills or tools, any combination.
  const skillsAndTools = [...table.values()].filter(
    (v) => v.startsWith("skill:") || v.startsWith("tool:"),
  );
  for (const f of raw.feats) {
    // The way the engine reads what a feat asks for: a list (`level`), as for the 5.1 options.
    const asks: Record<string, unknown>[] = [];
    if (f.prerequisites?.minimum_level)
      asks.push({ type: "level", level: f.prerequisites.minimum_level });
    const effects: Effect[] = [...(FEAT_EFFECTS[f.index] ?? [])];
    if (f.index === "skilled")
      effects.push({
        type: "choice",
        id: "skilled",
        choose: 3,
        grants: "proficiency",
        from: skillsAndTools,
      });
    entries.push({
      id: id("feat", f.index),
      kind: "feat",
      effects,
      data: {
        category: f.type,
        // The feat that is the ability score increase of the level: the build screen has its own steps.
        ...(f.index === "ability-score-improvement" && { builtIn: true }),
        ...(f.prerequisites?.feature_named && { featureNamed: f.prerequisites.feature_named }),
        ...(asks.length ? { prerequisites: asks } : {}),
      },
    });
    strings[`${f.index}.name`] = f.name;
    strings[`${f.index}.desc`] = text(f.description);
  }
  return { entries, strings };
}

const featIdsOf = (raw: RawSource, category: string) =>
  raw.feats.filter((f: Raw) => f.type === category).map((f: Raw) => id("feat", f.index));

/** Species (Human only for now): traits as entries, size and speed as data. No ability scores, no languages. */
function convertSpecies(raw: RawSource, table: Map<string, string>): [Converted, Converted] {
  const species: Converted = { entries: [], strings: {} };
  const traits: Converted = { entries: [], strings: {} };
  for (const s of raw.species.filter((x: Raw) => PILOT.species.includes(x.index))) {
    const effects: Effect[] = [];
    for (const ref of s.traits as Raw[]) {
      const trait = raw.traits.find((t: Raw) => t.index === ref.index);
      if (!trait) throw new Error(`Missing trait: ${ref.index}`);
      effects.push({ type: "trait", id: id("trait", trait.index) });
      const traitEffects: Effect[] = [];
      if (trait.proficiency_choices) {
        traitEffects.push(
          proficiencyChoice(table, `${trait.index}-skill`, trait.proficiency_choices),
        );
      }
      if (trait.index === "versatile") {
        traitEffects.push({
          type: "choice",
          id: "versatile-feat",
          choose: 1,
          grants: "feat",
          from: featIdsOf(raw, "origin"),
        });
      }
      traits.entries.push({
        id: id("trait", trait.index),
        kind: "trait",
        effects: traitEffects,
        data: {},
      });
      traits.strings[`${trait.index}.name`] = trait.name;
      traits.strings[`${trait.index}.desc`] = text(trait.description);
    }
    species.entries.push({
      id: id("species", s.index),
      kind: "species",
      effects,
      data: { speed: s.speed, size: String(s.size).toLowerCase() },
    });
    species.strings[`${s.index}.name`] = s.name;
  }
  return [species, traits];
}

/**
 * Backgrounds carry what the 2024 rules give them: two skill proficiencies (plus a tool), an Origin
 * feat, and an increase of the three abilities they list: +2 to one and +1 to another, or +1 to all
 * three. The feat is a `trait` effect that points at the feat (the engine holds it as given). The
 * increase is a choice between two traits made for the background (`<slug>-ability-2-1` with two
 * ability choices, which cannot take the same ability, and `<slug>-ability-1-1-1` with three fixed
 * bonuses), so it reuses what the engine does for choices.
 */
function convertBackgrounds(
  raw: RawSource,
  table: Map<string, string>,
): { backgrounds: Converted; traits: Converted } {
  const entries: Entry[] = [];
  const strings: Strings = {};
  const traits: Converted = { entries: [], strings: {} };
  for (const b of raw.backgrounds.filter((x: Raw) => PILOT.backgrounds.includes(x.index))) {
    const effects: Effect[] = (b.proficiencies as Raw[]).map((p) =>
      proficiencyEffect(table, p.index),
    );
    (b.proficiency_choices ?? []).forEach((set: Raw, i: number) => {
      effects.push(proficiencyChoice(table, `${b.index}-proficiency-${i + 1}`, set));
    });
    const abilities: string[] = (b.ability_scores as Raw[]).map((a) => a.index);
    const split = `${b.index}-ability-2-1`;
    const spread = `${b.index}-ability-1-1-1`;
    traits.entries.push(
      {
        id: id("trait", split),
        kind: "trait",
        effects: [
          {
            type: "choice",
            id: "plus-2",
            choose: 1,
            grants: "abilityBonus",
            from: abilities,
            value: 2,
          },
          {
            type: "choice",
            id: "plus-1",
            choose: 1,
            grants: "abilityBonus",
            from: abilities,
            value: 1,
          },
        ],
        data: {},
      },
      {
        id: id("trait", spread),
        kind: "trait",
        effects: abilities.map((ability) => ({
          type: "abilityBonus" as const,
          ability: ability as "str",
          value: 1,
        })),
        data: {},
      },
    );
    traits.strings[`${split}.name`] = "+2 to one ability, +1 to another";
    traits.strings[`${spread}.name`] = "+1 to each of the three abilities";
    effects.push(
      { type: "trait", id: id("feat", b.feat.index) },
      {
        type: "choice",
        id: "ability-increase",
        choose: 1,
        grants: "trait",
        from: [id("trait", split), id("trait", spread)],
      },
    );
    entries.push({
      id: id("background", b.index),
      kind: "background",
      effects,
      data: {
        abilityScores: (b.ability_scores as Raw[]).map((a) => a.index),
        feat: id("feat", b.feat.index),
        startingChoices: startingChoices(b.equipment_options),
      },
    });
    strings[`${b.index}.name`] = b.name;
  }
  return { backgrounds: { entries, strings }, traits };
}

/** One feature entry; the effects and the activation are the hand-written ones, by feature slug. */
function featureEntry(slug: string, owner: Raw, level: number): Entry {
  const effects: Effect[] = FEATURE_EFFECTS[slug] ?? [];
  const activation = ACTIVATION[slug];
  return {
    id: id("feature", slug),
    kind: "feature",
    effects,
    data: { ...owner, level, ...(activation ? { activation } : {}) },
  };
}

function convertClasses(
  raw: RawSource,
  table: Map<string, string>,
): { classes: Converted; features: Converted } {
  const classes: Converted = { entries: [], strings: {} };
  const features: Converted = { entries: [], strings: {} };
  for (const c of raw.classes.filter((x: Raw) => PILOT.classes.includes(x.index))) {
    const effects: Effect[] = (c.proficiencies as Raw[]).map((p) =>
      proficiencyEffect(table, p.index),
    );
    (c.proficiency_choices ?? []).forEach((set: Raw, i: number) => {
      effects.push(proficiencyChoice(table, `${c.index}-proficiency-${i + 1}`, set));
    });

    const own = raw.levels.filter((l: Raw) => l.class.index === c.index && !l.subclass);
    const levels = own.map((l: Raw) => {
      const names = (l.features as Raw[]).map((f) => f.name);
      const specific: Record<string, number> = {};
      for (const [key, value] of Object.entries(l.class_specific ?? {})) {
        specific[key.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase())] = value as number;
      }
      return {
        level: l.level,
        features: (l.features as Raw[]).map((f) => id("feature", f.index)),
        // In 2024 the increase is the feat "Ability Score Improvement"; the build screen keeps its steps.
        abilityScoreImprovements: names.includes("Ability Score Improvement") ? 1 : 0,
        classSpecific: specific,
      };
    });

    const seen = new Set<string>();
    for (const l of own) {
      for (const f of l.features as Raw[]) {
        if (seen.has(f.index)) continue;
        seen.add(f.index);
        const feature = raw.features.find((x: Raw) => x.index === f.index);
        if (!feature) throw new Error(`Missing feature: ${f.index}`);
        features.entries.push(featureEntry(f.index, { class: id("class", c.index) }, l.level));
        features.strings[`${f.index}.name`] = feature.name;
        features.strings[`${f.index}.desc`] = text(feature.description);
      }
    }

    const prereq = c.multi_classing.prerequisite_options;
    classes.entries.push({
      id: id("class", c.index),
      kind: "class",
      effects,
      data: {
        hitDie: c.hit_die,
        primaryAbility: (
          (c.primary_ability?.ability_score_options?.from?.options ?? []) as Raw[]
        ).map((o) => o.item.index),
        multiclassing: {
          prerequisites: [],
          prerequisiteOptions: prereq
            ? {
                choose: prereq.choose,
                from: (prereq.from.options as Raw[]).map((o) => ({
                  ability: o.ability_score.index,
                  minimum: o.minimum_score,
                })),
              }
            : undefined,
          proficiencies: (c.multi_classing.proficiencies as Raw[]).map(
            (p) => table.get(p.index) ?? p.index,
          ),
        },
        levels,
        startingChoices: startingChoices(c.starting_equipment_options),
      },
    });
    classes.strings[`${c.index}.name`] = c.name;
  }
  return { classes, features };
}

function convertSubclasses(raw: RawSource): { subclasses: Converted; features: Converted } {
  const subclasses: Converted = { entries: [], strings: {} };
  const features: Converted = { entries: [], strings: {} };
  for (const s of raw.subclasses.filter((x: Raw) => PILOT.subclasses.includes(x.index))) {
    const parent = (raw.classes as Raw[]).find((c) =>
      (c.subclasses as Raw[]).some((x) => x.index === s.index),
    );
    if (!parent) throw new Error(`No class for subclass ${s.index}`);
    const byLevel = new Map<number, string[]>();
    for (const f of s.features as Raw[]) {
      const slug = `${s.index}-${slugify(f.name)}`;
      features.entries.push(featureEntry(slug, { subclass: id("subclass", s.index) }, f.level));
      features.strings[`${slug}.name`] = f.name;
      features.strings[`${slug}.desc`] = text(f.description);
      byLevel.set(f.level, [...(byLevel.get(f.level) ?? []), id("feature", slug)]);
    }
    subclasses.entries.push({
      id: id("subclass", s.index),
      kind: "subclass",
      parent: id("class", parent.index),
      effects: [],
      data: {
        levels: [...byLevel.entries()].map(([level, list]) => ({ level, features: list })),
        spells: [],
        expanded: [],
      },
    });
    subclasses.strings[`${s.index}.name`] = s.name;
  }
  return { subclasses, features };
}

/**
 * Weapon properties (Finesse, Light...) and the eight mastery properties (Cleave, Graze...), both as
 * `property` entries: a mastery's id is `property/mastery-<name>`, so a weapon's `properties` and its
 * `mastery` never share an id.
 */
function convertProperties(raw: RawSource): Converted {
  const entries: Entry[] = [];
  const strings: Strings = {};
  for (const p of raw.weaponProperties) {
    entries.push({ id: id("property", p.index), kind: "property", effects: [], data: {} });
    strings[`${p.index}.name`] = p.name;
    strings[`${p.index}.desc`] = text(p.description);
  }
  for (const m of raw.weaponMastery) {
    const slug = `mastery-${m.index}`;
    entries.push({
      id: id("property", slug),
      kind: "property",
      effects: [],
      data: { mastery: true },
    });
    strings[`${slug}.name`] = m.name;
    strings[`${slug}.desc`] = text(m.description);
  }
  return { entries, strings };
}

/**
 * The pieces of a bundle: the 2024 table lists ammunition as one entry ("Arrows", 1 GP) that is a
 * bundle of this many pieces, as the 2014 items ("Arrow (20)") already are.
 */
const BUNDLES: Record<string, number> = {
  arrows: 20,
  bolts: 20,
  "bullets-sling": 20,
  "bullets-firearm": 10,
  needles: 50,
};

const categoriesOf = (e: Raw): string[] =>
  ((e.equipment_categories ?? []) as Raw[]).map((c) => c.index);

/** Every item of the equipment table: weapons, armor, tools, adventuring gear and ammunition. */
function convertEquipment(raw: RawSource): Converted {
  const entries: Entry[] = [];
  const strings: Strings = {};
  for (const e of raw.equipment) {
    const categories = categoriesOf(e);
    const data: Record<string, unknown> = {
      cost: e.cost ? { amount: e.cost.quantity, unit: e.cost.unit } : { amount: 0, unit: "gp" },
    };
    if (e.weight !== undefined) data.weight = e.weight;
    const damage = (d: Raw) => ({ dice: d.damage_dice, type: d.damage_type.index });

    if (categories.includes("weapons")) {
      const category = categories.includes("simple-weapons") ? "simple" : "martial";
      data.category = "weapon";
      data.weapon = {
        category,
        kind: categories.includes("melee-weapons") ? "melee" : "ranged",
        ...(e.damage && { damage: damage(e.damage) }),
        ...(e.two_handed_damage && { twoHandedDamage: damage(e.two_handed_damage) }),
        properties: ((e.properties ?? []) as Raw[]).map((p) => id("property", p.index ?? p)),
        // The Morningstar has no range in the source; a melee weapon reaches 5 feet.
        range: e.range ?? { normal: 5 },
        ...(e.throw_range && { throwRange: e.throw_range }),
        ...(e.mastery && { mastery: id("property", `mastery-${e.mastery.index}`) }),
        proficiency: [`weapon:${category}-weapons`],
      };
    } else if (categories.includes("armor")) {
      const category = categories.includes("shields")
        ? "shield"
        : (["light", "medium", "heavy"].find((c) => categories.includes(`${c}-armor`)) ?? "light");
      data.category = "armor";
      data.armor = {
        category,
        base: e.armor_class.base,
        dexBonus: e.armor_class.dex_bonus,
        ...(e.armor_class.max_bonus !== undefined && { maxDexBonus: e.armor_class.max_bonus }),
        strengthMinimum: e.str_minimum ?? 0,
        stealthDisadvantage: e.stealth_disadvantage ?? false,
        proficiency:
          category === "shield"
            ? ["armor:shields"]
            : [`armor:${category}-armor`, "armor:all-armor"],
      };
    } else if (categories.some((c) => c === "tools" || /-tools$/.test(c))) {
      // The Disguise Kit is listed as adventuring gear too; it is a tool.
      data.category = "tools";
      data.tool = {
        category:
          categories.find((c) => c !== "tools" && c !== "adventuring-gear") ?? "other-tools",
      };
    } else if (categories.includes("adventuring-gear") || categories.includes("ammunition")) {
      data.category = "adventuring-gear";
      const bundle = BUNDLES[e.index];
      data.gear = {
        category: categories.includes("equipment-packs")
          ? "equipment-packs"
          : categories.includes("ammunition")
            ? "ammunition"
            : "standard-gear",
        ...(bundle && { bundleSize: bundle }),
        ...(e.contents && {
          contents: (e.contents as Raw[]).map((c) => ({
            item: id("item", c.item.index),
            quantity: c.quantity,
          })),
        }),
      };
    } else {
      throw new Error(`Unknown equipment categories for ${e.index}: ${categories.join(", ")}`);
    }

    entries.push({ id: id("item", e.index), kind: "item", effects: [], data });
    const bundle = BUNDLES[e.index];
    strings[`${e.index}.name`] = bundle ? `${e.name} (${bundle})` : e.name;
    if (e.description) strings[`${e.index}.desc`] = text(e.description);
  }
  return { entries, strings };
}

/**
 * The choices of starting equipment of a class or a background, in the form the Equipment step reads:
 * a part is a counted item, some gold, or a pick from a category ("a gaming set").
 */
function startingChoices(rawSets: Raw[] | undefined): Record<string, unknown>[] {
  const parts = (o: Raw): Record<string, unknown>[] => {
    switch (o.option_type) {
      case "multiple":
        return (o.items as Raw[]).flatMap(parts);
      case "counted_reference":
        return [{ item: id("item", o.of.index), quantity: o.count }];
      case "money":
        if (o.unit !== "gp") throw new Error(`Starting money in ${o.unit}`);
        return [{ gold: o.count }];
      case "choice":
        return [
          {
            category: o.choice.from.equipment_category.index,
            count: o.choice.choose,
          },
        ];
      default:
        throw new Error(`Unknown starting equipment option: ${o.option_type}`);
    }
  };
  return (rawSets ?? []).map((set) => ({
    options: (set.from.options as Raw[]).map((o) => ({ items: parts(o) })),
  }));
}

const merge = (...parts: Converted[]): Converted => ({
  entries: parts.flatMap((p) => p.entries),
  strings: Object.assign({}, ...parts.map((p) => p.strings)),
});

export function convertAll(raw: RawSource): Record<string, Converted> {
  const table = proficiencyTable(raw);
  const [species, traits] = convertSpecies(raw, table);
  const classPart = convertClasses(raw, table);
  const subclassPart = convertSubclasses(raw);
  const backgroundPart = convertBackgrounds(raw, table);
  const items = convertEquipment(raw);
  // The Fighter's Weapon Mastery: as many kinds of weapon as the class table says (`weaponMastery`).
  const weaponIds = items.entries.filter((e) => e.data.category === "weapon").map((e) => e.id);
  for (const feature of [...classPart.features.entries, ...subclassPart.features.entries]) {
    const pick = FEAT_PICKS[feature.id.split("/")[1] ?? ""];
    if (pick)
      feature.effects = [
        {
          type: "choice",
          id: pick.id,
          choose: 1,
          grants: "feat",
          from: featIdsOf(raw, pick.category),
        },
      ];
    if (feature.id === id("feature", "fighter-weapon-mastery"))
      feature.effects = [
        {
          type: "choice",
          id: "masteries",
          choose: 3,
          chooseBy: "weaponMastery",
          grants: "mastery",
          from: weaponIds,
        },
      ];
  }
  return {
    ability: convertAbilities(raw),
    skill: convertSkills(raw),
    language: convertLanguages(raw),
    proficiency: convertProficiencies(raw, table),
    feat: convertFeats(raw, table),
    background: backgroundPart.backgrounds,
    species,
    trait: merge(traits, backgroundPart.traits),
    class: classPart.classes,
    subclass: subclassPart.subclasses,
    feature: merge(classPart.features, subclassPart.features),
    item: items,
    property: convertProperties(raw),
  };
}

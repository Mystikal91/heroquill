/**
 * Converts the 2024 5e-database JSON (SRD 5.2.1) into content-pack entries plus English strings.
 *
 * This is the PILOT: it converts the plain kinds (abilities, skills, languages, proficiencies), every
 * feat, and the one class / subclass / background / species the pilot character uses (Fighter,
 * Champion, Soldier, Human). Widen `PILOT` to convert more. Effects are written by hand in
 * `effects.ts`, as for the 5.1 build; a feature with no effect there is text only.
 */
import type { Effect, Entry, ProficiencyCategory } from "../../src/data/schema";
import { cleanData } from "../srd51/convert";
import { ACTIVATION, FEATURE_EFFECTS, FEAT_EFFECTS, FEAT_PICKS, REPLACES } from "./effects";

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
  spells: Raw[];
  magicSchools: Raw[];
  conditions: Raw[];
}

/** What the pilot converts for the kinds that are big; everything of the small kinds is converted. */
export const PILOT = {
  classes: ["fighter", "barbarian", "monk", "rogue", "paladin", "ranger"],
  subclasses: [
    "champion",
    "path-of-the-berserker",
    "warrior-of-the-open-hand",
    "thief",
    "oath-of-devotion",
    "hunter",
  ],
  backgrounds: ["soldier"],
  species: ["human"],
};

type WeaponEntry = { id: string; data: Record<string, unknown> };
const weaponOf = (e: WeaponEntry) =>
  e.data.weapon as { category: string; kind: string; proficiency: string[] };

/**
 * The Weapon Mastery features: how many weapons, whether the class table grows the number (`weapon_mastery`),
 * and which weapons the class offers (the Barbarian only Melee ones, the Rogue those it is proficient with).
 */
const MASTERY_PICKS: Record<
  string,
  {
    choose: number;
    byClassTable: boolean;
    /** The weapons it offers; `classProficiencies` are the indexes the class lists (`simple-weapons`, `rapiers`). */
    from: (e: WeaponEntry, classProficiencies: Set<string>) => boolean;
  }
> = {
  "fighter-weapon-mastery": { choose: 3, byClassTable: true, from: () => true },
  "barbarian-weapon-mastery": {
    choose: 2,
    byClassTable: true,
    from: (e) => weaponOf(e).kind === "melee",
  },
  "paladin-weapon-mastery": {
    choose: 2,
    byClassTable: false,
    from: (e, classProficiencies) =>
      weaponOf(e).proficiency.some((key) => classProficiencies.has(key.replace(/^weapon:/, ""))),
  },
  "ranger-weapon-mastery": {
    choose: 2,
    byClassTable: false,
    from: (e, classProficiencies) =>
      weaponOf(e).proficiency.some((key) => classProficiencies.has(key.replace(/^weapon:/, ""))),
  },
  "rogue-weapon-mastery": {
    choose: 2,
    byClassTable: false,
    from: (e, classProficiencies) =>
      weaponOf(e).proficiency.some((key) => classProficiencies.has(key.replace(/^weapon:/, ""))),
  },
};

/** The proficiency indexes a class lists, for the class a feature slug starts with (`rogue-weapon-mastery`). */
const classProficiencies = (raw: RawSource, featureSlug: string): Set<string> =>
  new Set(
    (raw.classes.find((c) => featureSlug.startsWith(`${c.index}-`))?.proficiencies ?? []).map(
      (p: Raw) => p.index as string,
    ),
  );

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
  // An option can itself be a pick from a list (the Monk: one artisan's tool or one musical instrument,
  // each a list); those lists are flattened into the one choice.
  const flat = (options: Raw[]): Raw[] =>
    options.flatMap((o) => (o.option_type === "choice" ? flat(o.choice.from.options) : [o]));
  const from = flat(set.from.options as Raw[]).map((o) => {
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
    // A species has one size, or lets the person pick one (`size_options`: Small or Medium).
    if (s.size_options) {
      effects.push({
        type: "choice",
        id: "size",
        choose: s.size_options.choose,
        grants: "size",
        from: (s.size_options.from.options as Raw[]).map((o) => String(o.size).toLowerCase()),
      });
    }
    species.entries.push({
      id: id("species", s.index),
      kind: "species",
      effects,
      data: { speed: s.speed, ...(s.size && { size: String(s.size).toLowerCase() }) },
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

/** The keys of a class table row in camel case, also inside a value (`sneak_attack.dice_count`), as the 2014 data has them. */
function camelKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camelKeys);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [
        key.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase()),
        camelKeys(v),
      ]),
    );
  return value;
}

/** How each caster of the SRD 5.2.1 prepares spells: the number is the class table's (the wizard keeps a spellbook). */
const PREPARATION: Record<string, Record<string, unknown>> = Object.fromEntries([
  ...["bard", "cleric", "druid", "paladin", "ranger", "sorcerer"].map((c) => [
    c,
    { type: "prepared", levelDivisor: 1, fromTable: true },
  ]),
  ["wizard", { type: "spellbook", initial: 6, perLevel: 2, fromTable: true }],
]);
const failPreparation = (index: string): never => {
  throw new Error(`No spell preparation rule for class ${index}`);
};

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
    // The ability score increases available at a level are a running total, as in the 2014 data.
    let increases = 0;
    const levels = own.map((l: Raw) => {
      const names = (l.features as Raw[]).map((f) => f.name);
      const specific = camelKeys(l.class_specific ?? {}) as Record<string, unknown>;
      // In 2024 the increase is the feat "Ability Score Improvement"; the build screen keeps its steps.
      if (names.includes("Ability Score Improvement")) increases += 1;
      const sc = l.spellcasting;
      return {
        level: l.level,
        features: (l.features as Raw[]).map((f) => id("feature", f.index)),
        abilityScoreImprovements: increases,
        ...(sc?.cantrips_known > 0 && { cantripsKnown: sc.cantrips_known }),
        // The 2024 classes prepare as many spells as the Prepared Spells column of the class table.
        ...(sc && { spellsKnown: sc.prepared_spells }),
        ...(sc && {
          spellSlots: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => sc[`spell_slots_level_${n}`] ?? 0),
        }),
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
          prerequisites: ((c.multi_classing.prerequisites ?? []) as Raw[]).map((p) => ({
            ability: p.ability_score.index,
            minimum: p.minimum_score,
          })),
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
        ...(c.spellcasting && {
          spellcasting: {
            ability: c.spellcasting.spellcasting_ability.index,
            startsAtLevel: c.spellcasting.level,
            preparation: PREPARATION[c.index] ?? failPreparation(c.index),
          },
        }),
        levels,
        startingChoices: startingChoices(c.starting_equipment_options),
      },
    });
    classes.strings[`${c.index}.name`] = c.name;
    (c.spellcasting?.info as Raw[] | undefined)?.forEach((info, i) => {
      classes.strings[`${c.index}.spellcasting.${i + 1}.name`] = info.name;
      classes.strings[`${c.index}.spellcasting.${i + 1}.desc`] = text(info.desc.join("\n"));
    });
  }
  return { classes, features };
}

/**
 * The spells a subclass always has prepared, from the table in the text of its "... Spells" feature
 * (`Paladin Level / Spells`, then `3 / Protection from Evil and Good, Shield of Faith`). A name that is not a
 * spell of the list stops the build: the table is read as it is, never corrected here.
 */
function subclassSpells(raw: RawSource, subclass: string): { spell: string; classLevel: number }[] {
  const feature = (raw.features as Raw[]).find(
    (f) => f.subclass?.index === subclass && /Spells$/.test(f.name),
  );
  if (!feature) return [];
  const byName = new Map((raw.spells as Raw[]).map((s) => [slugify(s.name), s.index as string]));
  const found: { spell: string; classLevel: number }[] = [];
  for (const line of String(feature.description).split("\n")) {
    const row = /^(\d+) \/ (.+)$/.exec(line.trim());
    if (!row) continue;
    for (const name of (row[2] ?? "").split(/,\s*/)) {
      const index = byName.get(slugify(name));
      if (!index)
        throw new Error(`${subclass}: the spell "${name}" of the table is not in the spell list`);
      found.push({ spell: id("spell", index), classLevel: Number(row[1]) });
    }
  }
  return found;
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
        spells: subclassSpells(raw, s.index),
        expanded: [],
      },
    });
    subclasses.strings[`${s.index}.name`] = s.name;
  }
  return { subclasses, features };
}

/**
 * Every spell of the list. The classes a spell belongs to are those the pack has (the others come back by
 * themselves when `PILOT.classes` grows). The data has an attack type and damage by slot level, nothing else the
 * 5.1 data carries (no save DC, area or healing), so Play rolls the damage only.
 */
function convertSpells(raw: RawSource): Converted {
  const entries: Entry[] = [];
  const strings: Strings = {};
  for (const s of raw.spells) {
    const data: Record<string, unknown> = {
      level: s.level,
      school: s.school.index,
      components: s.components,
      ritual: s.ritual,
      concentration: s.concentration,
      classes: (s.classes as Raw[])
        .map((c) => c.index as string)
        .filter((c) => PILOT.classes.includes(c))
        .map((c) => id("class", c)),
    };
    for (const key of ["attack_type", "dc", "heal_at_slot_level", "area_of_effect"]) {
      if (s[key] !== undefined)
        data[key.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase())] = cleanData(s[key]);
    }
    // The 2024 file gives one damage object; the data model (as the 5.1 file's) holds a list of them.
    if (s.damage !== undefined) data.damage = [cleanData(s.damage)];
    entries.push({ id: id("spell", s.index), kind: "spell", effects: [], data });
    strings[`${s.index}.name`] = s.name;
    strings[`${s.index}.desc`] = text(s.description);
    if (s.higher_level) strings[`${s.index}.higherLevel`] = text(s.higher_level);
    if (s.material) strings[`${s.index}.material`] = s.material;
    strings[`${s.index}.castingTime`] = s.casting_time;
    strings[`${s.index}.range`] = s.range;
    strings[`${s.index}.duration`] = s.duration;
  }
  return { entries, strings };
}

function convertConditions(raw: RawSource): Converted {
  const entries: Entry[] = [];
  const strings: Strings = {};
  for (const c of raw.conditions) {
    entries.push({ id: id("condition", c.index), kind: "condition", effects: [], data: {} });
    strings[`${c.index}.name`] = c.name;
    strings[`${c.index}.desc`] = text(c.description);
  }
  return { entries, strings };
}

function convertSchools(raw: RawSource): Converted {
  const entries: Entry[] = [];
  const strings: Strings = {};
  for (const m of raw.magicSchools) {
    entries.push({ id: id("school", m.index), kind: "school", effects: [], data: {} });
    strings[`${m.index}.name`] = m.name;
    strings[`${m.index}.desc`] = text(m.description);
  }
  return { entries, strings };
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
  const namedKinds = new Set(raw.proficiencies.map((p: Raw) => p.index as string));
  const entries: Entry[] = [];
  const strings: Strings = {};
  for (const e of raw.equipment) {
    const categories = categoriesOf(e);
    const damage = (d: Raw) => ({ dice: d.damage_dice, type: d.damage_type.index });
    const data: Record<string, unknown> = {
      cost: e.cost ? { amount: e.cost.quantity, unit: e.cost.unit } : { amount: 0, unit: "gp" },
    };
    // The database writes 0 for an item that weighs nothing (a dash in the book).
    if (e.weight !== undefined) data.weight = e.weight;

    if (categories.includes("weapons")) {
      const category = categories.includes("simple-weapons") ? "simple" : "martial";
      data.category = "weapon";
      data.weapon = {
        category,
        kind: categories.includes("melee-weapons") ? "melee" : "ranged",
        ...(e.damage && { damage: damage(e.damage) }),
        ...(e.two_handed_damage && { twoHandedDamage: damage(e.two_handed_damage) }),
        properties: ((e.properties ?? []) as Raw[]).map((p) => id("property", p.index ?? p)),
        range: e.range,
        ...(e.throw_range && { throwRange: e.throw_range }),
        ...(e.mastery && { mastery: id("property", `mastery-${e.mastery.index}`) }),
        // A kind of weapon some classes are proficient with by name (rapiers, scimitars): its own key first.
        proficiency: [
          ...(namedKinds.has(`${e.index}s`) ? [`weapon:${e.index}s`] : []),
          `weapon:${category}-weapons`,
        ],
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
        // A pack is anything with contents (the Explorer's Pack lacks the category in the database).
        category:
          categories.includes("equipment-packs") || e.contents
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
      case "choice": {
        // A pick from one category, or from several joined by "+" (the Monk: an artisan's tool or an instrument).
        const from = o.choice.from;
        const category: string =
          from.option_set_type === "options_array"
            ? (from.options as Raw[]).map((n) => n.choice.from.equipment_category.index).join("+")
            : from.equipment_category.index;
        return [{ category, count: o.choice.choose }];
      }
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
  const weapons = items.entries.filter((e) => e.data.category === "weapon");
  for (const feature of [...classPart.features.entries, ...subclassPart.features.entries]) {
    const slug = feature.id.split("/")[1] ?? "";
    const before = REPLACES[slug];
    if (before) feature.data = { ...feature.data, replaces: [id("feature", before)] };
    const pick = FEAT_PICKS[slug];
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
    const mastery = MASTERY_PICKS[slug];
    if (mastery)
      feature.effects = [
        {
          type: "choice",
          id: "masteries",
          choose: mastery.choose,
          ...(mastery.byClassTable && { chooseBy: "weaponMastery" }),
          grants: "mastery",
          from: weapons
            .filter((e) => mastery.from(e, classProficiencies(raw, slug)))
            .map((e) => e.id),
        },
      ];
    // Primal Knowledge: one more skill from the list the Barbarian chose from at level 1.
    if (slug === "barbarian-primal-knowledge") {
      const skills = raw.classes.find((c) => c.index === "barbarian")?.proficiency_choices?.[0];
      if (skills)
        feature.effects = [proficiencyChoice(table, "primal-knowledge", { ...skills, choose: 1 })];
    }
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
    spell: convertSpells(raw),
    school: convertSchools(raw),
    condition: convertConditions(raw),
  };
}

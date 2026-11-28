import type { Effect } from "../../data/schema";
import { classIdByName, emit } from "./emit";
import { type Context, FEATURE_TYPES, type Source, ofType } from "./registry";
import { is2024 } from "./repeats";
import {
  SCHOOLS,
  abilityFromWord,
  mapRules,
  proficiencyOf,
  readRules,
  requirementsMet,
  selectMatches,
  spellIdOf,
  translateRequirement,
} from "./rules";
import { clean, description, setters, slugify, supportsOf } from "./xml";

/** Who a feature belongs to: the class (and subclass) that grants it, and at which level. */
export interface Owner {
  classId: string;
  subclassId?: string;
  level?: number;
}

const ABILITY_ABBR: Record<string, string> = {
  str: "str",
  dex: "dex",
  con: "con",
  int: "int",
  wis: "wis",
  cha: "cha",
};

/** Every feature element granted by `source`, through grants with a level or without. */
export function grantedFeatures(
  ctx: Context,
  source: Source,
): { feature: Source; level: number | undefined }[] {
  return readRules(source.el)
    .filter((r) => r.tag === "grant" && FEATURE_TYPES.has(r.type))
    .filter((r) => requirementsMet(r.requirements))
    .map((r) => ({ feature: ctx.byAid.get(r.id), level: r.level }))
    .filter((g): g is { feature: Source; level: number | undefined } => Boolean(g.feature));
}

/** What the SRD classes call the choice of their subclass, as Aurora writes it. */
const SUBCLASS_CHOICES: Record<string, string> = {
  "primal path": "barbarian",
  "bard college": "bard",
  "divine domain": "cleric",
  "druid circle": "druid",
  "martial archetype": "fighter",
  "monastic tradition": "monk",
  "sacred oath": "paladin",
  "ranger archetype": "ranger",
  "roguish archetype": "rogue",
  "sorcerous origin": "sorcerer",
  "otherworldly patron": "warlock",
  "arcane tradition": "wizard",
};

/** The class an archetype belongs to: the one that has a feature offering archetypes like it. */
export function archetypeParent(
  ctx: Context,
  archetype: Source,
): { classId: string; flavor: string } | undefined {
  for (const cls of ofType(ctx, "Class")) {
    if (!cls.id) continue;
    const seen = new Set<Source>();
    const stack = grantedFeatures(ctx, cls).map((g) => g.feature);
    while (stack.length > 0) {
      const feature = stack.pop();
      if (!feature || seen.has(feature)) continue;
      seen.add(feature);
      for (const rule of readRules(feature.el)) {
        if (
          rule.tag === "select" &&
          rule.type === "Archetype" &&
          selectMatches(rule.supports, archetype)
        )
          return { classId: cls.id, flavor: rule.name || feature.name };
      }
      for (const g of grantedFeatures(ctx, feature)) stack.push(g.feature);
    }
  }
  // A class the app already has is not in the files: the archetype names its kind of choice.
  for (const tag of supportsOf(archetype.el)) {
    const name = SUBCLASS_CHOICES[tag.toLowerCase()];
    const classId = name && ctx.existingByName.get(`class|${name}`);
    if (classId) return { classId, flavor: tag };
  }
  return undefined;
}

/** Records which class (and level) each feature belongs to, starting from classes and archetypes. */
export function claimFeatures(ctx: Context, owners: Map<Source, Owner>): void {
  const visit = (feature: Source, owner: Owner, seen: Set<Source>) => {
    if (seen.has(feature)) return;
    seen.add(feature);
    if (!owners.has(feature)) owners.set(feature, owner);
    const here = owners.get(feature) ?? owner;
    for (const g of grantedFeatures(ctx, feature))
      visit(g.feature, { ...here, level: g.level ?? here.level }, seen);
    for (const rule of readRules(feature.el)) {
      if (rule.tag !== "select" || !FEATURE_TYPES.has(rule.type)) continue;
      for (const option of ofType(ctx, rule.type).filter((s) => selectMatches(rule.supports, s)))
        visit(option, { ...here, level: rule.level ?? here.level }, seen);
    }
  };
  for (const cls of ofType(ctx, "Class")) {
    if (!cls.id) continue;
    for (const g of grantedFeatures(ctx, cls))
      visit(g.feature, { classId: cls.id, level: g.level }, new Set());
  }
  for (const arch of ofType(ctx, "Archetype")) {
    if (!arch.id) continue;
    const parent = archetypeParent(ctx, arch);
    if (!parent) continue;
    for (const g of grantedFeatures(ctx, arch))
      visit(g.feature, { classId: parent.classId, subclassId: arch.id, level: g.level }, new Set());
  }
}

/** A class feature or archetype feature. */
export function importFeature(ctx: Context, source: Source, owners: Map<Source, Owner>): void {
  const owner = owners.get(source);
  const mapped = mapRules(ctx, source, {
    idPrefix: "feature",
    skipLevelled: true,
    levelledSpells: !subclassFeatures(ctx).has(source),
    live: true,
  });
  // What the feature asks of whoever picks it (an eldritch invocation: a level, a pact, a cantrip):
  // the sheet checks it when the feature is an option of a choice. The words are the ids the app holds.
  const asked = clean(source.el.querySelector(":scope > requirements")?.textContent);
  const prerequisite = clean(source.el.querySelector(":scope > prerequisite")?.textContent);
  emit(
    ctx,
    source,
    {
      ...(owner && { class: owner.classId }),
      ...(owner?.subclassId && { subclass: owner.subclassId }),
      ...(owner?.level !== undefined && { level: owner.level }),
      ...(asked && { requires: translateRequirement(ctx, asked) }),
    },
    { desc: description(source.el), ...(prerequisite && { prerequisite }) },
    {
      effects: [
        ...(mapped.effects as Effect[]),
        // A feature no class lists (one an optional feature of Tasha's grants) brings the features
        // it is made of, each when its level is reached.
        ...(owner
          ? []
          : mapped.grants.flatMap(({ source: granted, level, requires }): Effect[] => {
              if (!granted.id) return [];
              const trait: Effect = {
                type: "trait",
                id: granted.id as `${string}:${string}/${string}`,
                ...(level !== undefined && { minLevel: level }),
              };
              return [requires ? { type: "when", requires, effects: [trait] } : trait];
            })),
        // The fighting style of that name: the off-hand weapon adds its modifier to damage.
        ...(slugify(source.name) === "two-weapon-fighting"
          ? [{ type: "flag", id: "two-weapon-fighting" } as Effect]
          : []),
      ],
    },
  );
}

/** `[str:13]` terms of a multiclass requirement, split into "all of these" and "any of these". */
function parsePrerequisites(text: string) {
  const terms = [...text.matchAll(/\[(str|dex|con|int|wis|cha):(\d+)\]/g)].map((m) => ({
    ability: ABILITY_ABBR[m[1] ?? ""] ?? "int",
    minimum: Number(m[2]),
  }));
  if (text.includes("||")) return { prerequisites: [], options: terms };
  return { prerequisites: terms, options: [] };
}

interface Casting {
  ability: string;
  /** The list it picks from as the file writes it: `Wizard`, or `Wizard,(Abjuration||Evocation)`. */
  list: string;
  prepare: boolean;
  pact: boolean;
  startsAt: number;
  preparation:
    | { type: "known" }
    | { type: "prepared"; levelDivisor: number }
    | { type: "spellbook"; initial: number; perLevel: number };
  slots: number[][]; // slots[level 1..20][spell level 1..9]
  cantrips: number[];
  spells: number[];
}

/** Reads a class's spellcasting feature: slots, cantrips and spells by level. */
function readCasting(feature: Source): Casting | undefined {
  const block = feature.el.querySelector(":scope > spellcasting");
  if (!block) return undefined;
  const rules = readRules(feature.el);
  const slots = Array.from({ length: 20 }, () => Array.from({ length: 9 }, () => 0));
  // Pact Magic: a count of slots and their level, each growing by steps at given class levels.
  const pact = rules.some((r) => r.tag === "stat" && /:spellcasting:slots:count$/.test(r.name));
  const stepped = (suffix: RegExp, level: number) =>
    rules
      .filter((r) => r.tag === "stat" && suffix.test(r.name) && (r.level ?? 0) <= level)
      .reduce((sum, r) => sum + (Number.parseInt(r.value, 10) || 0), 0);
  if (pact) {
    for (let level = 1; level <= 20; level++) {
      const count = stepped(/:spellcasting:slots:count$/, level);
      const spellLevel = stepped(/:spellcasting:slot$/, level);
      const row = slots[level - 1];
      if (row && count > 0 && spellLevel >= 1 && spellLevel <= 9) row[spellLevel - 1] = count;
    }
  }
  for (const rule of pact ? [] : rules) {
    const m = rule.name.match(/:spellcasting:slots:(\d)$/);
    if (rule.tag !== "stat" || !m || rule.level === undefined) continue;
    const spellLevel = Number(m[1]) - 1;
    const value = Number.parseInt(rule.value, 10) || 0;
    for (let level = rule.level; level <= 20; level++) {
      const row = slots[level - 1];
      if (row) row[spellLevel] = (row[spellLevel] ?? 0) + value;
    }
  }
  const cantrips = Array.from({ length: 20 }, () => 0);
  const spells = Array.from({ length: 20 }, () => 0);
  let spellbook = false;
  let initial = 0;
  let perLevel = 0;
  for (const rule of rules) {
    if (rule.tag !== "select" || rule.type !== "Spell") continue;
    // A pick with no level is the one of the first level (the cantrips of Tasha's Artificer are written so).
    const from = rule.level ?? 1;
    const isCantrip = /cantrip/i.test(rule.name);
    const target = isCantrip ? cantrips : spells;
    if (/spellbook/i.test(rule.name)) {
      spellbook = true;
      if (from === 1) initial += rule.number;
      else perLevel = rule.number;
    }
    for (let level = from; level <= 20; level++)
      target[level - 1] = (target[level - 1] ?? 0) + rule.number;
  }
  const prepares = block.getAttribute("prepare") === "true";
  const half = rules.some(
    (r) => r.tag === "stat" && /:spellcasting:prepare$/.test(r.name) && /:half$/.test(r.value),
  );
  const preparation: Casting["preparation"] = spellbook
    ? { type: "spellbook", initial, perLevel }
    : prepares
      ? { type: "prepared", levelDivisor: half ? 2 : 1 }
      : { type: "known" };
  const firstSlot = slots.findIndex((row) => row.some((n) => n > 0));
  return {
    ability: abilityFromWord(block.getAttribute("ability") ?? "") ?? "int",
    list: clean(block.querySelector("list")?.textContent),
    prepare: prepares,
    pact,
    startsAt: firstSlot === -1 ? 1 : firstSlot + 1,
    preparation,
    slots,
    cantrips,
    spells,
  };
}

export function importClass(ctx: Context, source: Source): void {
  const slug = slugify(source.name);
  const set = setters(source.el);
  const hitDie = Number(set.get("hd")?.text.match(/d(\d+)/)?.[1] ?? 8);

  // What the class gives a character that starts with it.
  const mapped = mapRules(ctx, source, {
    idPrefix: `${slug}-proficiency`,
    skipLevelled: true,
    classSlug: slug,
    live: true,
  });

  // Features by level, and the special ones: spellcasting and ability score improvements.
  const grants = grantedFeatures(ctx, source);
  const byLevel = new Map<number, string[]>();
  const everyFeature: Source[] = [];
  const collect = (feature: Source, seen: Set<Source>) => {
    if (seen.has(feature)) return;
    seen.add(feature);
    everyFeature.push(feature);
    for (const g of grantedFeatures(ctx, feature)) collect(g.feature, seen);
  };
  for (const g of grants) {
    collect(g.feature, new Set());
    if (g.feature.id && g.level !== undefined) {
      const list = byLevel.get(g.level) ?? [];
      list.push(g.feature.id);
      byLevel.set(g.level, list);
    }
  }

  const casting = everyFeature.map(readCasting).find(Boolean);
  const asiLevels = everyFeature
    .filter((f) => /ability score improvement/i.test(f.name))
    .flatMap((f) => readRules(f.el).filter((r) => r.tag === "select" && r.level !== undefined))
    .map((r) => r.level as number);

  // Multiclassing: the requirement and the proficiencies gained.
  const multiclass = source.el.querySelector(":scope > multiclass");
  const requirement = parsePrerequisites(
    clean(multiclass?.querySelector(":scope > requirements")?.textContent),
  );
  const multiclassProficiencies = multiclass
    ? readRules(multiclass)
        .filter((r) => r.tag === "grant" && r.type === "Proficiency")
        .map((r) => proficiencyOf(ctx, r.id))
        .filter((p): p is NonNullable<typeof p> => Boolean(p))
        .map((p) => `${p.category}:${p.target}`)
    : [];

  const levels = Array.from({ length: 20 }, (_, i) => {
    const level = i + 1;
    return {
      level,
      features: byLevel.get(level) ?? [],
      abilityScoreImprovements: asiLevels.filter((l) => l <= level).length,
      ...(casting?.cantrips[i] ? { cantripsKnown: casting.cantrips[i] } : {}),
      ...(casting && casting.preparation.type === "known" && casting.spells[i]
        ? { spellsKnown: casting.spells[i] }
        : {}),
      ...(casting && level >= casting.startsAt ? { spellSlots: casting.slots[i] } : {}),
      classSpecific: {},
    };
  });

  emit(
    ctx,
    source,
    {
      hitDie,
      ...(casting && {
        spellcasting: {
          ability: casting.ability,
          startsAtLevel: casting.startsAt,
          ...(casting.pact && { pact: true }),
          preparation: casting.preparation,
        },
      }),
      multiclassing: {
        prerequisites: requirement.prerequisites,
        ...(requirement.options.length > 0 && {
          prerequisiteOptions: { choose: 1, from: requirement.options },
        }),
        proficiencies: multiclassProficiencies,
      },
      levels,
    },
    { desc: description(source.el) },
    { effects: mapped.effects as Effect[] },
  );
}

/** True when the class already has spellcasting, so its subclass needs none of its own. */
function classCasting(ctx: Context, classId: string): boolean {
  const entry = ctx.options.index.get(classId) ?? ctx.result.entries.find((e) => e.id === classId);
  return Boolean(entry && (entry.data as { spellcasting?: unknown }).spellcasting);
}

/** The features an archetype grants, and those they grant in turn. */
function archetypeFeatures(ctx: Context, source: Source): Source[] {
  const seen = new Set<Source>();
  const stack = grantedFeatures(ctx, source).map((g) => g.feature);
  while (stack.length > 0) {
    const feature = stack.pop();
    if (!feature || seen.has(feature)) continue;
    seen.add(feature);
    for (const g of grantedFeatures(ctx, feature)) stack.push(g.feature);
  }
  return [...seen];
}

const subclassFeatureCache = new WeakMap<Context, Set<Source>>();

/**
 * Every feature a subclass always has. The spells these give at a level are listed by the subclass
 * (`subclassSpells`); an option the person picks (a druid's land) gives its spells itself.
 */
function subclassFeatures(ctx: Context): Set<Source> {
  let found = subclassFeatureCache.get(ctx);
  if (!found) {
    found = new Set(
      ofType(ctx, "Archetype")
        .filter((a) => a.id && archetypeParent(ctx, a))
        .flatMap((a) => archetypeFeatures(ctx, a)),
    );
    subclassFeatureCache.set(ctx, found);
  }
  return found;
}

/**
 * The spells a subclass always gives from a class level, on the archetype itself (the domains of
 * the Player's Handbook) or on a feature of it ("Artillerist Spells", "Oath Spells"). Not all are
 * marked `prepared`: those a ranger's subclass adds to the spells known come the same way. A spell
 * never comes before the feature that gives it. A grant without a level stays an effect of its feature.
 */
function subclassSpells(ctx: Context, source: Source): { spell: string; classLevel: number }[] {
  const found = new Map<string, number>();
  const visit = (holder: Source, reached: number, path: Set<Source>) => {
    if (path.has(holder)) return;
    for (const rule of readRules(holder.el)) {
      if (rule.type !== "Spell" || rule.level === undefined) continue;
      // A select with a level and a default (Aberrant Mind, Clockwork Soul) gives that spell: one
      // for each edition, the requirement naming the class feature of its book, which the character has.
      const given = rule.tag === "select" ? (rule.attrs.getAttribute("default") ?? "") : rule.id;
      if (rule.tag === "select" ? !given : rule.tag !== "grant") continue;
      const holds = new Set(
        (rule.requirements.match(/ID_[A-Z0-9_]+/g) ?? []).filter(
          (word) => is2024({ source: "", aid: word }) === is2024(source),
        ),
      );
      const spell =
        requirementsMet(rule.requirements, rule.tag === "select" ? holds : undefined) &&
        spellIdOf(ctx, given);
      const level = Math.max(rule.level, reached);
      if (spell) found.set(spell, Math.min(level, found.get(spell) ?? level));
    }
    for (const g of grantedFeatures(ctx, holder))
      visit(g.feature, Math.max(g.level ?? 1, reached), new Set([...path, holder]));
  };
  visit(source, 1, new Set());
  return [...found]
    .map(([spell, classLevel]) => ({ spell, classLevel }))
    .sort((a, b) => a.classLevel - b.classLevel);
}

export function importArchetype(ctx: Context, source: Source): void {
  const parent = archetypeParent(ctx, source);
  if (!parent) {
    ctx.result.skipped.Archetype = (ctx.result.skipped.Archetype ?? 0) + 1;
    return;
  }
  const byLevel = new Map<number, string[]>();
  const spells = subclassSpells(ctx, source);
  for (const rule of readRules(source.el)) {
    if (rule.tag !== "grant" || rule.level === undefined || !requirementsMet(rule.requirements))
      continue;
    const target = ctx.byAid.get(rule.id);
    if (!target?.id) continue;
    if (FEATURE_TYPES.has(rule.type)) {
      const list = byLevel.get(rule.level) ?? [];
      list.push(target.id);
      byLevel.set(rule.level, list);
    }
  }
  // An archetype that gives spellcasting (Eldritch Knight, Arcane Trickster): its own tables, and
  // the class whose list it picks from, unless the class already casts.
  const casting = archetypeFeatures(ctx, source).map(readCasting).find(Boolean);
  const listClass = casting
    ? classIdByName(ctx, casting.list.split(",")[0]?.trim() ?? "")
    : undefined;
  // The list can name schools after the class ("Wizard,(Abjuration||Evocation)").
  const schools = (casting?.list ?? "")
    .split(",")
    .slice(1)
    .join(",")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((word) => SCHOOLS.has(word));
  const classCasts = classCasting(ctx, parent.classId);
  const casts = casting && listClass && !classCasts ? casting : undefined;

  const rows = new Map<
    number,
    {
      level: number;
      features: string[];
      cantripsKnown?: number;
      spellsKnown?: number;
      spellSlots?: number[];
    }
  >();
  for (const [level, features] of byLevel) rows.set(level, { level, features });
  if (casts) {
    for (let level = casts.startsAt; level <= 20; level++) {
      const row = rows.get(level) ?? { level, features: [] };
      const cantrips = casts.cantrips[level - 1];
      const known = casts.spells[level - 1];
      rows.set(level, {
        ...row,
        ...(cantrips ? { cantripsKnown: cantrips } : {}),
        ...(known ? { spellsKnown: known } : {}),
        spellSlots: casts.slots[level - 1] ?? [],
      });
    }
  }
  const levels = [...rows.values()].sort((a, b) => a.level - b.level);
  const kind = casts?.pact
    ? "pact"
    : (casts?.startsAt ?? 1) >= 3
      ? "third"
      : casts?.startsAt === 2
        ? "half"
        : "full";
  emit(
    ctx,
    source,
    {
      levels,
      spells,
      ...(casts &&
        listClass && {
          spellcasting: {
            ability: casts.ability,
            list: listClass,
            ...(schools.length > 0 && { schools }),
            startsAtLevel: casts.startsAt,
            kind,
          },
        }),
    },
    { desc: description(source.el), flavor: parent.flavor },
    { parent: parent.classId },
  );
}

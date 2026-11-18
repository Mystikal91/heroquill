import { CREATURE_SIZES, type Effect } from "../../data/schema";
import { damageReductionEffects } from "./damageReductions";
import { emit } from "./emit";
import { naturalWeaponEffects } from "./naturalWeapons";
import { REPLACED_BY_FLAG } from "./optionalFeatures";
import { type Context, FEATURE_TYPES, type Source, ofType, sharesTag } from "./registry";
import { mapRules, readRules, requirementsMet, selectMatches, translateRequirement } from "./rules";
import { clean, description, setters, supportsOf } from "./xml";

/** Effects from rules, plus the traits or features the element grants right away. */
function baseEffects(ctx: Context, source: Source, prefix: string, holds?: ReadonlySet<string>) {
  // With nothing assumed to be held, a rule with a requirement stays in, behind a `when` that is
  // checked with the sheet; with `holds` the requirement is decided now and the rule is in or out.
  const live = !holds;
  const mapped = mapRules(ctx, source, { idPrefix: prefix, live, ...(holds && { holds }) });
  const effects: Effect[] = [...mapped.effects];
  const gate = (requires: string | undefined, effect: Effect): Effect =>
    requires ? { type: "when", requires, effects: [effect] } : effect;
  for (const grant of mapped.grants) {
    // A trait that a species gives at a level (the aasimar's revelation at the 3rd) comes with it.
    if (grant.source.id)
      effects.push(
        gate(grant.requires, {
          type: "trait",
          id: grant.source.id as `${string}:${string}/${string}`,
          ...(grant.level !== undefined && { minLevel: grant.level }),
        }),
      );
  }
  // "Choose two of these traits" (the half-elf's ability increases, a fighting style...).
  mapped.offers.forEach(({ rule, options }, i) => {
    if (rule.type === "Archetype" || rule.type === "Sub Race") return;
    const from = options.map((o) => o.id).filter((id): id is string => Boolean(id));
    if (from.length > 0)
      effects.push(
        gate(
          live && rule.requirements.trim()
            ? translateRequirement(ctx, rule.requirements)
            : undefined,
          {
            type: "choice",
            id: `${prefix}-offer-${i + 1}`,
            choose: rule.number,
            grants: "trait",
            from,
          },
        ),
      );
  });
  return { mapped, effects };
}

const LIST_FIELDS: Record<string, string> = {
  "personality trait": "personalityTraits",
  ideal: "ideals",
  bond: "bonds",
  flaw: "flaws",
};

export function importBackground(ctx: Context, source: Source): void {
  const { effects } = baseEffects(ctx, source, "background");
  const choose: Record<string, number> = {};
  const texts: Record<string, string | undefined> = { desc: description(source.el) };

  for (const rule of readRules(source.el)) {
    if (rule.tag !== "select" || rule.type !== "List") continue;
    const field = LIST_FIELDS[rule.name.toLowerCase()];
    if (!field || rule.items.length === 0) continue;
    choose[field] = rule.number;
    rule.items.forEach((text, n) => {
      if (source.id) ctx.result.strings[`${source.id}.${field}.${n + 1}`] = text;
    });
  }

  const feature = readRules(source.el)
    .filter((r) => r.tag === "grant" && r.type === "Background Feature")
    .filter((r) => requirementsMet(r.requirements))
    .map((r) => ctx.byAid.get(r.id))
    .find(Boolean);
  if (feature) {
    texts.featureName = feature.name.replace(/^feature:\s*/i, "");
    texts.featureDesc = description(feature.el);
  }
  emit(ctx, source, { choose }, texts, { effects });
}

export function importRace(ctx: Context, source: Source): void {
  const { mapped, effects } = baseEffects(ctx, source, "species");
  emit(
    ctx,
    source,
    {
      speed: mapped.speed ?? 30,
      size: mapped.size ?? "medium",
    },
    { desc: description(source.el) },
    { effects },
  );
}

/** True when the race, or a trait it grants (at any depth), offers this sub-race to pick. */
function offers(ctx: Context, race: Source, sub: Source, selects = "Sub Race"): boolean {
  const seen = new Set<Source>();
  const stack = [race];
  while (stack.length > 0) {
    const here = stack.pop();
    if (!here || seen.has(here)) continue;
    seen.add(here);
    for (const rule of readRules(here.el)) {
      if (rule.tag === "select" && rule.type === selects && selectMatches(rule.supports, sub))
        return true;
      const granted = rule.tag === "grant" ? ctx.byAid.get(rule.id) : undefined;
      if (granted && FEATURE_TYPES.has(rule.type)) stack.push(granted);
    }
  }
  return false;
}

/** The race a sub-race belongs to: the one its `supports` names, in this pack or in the app. */
function parentRace(ctx: Context, source: Source): string | undefined {
  const tags = supportsOf(source.el);
  // The race, or a trait it grants, says which sub-races it offers
  // (`select type="Sub Race" supports="MOTM Genasi"`).
  const offering = ofType(ctx, "Race").find((s) => s.id && offers(ctx, s, source));
  if (offering?.id) return offering.id;
  const inPack = ofType(ctx, "Race").find((s) => s.id && sharesTag([s.name], tags));
  if (inPack?.id) return inPack.id;
  for (const tag of tags) {
    const existing = ctx.existingByName.get(`species|${tag.toLowerCase()}`);
    if (existing) return existing;
  }
  return undefined;
}

export function importSubRace(ctx: Context, source: Source): void {
  const parent = parentRace(ctx, source);
  if (!parent) {
    ctx.result.skipped["Sub Race"] = (ctx.result.skipped["Sub Race"] ?? 0) + 1;
    return;
  }
  // A sub-race only adds. What it takes away from its race ("unless you have a sub-race": the
  // Tiefling's increase and legacy give way to those of its bloodline) is written on the race as
  // a requirement, which the sheet checks against the flag the sub-race sets; the races of the
  // app carry the same requirements (see `withOriginRules`), so this holds even when the files of
  // the race are not among the ones imported.
  const { effects } = baseEffects(ctx, source, "subspecies");
  // Held by its Aurora id too, for requirements of races that name it so (they may be elsewhere).
  const held: Effect[] = [{ type: "flag", id: source.aid }, ...effects];
  emit(ctx, source, {}, { desc: description(source.el) }, { effects: held, parent });
}

/**
 * A variant of a race (the half-elf of the Sword Coast, a dragonborn of Wildemount, a race with a
 * dragonmark) replaces some of the race's traits. It is a sub-species that only adds: the race
 * keeps what the variant takes away behind a requirement, and the variant sets the flag it tests.
 */
export function importRaceVariant(ctx: Context, source: Source): void {
  const parent = ofType(ctx, "Race").find((s) => s.id && offers(ctx, s, source, "Race Variant"));
  if (!parent?.id) {
    ctx.result.skipped["Race Variant"] = (ctx.result.skipped["Race Variant"] ?? 0) + 1;
    return;
  }
  const { effects } = baseEffects(ctx, source, "variant");
  const held: Effect[] = [{ type: "flag", id: source.aid }, ...effects];
  emit(ctx, source, {}, { desc: description(source.el) }, { effects: held, parent: parent.id });
}

/** A rule a table switches on for a character: it is held by the character that has it. */
export function importOption(ctx: Context, source: Source): void {
  const { effects } = baseEffects(ctx, source, "option");
  // Held by its Aurora id as well, for rules of another pack that ask for it by that name.
  emit(
    ctx,
    source,
    {},
    { desc: description(source.el) },
    { effects: [{ type: "flag", id: source.aid }, ...effects] },
  );
}

/**
 * One of Tasha's optional class features: a hidden item in Aurora that a character equips to
 * switch it on, here an option. It grants the feature (at its level) and, for the six that take
 * the place of a feature of the class, lists the entries it replaces.
 */
export function importOptionalFeature(ctx: Context, source: Source): void {
  const { effects } = baseEffects(ctx, source, "option");
  const replaces = effects.flatMap((effect) =>
    effect.type === "flag" ? (REPLACED_BY_FLAG[effect.id] ?? []) : [],
  );
  const have = replaces.filter((id) => ctx.options.index.has(id));
  // The item only says "equip me": what the person reads is the feature it grants.
  const feature = readRules(source.el)
    .filter((r) => r.tag === "grant" && FEATURE_TYPES.has(r.type))
    .map((r) => ctx.byAid.get(r.id))
    .find(Boolean);
  const named = /^(.+?),\s*LV(\d+):\s*(.+)$/.exec(source.name);
  emit(
    ctx,
    source,
    {
      optionalFeature: true,
      ...(source.type === "Background Feature" && { backgroundFeature: true }),
      ...(have.length > 0 && { replaces: have }),
    },
    { desc: description(feature?.el ?? source.el) },
    { effects: [{ type: "flag", id: source.aid }, ...effects] },
  );
  if (source.id && named) ctx.result.strings[`${source.id}.name`] = `${named[3]} (${named[1]})`;
  const plain =
    source.type === "Background Feature" && source.name.replace(/^optional feature:\s*/i, "");
  if (source.id && plain) ctx.result.strings[`${source.id}.name`] = plain;
}

/** A racial trait, a feat feature or any other named option that has effects of its own. */
export function importTrait(ctx: Context, source: Source): void {
  const { mapped, effects } = baseEffects(ctx, source, "trait");
  // A trait that gives a size (the Small and Medium that Tasha's Custom Lineage lets you pick) sets
  // the creature's size, which a race that has no size of its own cannot do by itself.
  const size = CREATURE_SIZES.find((s) => s === mapped.size);
  const sizeEffects: Effect[] = size ? [{ type: "size", size }] : [];
  // The natural weapons of the species of the books are in a table: Aurora has only their words.
  emit(
    ctx,
    source,
    {},
    { desc: description(source.el) },
    { effects: [...effects, ...sizeEffects, ...naturalWeaponEffects(source.aid)] },
  );
}

/** `[dex:13]` style requirements: the minimum ability scores a feat asks for. */
function prerequisites(el: Element): { ability: string; minimum: number }[] {
  const text = clean(el.querySelector(":scope > requirements")?.textContent);
  return [...text.matchAll(/\[(str|dex|con|int|wis|cha):(\d+)\]/g)].map((m) => ({
    ability: m[1] ?? "",
    minimum: Number(m[2]),
  }));
}

export function importFeat(ctx: Context, source: Source): void {
  const { effects: base } = baseEffects(ctx, source, "feat");
  const effects = [...base, ...damageReductionEffects(source.aid)];
  const requirements = clean(source.el.querySelector(":scope > requirements")?.textContent);
  emit(
    ctx,
    source,
    {
      prerequisites: prerequisites(source.el),
      requirements,
      // What the feat asks for, with the ids the app holds: the picker checks it.
      ...(requirements && { requires: translateRequirement(ctx, requirements) }),
    },
    { desc: description(source.el) },
    { effects },
  );
}

const ALIGNMENT_CODES: Record<string, string> = {
  LG: "lawful-good",
  NG: "neutral-good",
  CG: "chaotic-good",
  LN: "lawful-neutral",
  N: "neutral",
  CN: "chaotic-neutral",
  LE: "lawful-evil",
  NE: "neutral-evil",
  CE: "chaotic-evil",
};

/** A deity: who it is in a line (setting, alignment, domains, symbol) and what the book says. */
export function importDeity(ctx: Context, source: Source): void {
  const set = setters(source.el);
  const slug = ALIGNMENT_CODES[(set.get("alignment")?.text ?? "").toUpperCase()];
  const alignmentId = `srd51:alignment/${slug}`;
  const alignment = slug && ctx.options.index.has(alignmentId) ? alignmentId : undefined;
  const domains = set.get("domains")?.text ?? "";
  const symbol = set.get("symbol")?.text ?? "";
  const facts = [
    set.get("setting")?.text,
    alignment ? ctx.options.nameOf(alignment) : undefined,
    domains ? `Domains: ${domains}` : undefined,
    symbol ? `Symbol: ${symbol}` : undefined,
  ].filter(Boolean);
  emit(
    ctx,
    source,
    { ...(alignment && { alignment }), ...(domains && { domains }) },
    { desc: [facts.join(" \u00b7 "), description(source.el)].filter(Boolean).join("\n\n") },
  );
}

import * as v from "valibot";

export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
export const AbilitySchema = v.picklist(ABILITIES);
export type Ability = v.InferOutput<typeof AbilitySchema>;

/**
 * Namespaced id: `pack:kind/slug`, e.g. `srd51:subspecies/high-elf`.
 * The kind is part of the id because slugs repeat across kinds (a trait and a spell
 * can both be `darkvision`). Texts live in locale files, keyed by this id.
 */
export const EntryIdSchema = v.pipe(
  v.string(),
  v.regex(
    /^[a-z0-9]+:[a-z]+\/[a-z0-9]+(-+[a-z0-9]+)*$/,
    "Expected an id like `pack:kind/entry-name`",
  ),
);

export const PROFICIENCY_CATEGORIES = [
  "skill",
  "save",
  "weapon",
  "armor",
  "tool",
  "language",
] as const;
export const ProficiencyCategorySchema = v.picklist(PROFICIENCY_CATEGORIES);
export type ProficiencyCategory = v.InferOutput<typeof ProficiencyCategorySchema>;

/** The sizes of a creature, smallest first. */
export const CREATURE_SIZES = ["tiny", "small", "medium", "large", "huge", "gargantuan"] as const;
export type CreatureSize = (typeof CREATURE_SIZES)[number];

/** What a `modifier` effect changes. */
export const MODIFIER_TARGETS = [
  "ac",
  "speed",
  "initiative",
  "attack",
  "damage",
  "hpPerLevel",
  "hp",
  "save",
  "skill",
  "spellAttack",
  "spellDc",
] as const;
export type ModifierTarget = (typeof MODIFIER_TARGETS)[number];

/**
 * When a `modifier` applies, for what the character wears or wields:
 * `wearingArmor` (body armor, not a shield), `unarmored` (no body armor), `noHeavyArmor`,
 * `unarmoredNoShield` (neither armor nor a shield),
 * `wearingShield`, `ranged` and `melee` (the weapon of an attack), and `dueling` (a melee weapon that is not
 * two-handed, with no other weapon).
 */
export const MODIFIER_CONDITIONS = [
  "wearingArmor",
  "unarmored",
  "noHeavyArmor",
  "unarmoredNoShield",
  "wearingShield",
  "ranged",
  "melee",
  "dueling",
] as const;
export type ModifierCondition = (typeof MODIFIER_CONDITIONS)[number];

/** Ways of moving besides walking. Swimming and climbing are always possible at half speed. */
export const MOVEMENT_MODES = ["climb", "swim", "fly", "burrow"] as const;
export type MovementMode = (typeof MOVEMENT_MODES)[number];

/** Senses with a range in feet. */
export const SENSES = ["darkvision", "blindsight", "tremorsense", "truesight"] as const;
export type Sense = (typeof SENSES)[number];

/**
 * Closed set of declarative effects. Extend deliberately, one type at a time.
 * Features that need custom logic are expressed as `trait` (+ optional `resource`)
 * and are not automated.
 */
/** What a number of a feature is made of: a number, text, or a value of the character. */
export const FeatureTermSchema = v.union([
  v.number(),
  v.object({ text: v.string() }),
  v.object({ of: v.picklist(["proficiency", "level"]) }),
  v.object({ mod: AbilitySchema }),
  v.object({ score: AbilitySchema }),
  /** The level in one class, by the slug of the class. */
  v.object({ classLevel: v.string() }),
]);
export type FeatureTerm = v.InferOutput<typeof FeatureTermSchema>;

/** The kinds of resource that a feature can take points from (see the `spends` effect). */
export const SPEND_POOLS = [
  "ki",
  "channelDivinity",
  "bardicInspiration",
  "sorceryPoints",
  "wildShape",
] as const;
export type SpendPool = (typeof SPEND_POOLS)[number];

const PlainEffectSchema = v.variant("type", [
  /**
   * A name other rules can ask for (`when.requires`), for a rule that says "this is held" without
   * being an entry of its own. Entries themselves are held by their id.
   */
  v.object({ type: v.literal("flag"), id: v.string() }),
  v.object({
    type: v.literal("abilityBonus"),
    ability: AbilitySchema,
    value: v.number(),
    /** The most the score may reach with this bonus (a barbarian's Primal Champion: 24); 20 when absent. */
    max: v.optional(v.number()),
  }),
  v.object({
    type: v.literal("proficiency"),
    category: ProficiencyCategorySchema,
    target: v.string(),
  }),
  v.object({
    type: v.literal("trait"),
    id: EntryIdSchema,
    /** The trait comes with this level of the character (a species gives it at the 3rd or 5th). */
    minLevel: v.optional(v.number()),
  }),
  v.object({
    type: v.literal("choice"),
    id: v.string(),
    choose: v.pipe(v.number(), v.integer(), v.minValue(1)),
    /** What each pick grants. `from` holds the options: entry ids, `category:target` for
     * proficiencies, language slugs for languages, ability ids for ability bonuses. A `feat`
     * choice with an empty `from` offers every feat there is. */
    grants: v.picklist([
      "proficiency",
      "language",
      "spell",
      "trait",
      "abilityBonus",
      "expertise",
      "feat",
      "mastery",
      "size",
    ]),
    from: v.array(v.string()),
    /** Bonus applied per pick when `grants` is `abilityBonus`. */
    value: v.optional(v.number()),
    /** For a `spell` choice: what is picked can be cast once between rests without a slot. */
    free: v.optional(v.boolean()),
    /**
     * For a `spell` choice with no `from`: which spells it offers, from every list unless `spellClass`
     * says one. `spellLevel` is one level (the three cantrips of the Pact of the Tome are `0`),
     * `spellUpTo` every level up to it, cantrips included (Magical Secrets), `ritual` only spells with
     * the ritual tag. At least one of `spellLevel` and `spellUpTo` makes the choice open.
     */
    spellLevel: v.optional(v.number()),
    spellUpTo: v.optional(v.number()),
    spellClass: v.optional(EntryIdSchema),
    ritual: v.optional(v.boolean()),
    /** For a `spell` choice: what is picked can be cast as often as wanted without a slot (see `grantSpell`). */
    atWill: v.optional(v.boolean()),
    /** For a `free` spell choice: the rest that gives the cast back (the long rest when absent). */
    rest: v.optional(v.picklist(["short", "long"])),
    /**
     * A key of the class table (`classSpecific`): the number of picks is that value at the
     * class level, and `choose` is only a placeholder. Invocations and metamagic grow this way.
     */
    chooseBy: v.optional(v.string()),
  }),
  v.object({
    type: v.literal("grantSpell"),
    spell: EntryIdSchema,
    /** The spell comes with this level of the class that gives it (always prepared). */
    minLevel: v.optional(v.number()),
    /** The spell can be cast once between rests without a slot (a feat or a species trait gives it so). */
    free: v.optional(v.boolean()),
    /** For a `free` spell: the rest that gives the cast back (the long rest when absent). */
    rest: v.optional(v.picklist(["short", "long"])),
    /**
     * The spell can be cast as often as wanted without a slot (an eldritch invocation gives it so):
     * it is listed and treated as a cantrip.
     */
    atWill: v.optional(v.boolean()),
  }),
  /**
   * A natural weapon (claws, a bite, horns): the unarmed strike rolls this die and this kind of
   * damage in place of its 1 and bludgeoning, and is always there, even with a weapon in hand.
   */
  v.object({
    type: v.literal("unarmedStrike"),
    dice: v.string(),
    damageType: v.string(),
  }),
  /**
   * A bonus to the damage that spells roll: the modifier of an ability. It applies to the spell of
   * `spell`, to the spells of a `school`, or to damage of a `damageType`; `once` is for "one damage
   * roll of the spell" (Empowered Evocation), else it is added to every roll (Agonizing Blast).
   */
  v.object({
    type: v.literal("spellDamage"),
    plus: AbilitySchema,
    spell: v.optional(EntryIdSchema),
    school: v.optional(v.string()),
    damageType: v.optional(v.string()),
    once: v.optional(v.boolean()),
  }),
  /**
   * What features do to the healing of spells (only spells that have a healing roll in the data).
   * `plusSlotLevel`: every healing roll of a spell of 1st level or higher gets this plus the level of
   * the slot (Disciple of Life: 2). `maxDice`: the dice give their highest number (Supreme Healing).
   * `selfPlusSlotLevel`: healing someone else also heals the caster this plus the slot level
   * (Blessed Healer: 2).
   */
  v.object({
    type: v.literal("spellHealing"),
    plusSlotLevel: v.optional(v.number()),
    maxDice: v.optional(v.boolean()),
    selfPlusSlotLevel: v.optional(v.number()),
  }),
  /**
   * Damage a feature adds to attacks, rolled by the card of its own in Play: the dice of the highest
   * step the class level reaches, of a kind of damage. `note` names the text that says when it applies.
   */
  v.object({
    type: v.literal("extraDamage"),
    damageType: v.string(),
    steps: v.array(v.object({ minLevel: v.number(), dice: v.string() })),
    note: v.picklist(["oncePerTurn"]),
  }),
  /** A flat bonus to a number of the sheet, with an optional condition. */
  v.object({
    type: v.literal("modifier"),
    target: v.picklist(MODIFIER_TARGETS),
    value: v.number(),
    /** Adds the proficiency bonus or the modifier of an ability to `value` (initiative with Dexterity... a charisma bonus to armor class). */
    plus: v.optional(v.union([AbilitySchema, v.literal("proficiency")])),
    /** For a bonus to skills: the one skill it is for (its slug), or every skill when absent. */
    skill: v.optional(v.string()),
    when: v.optional(v.picklist(MODIFIER_CONDITIONS)),
    /** Applies from this level of the class that gives it (of the whole character, for a species). */
    minLevel: v.optional(v.number()),
    /** The bonus is at least this, once `plus` is added (an aura of protection: the Charisma modifier, but +1 at the least). */
    min: v.optional(v.number()),
  }),
  /**
   * A speed of climbing, swimming, flying or burrowing, in feet, or `"walk"` for one equal to the
   * walking speed. The best of them counts, and bonuses to speed add to it as they do to walking.
   */
  v.object({
    type: v.literal("movement"),
    mode: v.picklist(MOVEMENT_MODES),
    feet: v.union([v.pipe(v.number(), v.minValue(0)), v.literal("walk")]),
    when: v.optional(v.picklist(MODIFIER_CONDITIONS)),
  }),
  /** A sense with a range in feet (darkvision 60); the longest one counts. */
  v.object({
    type: v.literal("sense"),
    sense: v.picklist(SENSES),
    range: v.pipe(v.number(), v.minValue(0)),
    when: v.optional(v.picklist(MODIFIER_CONDITIONS)),
  }),
  /** The number of items a character can be attuned to at once, when it is more than three (Artificer). */
  v.object({ type: v.literal("attunementMax"), value: v.pipe(v.number(), v.integer(), v.minValue(3)) }),
  /** Double proficiency bonus on a skill the character is proficient in. */
  v.object({ type: v.literal("expertise"), skill: v.string() }),
  /**
   * The creature's size, for a species that lets the person pick one (the 2024 Human and Tiefling:
   * Small or Medium) through a `choice` that grants `size`. A species with one size has it in
   * `data.size` instead.
   */
  v.object({ type: v.literal("size"), size: v.picklist(CREATURE_SIZES) }),
  /** The ability score is at least this high (Gauntlets of Ogre Power): it never lowers it. */
  v.object({ type: v.literal("abilityFloor"), ability: AbilitySchema, value: v.number() }),
  /**
   * Attacks with weapons may use this ability instead of Strength or Dexterity (Hex Warrior,
   * Battle Ready). The attack takes the best ability that applies. `when` narrows the weapons:
   * `oneHanded` (without the two-handed property) or `magic` (a magic item). `proficient` asks
   * for a weapon the character is proficient with.
   */
  v.object({
    type: v.literal("weaponAbility"),
    ability: AbilitySchema,
    when: v.optional(v.picklist(["oneHanded", "magic"])),
    proficient: v.optional(v.boolean()),
  }),
  /** Resistance, immunity or vulnerability to a type of damage (`fire`, `poison`...). */
  v.object({
    type: v.literal("defense"),
    kind: v.picklist(["resistance", "immunity", "vulnerability"]),
    damage: v.string(),
  }),
  /**
   * Half the proficiency bonus on ability checks that do not use it (Jack of All Trades,
   * Remarkable Athlete): all abilities, or just those listed.
   */
  v.object({
    type: v.literal("halfProficiency"),
    round: v.picklist(["down", "up"]),
    abilities: v.optional(v.array(AbilitySchema)),
  }),
  /**
   * Armor class without body armor: `base` + Dexterity + the abilities in `add`. Barbarian and
   * monk use 10; a draconic sorcerer 13. `shield` says whether a shield may be carried.
   */
  v.object({
    type: v.literal("unarmoredDefense"),
    base: v.number(),
    add: v.array(AbilitySchema),
    shield: v.boolean(),
    /** Leaves Dexterity out: a tortle's shell is 17 whatever the Dexterity is. */
    noDex: v.optional(v.boolean()),
  }),
  /**
   * A number that a feature shows on the sheet: the save DC of a breath weapon, its dice, the
   * range of a power. The terms of one `name` (of one entry) add up, those that come at a
   * `minLevel` once the level is reached (2 rages at the 1st level, then 1 more at the 3rd). A term
   * with a `bonus` is of a kind that does not stack, as Aurora has it: of the terms of the same
   * `bonus` only the highest counts (an Extra Attack of 2 at the 5th level and 3 at the 11th is
   * 3, not 5). A text term (a damage type) is shown as it is.
   */
  /**
   * The character can use the mastery property of this kind of weapon (an item: a longsword, not
   * one sword). The 2024 fighter, barbarian, paladin, ranger and rogue pick them; the weapon's
   * `mastery` says which property it is.
   */
  v.object({ type: v.literal("weaponMastery"), item: EntryIdSchema }),
  v.object({
    type: v.literal("featureValue"),
    name: v.string(),
    term: FeatureTermSchema,
    minLevel: v.optional(v.number()),
    bonus: v.optional(v.string()),
  }),
  /** The character cannot be affected by this condition (by its slug: `poisoned`, `frightened`). */
  v.object({ type: v.literal("conditionImmunity"), condition: v.string() }),
  /**
   * The Attack action makes this many attacks (an Extra Attack: 2, a fighter's second step 3, the third 4),
   * from the class level `minLevel` if it says one. The Extra Attacks of a character do not add up: the most
   * counts, and the sheet tells it (`attacksPerAction`).
   */
  v.object({
    type: v.literal("extraAttack"),
    attacks: v.pipe(v.number(), v.integer(), v.minValue(2), v.maxValue(8)),
    minLevel: v.optional(v.number()),
  }),
  /**
   * Using the feature heals the character: `dice` (Second Wind: 1d10) plus `perLevel` times the level of the class
   * that gives it (1 for Second Wind, 3 for Wholeness of Body, which has no dice). Play rolls it and takes the hit
   * points back; the uses of the feature are its `uses`.
   */
  v.object({
    type: v.literal("selfHeal"),
    dice: v.optional(v.string()),
    perLevel: v.optional(v.number()),
  }),
  /** The lowest die that is a critical hit with weapon attacks (Champion: 19, then 18). The lowest counts. */
  v.object({
    type: v.literal("critRange"),
    min: v.pipe(v.number(), v.integer(), v.minValue(2), v.maxValue(20)),
  }),
  /**
   * A die lower than `value` counts as `value` on a check: Reliable Talent does it on the ability
   * checks that use a skill the character is proficient in. The highest counts.
   */
  v.object({
    type: v.literal("d20Floor"),
    value: v.pipe(v.number(), v.integer(), v.minValue(2), v.maxValue(20)),
    on: v.picklist(["proficientSkills"]),
  }),
  /**
   * How many times a feature can be used between rests, to be ticked off in play. The terms of an
   * entry add up as those of `featureValue` do (1 + the Charisma modifier); those with a
   * `minLevel` replace one another. `pool` counts it as a number (ki, hit points to heal)
   * rather than a few marks.
   */
  v.object({
    type: v.literal("uses"),
    term: FeatureTermSchema,
    recharge: v.picklist(["short", "long"]),
    minLevel: v.optional(v.number()),
    pool: v.optional(v.boolean()),
    /** The total is at least this many (a bonus of Charisma that cannot go below 1). */
    min: v.optional(v.number()),
  }),
  /**
   * A feature that takes points from a pool the class gives (ki, Channel Divinity, sorcery points,
   * uses of Bardic Inspiration or Wild Shape) each time it is used. `pool` is the kind of the
   * resource (`ClassResource.kind`); the character spends from the one of the class that gives the
   * feature, or from the only one it has. `cost` is how many it takes (1 when it is not written).
   */
  v.object({
    type: v.literal("spends"),
    pool: v.picklist(SPEND_POOLS),
    cost: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(9))),
  }),
  v.object({
    type: v.literal("resource"),
    id: v.string(),
    max: v.pipe(v.number(), v.integer(), v.minValue(0)),
    recharge: v.picklist(["short", "long", "dawn"]),
  }),
]);

/**
 * Effects that hold only while a requirement does. `requires` is written as Aurora writes them:
 * names of entries or flags, `,` for "and", `||` for "or", `!` for "not", brackets to group. It is
 * checked every time the sheet is worked out, against what the character has then.
 */
export type Effect =
  | v.InferOutput<typeof PlainEffectSchema>
  | { type: "when"; requires: string; effects: Effect[] };

export const EffectSchema: v.GenericSchema<Effect> = v.union([
  PlainEffectSchema,
  v.object({
    type: v.literal("when"),
    requires: v.string(),
    effects: v.array(v.lazy(() => EffectSchema)),
  }),
]);

export const ENTRY_KINDS = [
  "species",
  "subspecies",
  "class",
  "subclass",
  "feature",
  "background",
  "trait",
  "spell",
  "item",
  "property",
  "ability",
  "skill",
  "language",
  "feat",
  "proficiency",
  "school",
  "condition",
  "alignment",
  "monster",
  "deity",
  "option",
] as const;

export const EntrySchema = v.object({
  id: EntryIdSchema,
  kind: v.picklist(ENTRY_KINDS),
  parent: v.optional(EntryIdSchema),
  effects: v.optional(v.array(EffectSchema), []),
  /** Kind-specific structured facts (spell level, speed, ...). Never display text. */
  data: v.optional(v.record(v.string(), v.unknown()), {}),
});
export type Entry = v.InferOutput<typeof EntrySchema>;

export const PackManifestSchema = v.object({
  id: v.pipe(v.string(), v.regex(/^[a-z0-9]+$/)),
  ruleset: v.picklist(["srd51", "srd52", "custom"]),
  version: v.string(),
  license: v.string(),
  attribution: v.string(),
});

export const PackSchema = v.pipe(
  v.object({
    manifest: PackManifestSchema,
    entries: v.array(EntrySchema),
  }),
  v.check(
    (pack) => pack.entries.every((e) => e.id.startsWith(`${pack.manifest.id}:`)),
    "Every entry id must start with the pack id",
  ),
  v.check(
    (pack) => pack.entries.every((e) => e.id.split(":")[1]?.startsWith(`${e.kind}/`)),
    "Every entry id must contain its kind: `pack:kind/slug`",
  ),
  v.check(
    (pack) => new Set(pack.entries.map((e) => e.id)).size === pack.entries.length,
    "Entry ids must be unique within a pack",
  ),
);
export type Pack = v.InferOutput<typeof PackSchema>;

/** Parses untrusted pack JSON; throws a ValiError describing the first problems. */
export function parsePack(input: unknown): Pack {
  return v.parse(PackSchema, input);
}

/**
 * Checks that ids referenced by `parent`, `trait`, `grantSpell` and trait/spell choices
 * exist in the given packs. Returns human-readable problems (empty when all resolve).
 */
export function findBrokenReferences(packs: Pack[]): string[] {
  return brokenReferences(packs).map((p) => `${p.from} references missing ${p.ref}`);
}

/** The same check, with the entry that refers and the id it cannot find. */
export function brokenReferences(packs: Pack[]): { from: string; ref: string }[] {
  const known = new Set(packs.flatMap((p) => p.entries.map((e) => e.id)));
  const problems: { from: string; ref: string }[] = [];
  const check = (from: string, ref: string) => {
    if (!known.has(ref)) problems.push({ from, ref });
  };
  for (const entry of packs.flatMap((p) => p.entries)) {
    if (entry.parent) check(entry.id, entry.parent);
    const visit = (effects: Effect[]) => {
      for (const effect of effects) {
        if (effect.type === "trait") check(entry.id, effect.id);
        else if (effect.type === "grantSpell") check(entry.id, effect.spell);
        else if (effect.type === "spellDamage" && effect.spell) check(entry.id, effect.spell);
        else if (effect.type === "when") visit(effect.effects);
        else if (
          effect.type === "choice" &&
          (effect.grants === "spell" || effect.grants === "trait")
        )
          for (const ref of effect.from) check(entry.id, ref);
      }
    };
    visit(entry.effects);
  }
  return problems;
}

import { ABILITIES, CREATURE_SIZES, PROFICIENCY_CATEGORIES } from "../../data/schema";
import { type FieldSpec, type FieldType, checkFields, field } from "./fields";
import type { EntryKind } from "./kinds";

/**
 * What each kind of entry holds in its `data`: the facts the engine and the sheet read besides the
 * effects. The shipped rules, the importer and the homebrew all write this one shape, and a test
 * checks every entry of the shipped packs against it, so it cannot drift from what the app reads.
 * `guided` marks what a beginner is asked for; the rest is shown in the advanced mode.
 */

const text: FieldType = { type: "text" };
const dice: FieldType = { type: "dice" };
const bool: FieldType = { type: "boolean" };
const number: FieldType = { type: "number" };
/** A distance in feet and a weight in pounds: the editor shows them in the units of the pack. */
const feet: FieldType = { type: "number", min: 0, unit: "distance" };
const pounds: FieldType = { type: "number", min: 0, unit: "weight" };
const whole = (min?: number, max?: number): FieldType => ({
  type: "number",
  integer: true,
  ...(min !== undefined && { min }),
  ...(max !== undefined && { max }),
});
const ability: FieldType = { type: "choice", options: ABILITIES };
const abilityKeys: FieldType = { type: "record", of: number, keys: ABILITIES };
const ref = (...kinds: EntryKind[]): FieldType => ({ type: "ref", kinds });
const refs = (...kinds: EntryKind[]): FieldType => ({ type: "list", of: ref(...kinds) });
const list = (of: FieldType): FieldType => ({ type: "list", of });
const object = (...fields: FieldSpec[]): FieldType => ({ type: "object", fields });
const choice = (...options: string[]): FieldType => ({ type: "choice", options });
const json: FieldType = { type: "json" };
/** Text that is one word of a closed list: the editor offers the list as a menu. */
const oneOf = (...options: string[]): FieldType => ({ type: "text", options });

/** A thing a class or background starts with: an item, any item of a category, or gold. */
const STARTING_ITEM: FieldType = {
  type: "union",
  of: [
    object(field("item", ref("item"), { required: true }), field("quantity", number)),
    object(field("category", text, { required: true }), field("count", number)),
    object(field("gold", number, { required: true })),
  ],
};
const STARTING_FIXED: FieldType = list(STARTING_ITEM);
const STARTING_CHOICES: FieldType = list(
  object(
    field(
      "options",
      list(
        object(field("items", list(STARTING_ITEM), { required: true }), field("requires", text)),
      ),
      { required: true },
    ),
  ),
);

/** A requirement of an option or a feat: a level, a feature, a spell, or an ability score. */
const PREREQUISITE: FieldType = {
  type: "union",
  of: [
    object(
      field("type", { type: "literal", value: "level" }, { required: true }),
      field("level", number, { required: true }),
    ),
    object(
      field("type", { type: "literal", value: "feature" }, { required: true }),
      field("feature", ref("feature"), { required: true }),
    ),
    object(
      field("type", { type: "literal", value: "spell" }, { required: true }),
      field("spell", ref("spell"), { required: true }),
    ),
    object(
      field("ability", ability, { required: true }),
      field("minimum", number, { required: true }),
    ),
  ],
};

const SCORE_NEED: FieldType = object(
  field("ability", ability, { required: true }),
  field("minimum", number, { required: true }),
);

const SPELL_TABLES: FieldSpec[] = [
  field("cantripsKnown", number),
  field("spellsKnown", number),
  field("spellSlots", list(number)),
];

const ARMOR_CLASS: FieldType = object(
  field("value", number, { required: true }),
  field("type", text),
  field("armor", list(text)),
  field("spell", text),
  field("condition", text),
  field("plus", text),
);

const RANGE: FieldType = object(
  field("normal", feet, { required: true }),
  field("long", feet, { level: "guided" }),
);
/** A kind of damage, chosen by name from the thirteen of the rules. */
const damageKind: FieldType = { type: "text", pick: "damage" };
const DAMAGE: FieldType = object(
  field("dice", dice, { required: true }),
  field("type", damageKind, { required: true }),
);

const g = "guided" as const;

const ITEM: FieldSpec[] = [
  field(
    "category",
    oneOf("weapon", "armor", "adventuring-gear", "tools", "mounts-and-vehicles", "magic-items"),
    { required: true, level: g },
  ),
  field(
    "cost",
    object(
      field("amount", number, { required: true }),
      field("unit", choice("cp", "sp", "gp"), { required: true }),
    ),
    { required: true, level: g },
  ),
  field("weight", pounds, { level: g }),
  field("rarity", oneOf("common", "uncommon", "rare", "very-rare", "legendary", "artifact"), {
    level: g,
    doc: "A magic item.",
  }),
  field("attunement", bool, {
    level: g,
    doc: "The item asks to be attuned to; at most three are.",
  }),
  field(
    "slot",
    oneOf(
      "head",
      "neck",
      "shoulders",
      "body",
      "arms",
      "hands",
      "ring",
      "waist",
      "feet",
      "shield",
      "oneHand",
      "twoHands",
    ),
    { doc: "Where it is worn or held." },
  ),
  field("enhancement", whole(0, 3), { level: g, doc: "+1 to +3 to attack and damage." }),
  field("copyOf", ref("item"), { doc: "The item a customized copy was made from." }),
  field("magical", bool, { doc: "Counts as magic without a rarity." }),
  field("use", object(field("heal", dice)), {
    doc: "What using the item does when it can be worked out.",
  }),
  field("enchants", bool, {
    doc: "An enchantment put on a weapon of the inventory, not carried by itself.",
  }),
  field(
    "weapon",
    object(
      field("category", choice("simple", "martial"), { required: true }),
      field("kind", choice("melee", "ranged"), { required: true }),
      field("damage", DAMAGE),
      field("twoHandedDamage", DAMAGE, { level: g }),
      field("properties", list({ type: "ref", kinds: ["property"], mastery: false }), {
        required: true,
      }),
      field("range", RANGE, { required: true }),
      field("throwRange", RANGE),
      field("mastery", { type: "ref", kinds: ["property"], mastery: true }),
      field("proficiency", list({ type: "text", pick: "weaponProf" }), {
        required: true,
        level: "advanced",
      }),
    ),
    { level: g },
  ),
  field(
    "armor",
    object(
      field("category", choice("light", "medium", "heavy", "shield"), { required: true }),
      field("base", number, { required: true }),
      field("dexBonus", bool, { required: true }),
      field("maxDexBonus", number, { level: g }),
      field("strengthMinimum", number, { required: true }),
      field("stealthDisadvantage", bool, { required: true }),
      field("properties", list({ type: "ref", kinds: ["property"], mastery: false }), {
        level: g,
      }),
      field("proficiency", list({ type: "text", pick: "armorProf" }), {
        required: true,
        level: "advanced",
      }),
    ),
    { level: g },
  ),
  field(
    "gear",
    object(
      field(
        "category",
        oneOf(
          "standard-gear",
          "kits",
          "equipment-packs",
          "ammunition",
          "arcane-foci",
          "druidic-foci",
          "holy-symbols",
          "poisons",
        ),
      ),
      field("bundleSize", number),
      field(
        "contents",
        list(
          object(
            field("item", ref("item"), { required: true }),
            field("quantity", number, { required: true }),
          ),
        ),
      ),
    ),
  ),
  field(
    "tool",
    object(
      field(
        "category",
        oneOf("artisans-tools", "musical-instruments", "gaming-sets", "other-tools"),
      ),
    ),
  ),
  field(
    "vehicle",
    object(
      field(
        "category",
        oneOf("mounts-and-other-animals", "tack-harness-and-drawn-vehicles", "waterborne-vehicles"),
      ),
      field(
        "speed",
        object(
          field("amount", number, { required: true }),
          field("unit", text, { required: true }),
        ),
      ),
      field("crew", json),
      field("passengers", json),
      field("cargo", json),
      field("armorClass", number),
      field("hitPoints", number),
      field("damageThreshold", number),
    ),
  ),
  field("poison", object(field("delivery", choice("ingested", "inhaled", "contact", "injury")))),
];

/** What the game reads of a trait or an action of a stat block (its name and text are texts of the pack). */
export const MONSTER_ACTION_FIELDS: FieldSpec[] = [
  field("attackBonus", number),
  field(
    "damage",
    list(
      object(
        field("type", damageKind, { required: true }),
        field("dice", dice, { required: true }),
      ),
    ),
  ),
  field(
    "dc",
    object(
      field("ability", ability),
      field("value", number),
      field("onSave", { type: "text", options: ["none", "half"] }),
    ),
  ),
  field("usage", json, { doc: "How often it can be used (per day, recharge...)." }),
  field("multiattack", json, {
    doc: "The attacks of a multiattack: the position of each action and how many times.",
  }),
  field("spellcasting", json),
];
const MONSTER_ACTION: FieldType = object(...MONSTER_ACTION_FIELDS);

const MONSTER: FieldSpec[] = [
  field("size", oneOf(...CREATURE_SIZES), { level: g }),
  field(
    "type",
    oneOf(
      "aberration",
      "beast",
      "celestial",
      "construct",
      "dragon",
      "elemental",
      "fey",
      "fiend",
      "giant",
      "humanoid",
      "monstrosity",
      "ooze",
      "plant",
      "undead",
    ),
    { level: g },
  ),
  field("subtype", text),
  field("swarm", text),
  field("armorClass", list(ARMOR_CLASS), { level: g }),
  field("hitPoints", number, { level: g }),
  field("hitDice", text),
  field("hitPointsRoll", text),
  field(
    "speed",
    { type: "record", of: { type: "union", of: [number, { type: "literal", value: true }] } },
    { level: g },
  ),
  field("abilities", abilityKeys, { level: g }),
  field("saves", abilityKeys),
  field("skills", { type: "record", of: number }),
  field("conditionImmunities", list(text)),
  field("damageVulnerabilities", list(text)),
  field("damageResistances", list(text)),
  field("damageImmunities", list(text)),
  field("senses", { type: "record", of: feet }),
  field("blindBeyond", list(text)),
  field("passivePerception", number),
  field("challenge", number, { level: g }),
  field("xp", number),
  field("proficiencyBonus", number),
  field("special", list(MONSTER_ACTION), {
    doc: "Traits of the creature; their texts are `special.N.name|desc`.",
  }),
  field("actions", list(MONSTER_ACTION)),
  field("bonusActions", list(MONSTER_ACTION)),
  field("reactions", list(MONSTER_ACTION)),
  field("legendary", list(MONSTER_ACTION)),
  field("forms", json, { doc: "The creatures a shapechanger can become." }),
];

/** The `data` fields of every kind of entry. A kind added to the schema fails to compile until it is listed. */
export const DATA_FIELDS: Record<EntryKind, FieldSpec[]> = {
  species: [
    field("speed", { ...(whole(0) as object), unit: "distance" } as FieldType, {
      required: true,
      level: g,
    }),
    field("size", choice(...CREATURE_SIZES), {
      level: g,
      doc: "Absent when the species lets the person pick a size (a `size` choice).",
    }),
  ],
  subspecies: [
    field("replacesSpecies", bool, {
      doc: "Stands in for its species: the species' own effects are not applied.",
    }),
    field("speed", { ...(whole(0) as object), unit: "distance" } as FieldType),
    field("size", choice(...CREATURE_SIZES)),
  ],
  class: [
    field("hitDie", whole(4, 20), { required: true, level: g }),
    field("primaryAbility", list(ability), { level: g }),
    field(
      "multiclassing",
      object(
        field("prerequisites", list(SCORE_NEED), { required: true }),
        field(
          "prerequisiteOptions",
          object(
            field("choose", number, { required: true }),
            field("from", list(SCORE_NEED), { required: true }),
          ),
        ),
        field("proficiencies", list(text), { required: true }),
        field("proficiencyChoices", list(json)),
      ),
      { required: true },
    ),
    field(
      "levels",
      list(
        object(
          field("level", whole(1, 20), { required: true }),
          field("features", refs("feature"), { required: true }),
          field("abilityScoreImprovements", number, { required: true }),
          ...SPELL_TABLES,
          field("classSpecific", { type: "record", of: json }),
        ),
      ),
      { required: true },
    ),
    field(
      "spellcasting",
      object(
        field("ability", ability, { required: true }),
        field("startsAtLevel", number, { required: true }),
        field("pact", bool),
        field("slots", choice("none"), {
          doc: "none: the class casts without spell slots; its spells cost points of `reserve`.",
        }),
        field("reserve", text, {
          doc: "The reserve of the pack that a class without slots pays from.",
        }),
        field("maxLevel", json, {
          doc: 'For a class without slots: "half" (half the class level, rounded up) or { column } of the class table.',
        }),
        field("limit", text, {
          doc: "A column of the class table: the most points one spell can take.",
        }),
        field(
          "preparation",
          {
            type: "variant",
            on: "type",
            cases: {
              known: [],
              prepared: [
                field("levelDivisor", number, { required: true }),
                field("fromTable", bool),
              ],
              spellbook: [
                field("initial", number, { required: true }),
                field("perLevel", number, { required: true }),
                field("fromTable", bool),
              ],
            },
          },
          { required: true },
        ),
      ),
      { level: g },
    ),
    field("startingEquipment", STARTING_FIXED),
    field("startingChoices", STARTING_CHOICES),
    field(
      "startingWealth",
      object(
        field("dice", dice, { required: true }),
        field("multiplier", number, { required: true }),
      ),
    ),
  ],
  subclass: [
    field(
      "levels",
      list(
        object(
          field("level", whole(1, 20), { required: true }),
          field("features", refs("feature"), { required: true }),
          ...SPELL_TABLES,
          field("subclassSpecific", { type: "record", of: json }),
        ),
      ),
      { required: true },
    ),
    field(
      "spells",
      list(
        object(
          field("spell", ref("spell"), { required: true }),
          field("classLevel", number, { required: true }),
        ),
      ),
      { required: true, level: g },
    ),
    field("expanded", refs("spell")),
    field(
      "spellcasting",
      object(
        field("ability", ability, { required: true }),
        field("list", ref("class"), { required: true }),
        field("schools", list({ type: "slug", kind: "school" })),
        field("startsAtLevel", number, { required: true }),
        field("kind", choice("full", "half", "third", "pact"), { required: true }),
      ),
    ),
  ],
  feature: [
    field("class", ref("class"), { doc: "The class that gives it." }),
    field("subclass", ref("subclass"), { doc: "The subclass that gives it." }),
    field("level", whole(1, 20), { level: g }),
    field("activation", text, {
      level: g,
      doc: "action, bonus or reaction: how it is used in play.",
    }),
    field("hiddenByDefault", bool),
    field("replaces", refs("feature"), { doc: "Features it makes obsolete." }),
    field("prerequisites", list(PREREQUISITE)),
    field("requires", text, { doc: "A requirement, written as Aurora writes it." }),
    field("featureSpecific", json),
  ],
  background: [
    field(
      "choose",
      { type: "record", of: number },
      { doc: "How many of each personality table the player picks." },
    ),
    field(
      "startingGold",
      object(
        field("quantity", number, { required: true }),
        field("unit", text, { required: true }),
      ),
    ),
    field("startingEquipment", STARTING_FIXED),
    field("startingChoices", STARTING_CHOICES),
    field("abilityScores", list(ability), { level: g }),
    field("feat", ref("feat"), { level: g }),
  ],
  trait: [
    field("activation", text, { level: g }),
    field("class", ref("class")),
    field("traitSpecific", json, {
      doc: "Numbers of the trait's mechanics, like a breath weapon.",
    }),
  ],
  feat: [
    field("category", oneOf("origin", "general", "fighting-style", "epic-boon"), { level: g }),
    field("builtIn", bool),
    field("prerequisites", list(PREREQUISITE), { level: g }),
    field("requires", text),
    field("requirements", text),
    field("featureNamed", json),
  ],
  option: [
    field("replaces", refs("feature", "trait", "option"), {
      doc: "Entries it takes the place of; they are hidden unless shown again.",
    }),
    field("backgroundFeature", bool, {
      doc: "A text-only option that stands in for the feature of the background.",
    }),
    field("prerequisites", list(PREREQUISITE)),
    field("requires", text),
  ],
  deity: [field("alignment", ref("alignment"), { level: g }), field("domains", text, { level: g })],
  spell: [
    field("level", whole(0, 9), { required: true, level: g }),
    field("school", { type: "slug", kind: "school" }, { required: true, level: g }),
    field("components", list(text), {
      required: true,
      level: g,
      doc: "V, S, M, or a component code the pack declares.",
    }),
    field("ritual", bool, { required: true, level: g }),
    field("concentration", bool, { required: true, level: g }),
    field("classes", refs("class"), { required: true, level: g }),
    field("pointCost", number, {
      doc: "Points it takes from the reserve of a class that casts without slots (its level when absent).",
    }),
    field("attackType", choice("melee", "ranged"), {
      doc: "The spell is cast with an attack roll.",
    }),
    field(
      "damage",
      list(
        object(
          field("damageType", object(field("index", damageKind, { required: true }))),
          field("damageAtSlotLevel", { type: "record", of: dice, levels: "slot" }),
          field("damageAtCharacterLevel", { type: "record", of: dice, levels: "character" }),
        ),
      ),
    ),
    field(
      "dc",
      object(
        field("dcType", object(field("index", text, { required: true })), { required: true }),
        field("dcSuccess", text),
        field("desc", text),
      ),
    ),
    field("healAtSlotLevel", { type: "record", of: dice, levels: "slot" }),
    field("areaOfEffect", object(field("type", text), field("size", number))),
  ],
  item: ITEM,
  property: [field("mastery", bool, { doc: "A weapon mastery property of the 2024 rules." })],
  language: [field("type", oneOf("standard", "exotic"), { level: g })],
  monster: MONSTER,
  skill: [field("ability", ability, { required: true })],
  proficiency: [
    field("category", choice(...PROFICIENCY_CATEGORIES), { required: true }),
    field("target", text, { required: true }),
  ],
  ability: [],
  school: [],
  condition: [
    field(
      "color",
      { type: "text", pick: "color" },
      {
        level: g,
        doc: "The glow at the edges of the play screen while the condition lasts: a colour name or #rrggbb.",
      },
    ),
  ],
  alignment: [],
  reserve: [
    field("recharge", choice("long", "short"), {
      level: g,
      doc: "When the points of the reserve come back: after a long rest or after a short one.",
    }),
  ],
  damage: [],
  component: [
    field("code", text, {
      required: true,
      level: g,
      doc: "The short code of the component (one to three letters or digits, such as A or O), ticked in the form of a spell.",
    }),
  ],
};

/** What is wrong with the `data` of an entry of a kind (empty when it fits what the engine reads). */
export function checkData(kind: EntryKind, data: unknown): string[] {
  return checkFields(DATA_FIELDS[kind], data);
}

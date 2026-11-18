import * as v from "valibot";
import { AbilitySchema, EffectSchema } from "../data/schema";
import {
  CHARACTER_SCHEMA_VERSION,
  type Character,
  createPlayState,
  createStory,
} from "./character";
import { BOARD_SLOTS } from "./slots";

const ClassLevelSchema = v.object({
  classId: v.string(),
  level: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(20)),
  subclassId: v.optional(v.string()),
  hpRolls: v.optional(v.array(v.number())),
});

const CoinCount = v.pipe(v.number(), v.integer(), v.minValue(0));

const InventoryItemSchema = v.object({
  itemId: v.string(),
  quantity: v.pipe(v.number(), v.integer(), v.minValue(1)),
  equipped: v.boolean(),
  slot: v.optional(v.picklist(BOARD_SLOTS)),
  custom: v.optional(
    v.object({
      name: v.pipe(v.string(), v.minLength(1), v.maxLength(80)),
      weight: v.optional(v.pipe(v.number(), v.minValue(0))),
      note: v.optional(v.string()),
    }),
  ),
  magical: v.optional(v.boolean()),
  bonus: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(3))),
  enchantment: v.optional(v.string()),
});

const CharacterSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  schemaVersion: v.literal(CHARACTER_SCHEMA_VERSION),
  ruleset: v.picklist(["srd51", "srd52"]),
  name: v.string(),
  portrait: v.optional(v.pipe(v.string(), v.startsWith("data:image/"), v.maxLength(200000))),
  choices: v.object({
    species: v.optional(v.string()),
    subspecies: v.optional(v.string()),
    background: v.optional(v.string()),
  }),
  classes: v.array(ClassLevelSchema),
  inventory: v.array(InventoryItemSchema),
  coins: v.optional(
    v.object({
      cp: CoinCount,
      sp: CoinCount,
      ep: CoinCount,
      gp: CoinCount,
      pp: CoinCount,
    }),
  ),
  /** Creatures the character has: a familiar, a beast, a defender. */
  companions: v.optional(
    v.array(
      v.object({
        id: v.string(),
        monster: v.string(),
        name: v.optional(v.string()),
        hp: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
        maxHp: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
      }),
    ),
  ),
  /** The Beast forms a 2024 druid knows for Wild Shape (monster ids). */
  wildShapeForms: v.optional(v.array(v.string())),
  /** The optional rules switched on for this character (ids of `option` entries). */
  options: v.optional(v.array(v.string())),
  /** Features the person wrote for this character. */
  custom: v.optional(
    v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        text: v.string(),
        uses: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(99))),
        recharge: v.optional(v.picklist(["short", "long"])),
      }),
    ),
  ),
  /** What the person decided about features, traits and feats, by entry id. */
  featureSettings: v.optional(
    v.record(
      v.string(),
      v.object({
        uses: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(99))),
        recharge: v.optional(v.picklist(["short", "long"])),
        hidden: v.optional(v.boolean()),
      }),
    ),
  ),
  abilityBase: v.object({
    str: v.number(),
    dex: v.number(),
    con: v.number(),
    int: v.number(),
    wis: v.number(),
    cha: v.number(),
  }),
  abilityMethod: v.picklist(["manual", "standard", "pointbuy", "roll"]),
  abilityRolls: v.optional(v.array(v.number())),
  selections: v.record(v.string(), v.array(v.string())),
  spells: v.record(
    v.string(),
    v.object({
      cantrips: v.array(v.string()),
      known: v.array(v.string()),
      prepared: v.array(v.string()),
    }),
  ),
  story: v.object({
    alignment: v.optional(v.string()),
    deity: v.optional(v.string()),
    personalityTraits: v.string(),
    ideals: v.string(),
    bonds: v.string(),
    flaws: v.string(),
    appearance: v.string(),
    backstory: v.string(),
    allies: v.string(),
    enemies: v.string(),
    notes: v.string(),
    age: v.string(),
    height: v.string(),
    weight: v.string(),
    eyes: v.string(),
    skin: v.string(),
    hair: v.string(),
  }),
  play: v.object({
    hp: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
    tempHp: v.pipe(v.number(), v.integer(), v.minValue(0)),
    hitDiceUsed: v.record(v.string(), v.pipe(v.number(), v.integer(), v.minValue(0))),
    slotsUsed: v.pipe(v.array(v.pipe(v.number(), v.integer(), v.minValue(0))), v.length(9)),
    createdSlots: v.optional(
      v.pipe(v.array(v.pipe(v.number(), v.integer(), v.minValue(0))), v.length(9)),
    ),
    resourcesUsed: v.optional(v.record(v.string(), v.pipe(v.number(), v.integer(), v.minValue(0)))),
    concentration: v.optional(v.string()),
    raging: v.optional(v.boolean()),
    exhaustion: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(6))),
    wildShape: v.optional(
      v.object({
        monster: v.string(),
        hp: v.pipe(v.number(), v.integer(), v.minValue(0)),
        max: v.pipe(v.number(), v.integer(), v.minValue(0)),
        // The 2024 rules: the druid keeps their own hit points, so the shape has none (hp and max are 0).
        own: v.optional(v.boolean()),
      }),
    ),
    pactUsed: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
    deathSaves: v.object({
      successes: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(3)),
      failures: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(3)),
    }),
    conditions: v.array(v.string()),
    rounds: v.optional(
      v.record(v.string(), v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(999))),
    ),
    inspiration: v.boolean(),
    bardicDie: v.optional(v.picklist([4, 6, 8, 10, 12])),
    shillelagh: v.optional(v.string()),
    sacredWeapon: v.optional(v.string()),
    magicWeapon: v.optional(
      v.object({
        itemId: v.string(),
        bonus: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(3)),
      }),
    ),
    activeSpells: v.optional(v.array(v.string())),
    customEffects: v.optional(
      v.array(v.object({ id: v.string(), name: v.string(), effects: v.array(EffectSchema) })),
    ),
  }),
  asi: v.array(v.pipe(v.array(AbilitySchema), v.minLength(1), v.maxLength(2))),
  feats: v.array(v.string()),
  overrides: v.record(v.string(), v.union([v.number(), v.string(), v.boolean()])),
  /** Defenses the person wrote by hand in Free edit: they are added to what the rules give. */
  extraDefenses: v.optional(
    v.array(
      v.object({
        kind: v.picklist(["resistance", "immunity", "vulnerability", "reduction"]),
        damage: v.optional(v.string()),
        amount: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(999))),
        note: v.optional(v.string()),
      }),
    ),
  ),
});

/**
 * Upgrades a character saved by an older version, one version at a time.
 * `migrations[n]` turns a version-n document into version n + 1. Never edit an existing
 * migration: saved characters from every released version must keep opening.
 */
const migrations: Record<number, (doc: Record<string, unknown>) => Record<string, unknown>> = {
  // 1 -> 2: guided choices. Ability scores stay as entered (manual); no picks or ASIs yet.
  1: (doc) => ({ ...doc, abilityMethod: "manual", selections: {}, asi: [] }),
  // 2 -> 3: spell picks per class.
  2: (doc) => ({ ...doc, spells: {} }),
  // 3 -> 4: play state (hit points, spent resources, conditions).
  3: (doc) => ({ ...doc, play: createPlayState() }),
  // 4 -> 5: the character's story (personality, appearance, notes).
  4: (doc) => ({ ...doc, story: createStory() }),
  // 5 -> 6: feats, taken in place of ability score improvements.
  5: (doc) => ({ ...doc, feats: [] }),
};

export class CharacterParseError extends Error {}

/** Validates untrusted data (storage, an imported file) and migrates it to the current version. */
export function parseCharacter(raw: unknown): Character {
  if (typeof raw !== "object" || raw === null) throw new CharacterParseError("Not an object");
  let doc = { ...(raw as Record<string, unknown>) };
  let version = doc.schemaVersion;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1)
    throw new CharacterParseError("Missing schemaVersion");
  if (version > CHARACTER_SCHEMA_VERSION)
    throw new CharacterParseError(`Saved by a newer version (${version})`);
  while (version < CHARACTER_SCHEMA_VERSION) {
    const migrate = migrations[version];
    if (!migrate) throw new CharacterParseError(`No migration from version ${version}`);
    doc = migrate(doc);
    version += 1;
    doc.schemaVersion = version;
  }
  const result = v.safeParse(CharacterSchema, doc);
  if (!result.success) {
    const first = result.issues[0];
    throw new CharacterParseError(`Invalid character: ${first?.message ?? "unknown problem"}`);
  }
  return result.output as Character;
}

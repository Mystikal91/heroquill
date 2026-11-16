import * as v from "valibot";
import { AbilitySchema, type Entry, EntryIdSchema } from "./schema";

const ScoreRequirementSchema = v.object({
  ability: AbilitySchema,
  minimum: v.number(),
});

const LevelRowSchema = v.object({
  level: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(20)),
  /** Features gained at this level (class features only; no cumulative list). */
  features: v.array(EntryIdSchema),
  /** Cumulative number of ability score improvements available at this level. */
  abilityScoreImprovements: v.number(),
  cantripsKnown: v.optional(v.number()),
  spellsKnown: v.optional(v.number()),
  /** Spell slots for spell levels 1..9. */
  spellSlots: v.optional(v.array(v.number())),
  classSpecific: v.optional(v.record(v.string(), v.unknown()), {}),
});
export type LevelRow = v.InferOutput<typeof LevelRowSchema>;

/** The parts of a `class` entry's `data` that the engine reads. */
export const ClassDataSchema = v.object({
  hitDie: v.number(),
  spellcasting: v.optional(
    v.object({
      ability: AbilitySchema,
      startsAtLevel: v.number(),
      /** Pact Magic: slots all of one level, regained on a short rest. */
      pact: v.optional(v.boolean()),
      /**
       * A class that casts without spell slots: the spells it knows cost points of a reserve (`reserve`),
       * and the highest spell level it can know is `maxLevel` (half the class level, rounded up, or a
       * column of the class table). `limit` is a column of the class table too: the most points one
       * spell can take.
       */
      slots: v.optional(v.literal("none")),
      reserve: v.optional(v.string()),
      maxLevel: v.optional(v.union([v.literal("half"), v.object({ column: v.string() })])),
      limit: v.optional(v.string()),
      preparation: v.variant("type", [
        v.object({ type: v.literal("known") }),
        v.object({
          type: v.literal("prepared"),
          levelDivisor: v.number(),
          /** The number of prepared spells is the class table's (`spellsKnown` of the level row), as in 2024. */
          fromTable: v.optional(v.boolean()),
        }),
        v.object({
          type: v.literal("spellbook"),
          initial: v.number(),
          perLevel: v.number(),
          /** The number of prepared spells is the class table's, as in 2024. */
          fromTable: v.optional(v.boolean()),
        }),
      ]),
    }),
  ),
  multiclassing: v.object({
    /** All of these must be met. */
    prerequisites: v.array(ScoreRequirementSchema),
    /** At least `choose` of these must be met. */
    prerequisiteOptions: v.optional(
      v.object({ choose: v.number(), from: v.array(ScoreRequirementSchema) }),
    ),
    /** `category:target` proficiencies gained when multiclassing into this class. */
    proficiencies: v.array(v.string()),
  }),
  levels: v.array(LevelRowSchema),
});
export type ClassData = v.InferOutput<typeof ClassDataSchema>;

/** The parts of a `subclass` entry's `data` that the engine reads. */
export const SubclassDataSchema = v.object({
  levels: v.array(
    v.object({
      level: v.number(),
      features: v.array(EntryIdSchema),
      /** For a subclass that casts spells: the tables of its levels, like a class's. */
      cantripsKnown: v.optional(v.number()),
      spellsKnown: v.optional(v.number()),
      spellSlots: v.optional(v.array(v.number())),
    }),
  ),
  /** Spells always prepared once the class reaches `classLevel`. */
  spells: v.array(v.object({ spell: EntryIdSchema, classLevel: v.number() })),
  /** Spells added to what the class can pick from (a warlock patron's expanded list). */
  expanded: v.optional(v.array(EntryIdSchema), []),
  /**
   * A subclass that gives a class without spellcasting its own (Eldritch Knight, Arcane
   * Trickster): the class whose list it picks from, and how its slots join a multiclass.
   */
  spellcasting: v.optional(
    v.object({
      ability: AbilitySchema,
      list: EntryIdSchema,
      /**
       * School slugs the spells known come from (abjuration and evocation for the Eldritch Knight),
       * except for the few picks the rules leave free. Empty or absent: any school.
       */
      schools: v.optional(v.array(v.string())),
      startsAtLevel: v.number(),
      kind: v.picklist(["full", "half", "third", "pact"]),
    }),
  ),
});
export type SubclassData = v.InferOutput<typeof SubclassDataSchema>;

export function classData(entry: Entry): ClassData {
  return v.parse(ClassDataSchema, entry.data);
}

export function subclassData(entry: Entry): SubclassData {
  return v.parse(SubclassDataSchema, entry.data);
}

import * as v from "valibot";
import { type Entry, EntryIdSchema } from "./schema";

const DamageSchema = v.object({ dice: v.string(), type: v.string() });
const RangeSchema = v.object({ normal: v.number(), long: v.optional(v.number()) });

const WeaponSchema = v.object({
  category: v.picklist(["simple", "martial"]),
  kind: v.picklist(["melee", "ranged"]),
  damage: v.optional(DamageSchema),
  twoHandedDamage: v.optional(DamageSchema),
  /** Weapon property ids, e.g. `srd51:property/finesse`. */
  properties: v.array(EntryIdSchema),
  range: RangeSchema,
  throwRange: v.optional(RangeSchema),
  /** The 2024 mastery property (a `property` entry) of the weapon, used by whoever has mastered it. */
  mastery: v.optional(EntryIdSchema),
  /** Any one of these `category:target` proficiencies makes the wielder proficient. */
  proficiency: v.array(v.string()),
});

const ArmorSchema = v.object({
  category: v.picklist(["light", "medium", "heavy", "shield"]),
  base: v.number(),
  dexBonus: v.boolean(),
  maxDexBonus: v.optional(v.number()),
  strengthMinimum: v.number(),
  stealthDisadvantage: v.boolean(),
  /** Properties of the armor, with a text each (the ones a person writes); they change no number. */
  properties: v.optional(v.array(EntryIdSchema)),
  proficiency: v.array(v.string()),
});

/** The parts of an `item` entry's `data` that the engine reads. */
export const ItemDataSchema = v.object({
  category: v.string(),
  cost: v.object({ amount: v.number(), unit: v.picklist(["cp", "sp", "gp"]) }),
  weight: v.optional(v.number()),
  /** Present on a magic item: how rare it is. */
  rarity: v.optional(v.string()),
  /** Where it is worn or held (see `ITEM_SLOTS`): Aurora's `slot`, written by hand for the magic items of the SRD. */
  slot: v.optional(v.string()),
  /** A bonus to attack and damage rolls (+1, +2, +3) that a magic weapon gives. */
  enhancement: v.optional(v.number()),
  /** The id of the item a person's copy was made from (a customized club is still a club for Shillelagh). */
  copyOf: v.optional(v.string()),
  /** The item is magic without a rarity (a weapon a person made magic): it hurts what resists plain weapons. */
  magical: v.optional(v.boolean()),
  /** What using the item does when it can be worked out: the dice of the hit points it restores. */
  use: v.optional(v.object({ heal: v.optional(v.string()) })),
  /** The item is not carried by itself: it is an enchantment put on a weapon in the inventory. */
  enchants: v.optional(v.boolean()),
  weapon: v.optional(WeaponSchema),
  armor: v.optional(ArmorSchema),
  /** Gear that is not a weapon or armor: an equipment pack lists what it holds in `contents`. */
  gear: v.optional(
    v.object({
      category: v.optional(v.string()),
      contents: v.optional(v.array(v.object({ item: v.string(), quantity: v.number() }))),
    }),
  ),
});
export type ItemData = v.InferOutput<typeof ItemDataSchema>;
export type WeaponData = v.InferOutput<typeof WeaponSchema>;
export type ArmorData = v.InferOutput<typeof ArmorSchema>;

export function itemData(entry: Entry): ItemData {
  return v.parse(ItemDataSchema, entry.data);
}

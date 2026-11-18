import type { Effect, Entry } from "../data/schema";
import type { UserPackRecord } from "../storage/packs";
import { DATA_FIELDS } from "./catalog/data";
import { EFFECT_TYPES, effectFields } from "./catalog/effects";
import type { EffectType } from "./catalog/effects";
import type { FieldSpec, FieldType } from "./catalog/fields";
import type { EntryKind } from "./catalog/kinds";
import { addEntry, newEntryId } from "./entries";

/**
 * A value that is valid for a field and says nothing yet: what a new entry starts with, so the
 * engine can read it from the first moment. `undefined` for what cannot have a default (a pointer
 * to another entry): the person has to pick it.
 */
export function defaultFor(type: FieldType): unknown {
  switch (type.type) {
    case "text":
    case "dice":
    case "slug":
      return "";
    case "number":
      return type.min ?? 0;
    case "boolean":
      return false;
    case "choice":
      return type.options[0];
    case "literal":
      return type.value;
    case "list":
    case "effects":
      return [];
    case "record":
      return {};
    case "object":
      return requiredFields(type.fields);
    case "union":
      return type.of[0] ? defaultFor(type.of[0]) : undefined;
    case "variant": {
      const [tag] = Object.keys(type.cases);
      return tag === undefined
        ? undefined
        : { [type.on]: tag, ...requiredFields(type.cases[tag] ?? []) };
    }
    default:
      return undefined;
  }
}

/** An object holding the required fields of a list of specs, each with its default. */
export function requiredFields(fields: FieldSpec[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const spec of fields) {
    if (spec.optional) continue;
    const value = defaultFor(spec.type);
    if (value !== undefined) out[spec.key] = value;
  }
  return out;
}

/** A new effect of a type, with its required fields filled in with something valid. */
export function blankEffect(type: EffectType): Effect {
  const fields = requiredFields(effectFields(type));
  // A few that are better with a meaningful start than with the first option.
  const better: Partial<Record<EffectType, Record<string, unknown>>> = {
    abilityBonus: { ability: "str", value: 1 },
    modifier: { target: "ac", value: 1 },
    proficiency: { category: "skill", target: "" },
    movement: { mode: "fly", feet: 30 },
    sense: { sense: "darkvision", range: 60 },
    defense: { kind: "resistance", damage: "fire" },
    uses: { term: 1, recharge: "long" },
  };
  return { type, ...fields, ...better[type] } as Effect;
}

/** What a new entry of a kind starts with in its `data`. Variants only differ for items. */
export type Variant = "weapon" | "armor" | "gear" | "magic" | "enchantment";

const DEFAULT_ASI = [4, 8, 12, 16, 19];

function classLevels() {
  return Array.from({ length: 20 }, (_, i) => ({
    level: i + 1,
    features: [] as string[],
    abilityScoreImprovements: DEFAULT_ASI.filter((l) => l <= i + 1).length,
    classSpecific: {},
  }));
}

export function blankData(kind: EntryKind, variant?: Variant): Record<string, unknown> {
  const base = Object.fromEntries(
    Object.entries(requiredFields(DATA_FIELDS[kind])).filter(([, v]) => v !== undefined),
  );
  const cost = { amount: 0, unit: "gp" };
  switch (kind) {
    case "spell":
      return { ...base, school: "evocation", components: ["V", "S"] };
    case "species":
      return { ...base, speed: 30, size: "medium" };
    case "class":
      return { ...base, hitDie: 8, levels: classLevels() };
    case "language":
      return { type: "standard" };
    case "feature":
      return { level: 1 };
    case "skill":
      return { ability: "str" };
    case "reserve":
      return { recharge: "long" };
    case "monster":
      return {
        size: "medium",
        type: "humanoid",
        armorClass: [{ value: 10 }],
        hitPoints: 10,
        speed: { walk: 30 },
        abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        challenge: 0,
      };
    case "item":
      switch (variant) {
        case "weapon":
          return {
            category: "weapon",
            cost,
            weapon: {
              category: "simple",
              kind: "melee",
              damage: { dice: "1d6", type: "slashing" },
              properties: [],
              range: { normal: 5 },
              proficiency: ["weapon:simple-weapons"],
            },
          };
        case "armor":
          return {
            category: "armor",
            cost,
            armor: {
              category: "light",
              base: 11,
              dexBonus: true,
              strengthMinimum: 0,
              stealthDisadvantage: false,
              proficiency: ["armor:light-armor"],
            },
          };
        case "enchantment":
          return {
            category: "magic-items",
            cost: { amount: 0, unit: "gp" },
            rarity: "uncommon",
            enhancement: 1,
            enchants: true,
          };
        case "magic":
          return { category: "magic-items", cost, rarity: "uncommon", attunement: false };
        default:
          return { category: "adventuring-gear", cost, gear: { category: "standard-gear" } };
      }
    default:
      return base;
  }
}

/** Starts a new entry of a kind in the pack, empty but valid; returns the new record and the entry's id. */
export function startEntry(
  record: UserPackRecord,
  kind: EntryKind,
  variant?: Variant,
): { record: UserPackRecord; id: string } {
  const id = newEntryId(record, kind, "");
  const entry: Entry = { id, kind, effects: [], data: blankData(kind, variant) };
  return { record: addEntry(record, entry), id };
}

export { EFFECT_TYPES };

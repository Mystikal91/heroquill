import type { Entry } from "../../data/schema";
import type { EntryKind } from "../../homebrew/catalog";

/**
 * How the editor lays out a kind: which texts it has besides the name, which fields of its data a
 * beginner is shown, whether it carries effects, and what it owns. Everything else of the catalog
 * is in the advanced mode, so no field is out of reach.
 */
export interface Layout {
  /** Texts of the entry shown as boxes (`desc` and the like); `[name, area]` pairs. */
  texts: [string, boolean][];
  /** The keys of `data` shown in the guided mode. */
  guided: (entry: Entry) => string[];
  /** The effects builder is shown. */
  effects: boolean;
  /** What the entry owns and the editor lists inside it. */
  owns?: "trait" | "feature";
  /** The kind of entry the one being edited belongs to (`parent`), when it has one. */
  parent?: EntryKind;
  /** Tables of texts, one per line (the personality of a background), with how many the player picks. */
  tables?: [string, number][];
}

const desc: [string, boolean][] = [["desc", true]];

const none = () => [] as string[];

export const LAYOUTS: Record<EntryKind, Layout> = {
  species: { texts: desc, guided: () => ["speed", "size"], effects: true, owns: "trait" },
  subspecies: {
    texts: desc,
    guided: () => ["replacesSpecies"],
    effects: true,
    owns: "trait",
    parent: "species",
  },
  class: {
    texts: desc,
    guided: () => ["hitDie", "primaryAbility", "spellcasting"],
    effects: true,
    owns: "feature",
  },
  subclass: {
    texts: desc,
    guided: () => ["spells"],
    effects: true,
    owns: "feature",
    parent: "class",
  },
  feature: { texts: desc, guided: () => ["activation"], effects: true },
  background: {
    texts: [
      ["desc", true],
      ["featureName", false],
      ["featureDesc", true],
    ],
    guided: () => ["abilityScores", "feat"],
    effects: true,
    tables: [
      ["personalityTraits", 2],
      ["ideals", 1],
      ["bonds", 1],
      ["flaws", 1],
    ],
  },
  trait: { texts: desc, guided: () => ["activation"], effects: true },
  feat: { texts: desc, guided: () => ["category", "prerequisites"], effects: true },
  option: { texts: desc, guided: none, effects: true },
  deity: { texts: desc, guided: () => ["alignment", "domains"], effects: false },
  spell: { texts: desc, guided: none, effects: false },
  item: {
    texts: desc,
    effects: true,
    guided: (entry) => {
      const data = entry.data as {
        weapon?: unknown;
        armor?: unknown;
        rarity?: unknown;
        category?: unknown;
      };
      const magic = data.category === "magic-items" || data.rarity !== undefined;
      return [
        "cost",
        "weight",
        ...(data.weapon ? ["weapon"] : []),
        ...(data.armor ? ["armor"] : []),
        ...(magic ? ["rarity", "attunement", "slot"] : []),
        ...(data.weapon ? ["enhancement"] : []),
      ];
    },
  },
  property: { texts: desc, guided: () => ["mastery"], effects: false },
  language: {
    texts: [
      ["desc", true],
      ["speakers", false],
      ["script", false],
    ],
    guided: () => ["type"],
    effects: false,
  },
  monster: {
    texts: desc,
    guided: () => ["size", "type", "armorClass", "hitPoints", "speed", "abilities", "challenge"],
    effects: false,
  },
  ability: { texts: desc, guided: none, effects: false },
  skill: { texts: desc, guided: () => ["ability"], effects: false },
  proficiency: { texts: desc, guided: () => ["category", "target"], effects: false },
  school: { texts: desc, guided: none, effects: false },
  condition: { texts: desc, guided: none, effects: false },
  alignment: { texts: desc, guided: none, effects: false },
};

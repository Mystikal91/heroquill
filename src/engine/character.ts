import { ABILITIES, type Ability, type Effect } from "../data/schema";
import type { Coins } from "./coins";
import type { CustomFeature } from "./custom";
import type { BoardSlot } from "./slots";
import type { FeatureSetting } from "./uses";
import { uuid } from "./uuid";

export const CHARACTER_SCHEMA_VERSION = 6;

/** How ability scores were generated. Only `manual` has no constraints on the numbers. */
export type AbilityMethod = "manual" | "standard" | "pointbuy" | "roll";

/** Levels taken in one class. The first entry of `Character.classes` is the starting class. */
export interface ClassLevel {
  classId: string;
  level: number;
  subclassId?: string;
  /** Hit die rolls for this class's levels, indexed by level - 1. Missing = average. */
  hpRolls?: number[];
}

/**
 * Spells a character picked for one class. Which lists apply depends on the class: known
 * casters fill `cantrips` and `known`; prepared casters fill `cantrips` and `prepared`;
 * wizards fill `cantrips`, `known` (the spellbook) and `prepared`.
 */
export interface ClassSpells {
  cantrips: string[];
  known: string[];
  prepared: string[];
}

/** Who the character is, in the player's own words. All free text; empty means not written yet. */
export interface Story {
  /** Alignment entry id, e.g. `srd51:alignment/chaotic-good`. */
  alignment?: string;
  /** Deity entry id, from a pack that has deities (the SRD has none). */
  deity?: string;
  personalityTraits: string;
  ideals: string;
  bonds: string;
  flaws: string;
  appearance: string;
  backstory: string;
  allies: string;
  enemies: string;
  /** Anything else worth keeping with the sheet (extra features, reminders). */
  notes: string;
  age: string;
  height: string;
  weight: string;
  eyes: string;
  skin: string;
  hair: string;
}

export const STORY_TEXT_FIELDS = [
  "personalityTraits",
  "ideals",
  "bonds",
  "flaws",
  "appearance",
  "backstory",
  "allies",
  "enemies",
  "notes",
  "age",
  "height",
  "weight",
  "eyes",
  "skin",
  "hair",
] as const;

export function createStory(): Story {
  return Object.fromEntries(STORY_TEXT_FIELDS.map((f) => [f, ""])) as unknown as Story;
}

/** What changes during play: hit points, spent resources, conditions. */
export interface PlayState {
  /** Current hit points. Undefined means "at full health", so levelling up needs no fix-up. */
  hp?: number;
  tempHp: number;
  /** Hit dice spent since the last long rest, by die (`d8`). */
  hitDiceUsed: Record<string, number>;
  /** Spell slots spent per spell level 1..9. */
  slotsUsed: number[];
  /**
   * Slots a sorcerer made from sorcery points (Flexible Casting), by level 1..9: they are added to
   * the slots of the class until a long rest.
   */
  createdSlots?: number[];
  /** Uses spent of limited class features, by resource id (see `ClassResource`). */
  resourcesUsed?: Record<string, number>;
  /** The spell the character is concentrating on, if any. */
  concentration?: string;
  /** The barbarian is raging: resistance to physical damage, and the rage bonus to melee damage. */
  raging?: boolean;
  /** The levels of exhaustion (1 to 6); absent when there are none. See `engine/exhaustion.ts`. */
  exhaustion?: number;
  /** The beast the druid has turned into (Wild Shape), with the hit points of that shape. */
  wildShape?: { monster: string; hp: number; max: number; own?: boolean };
  /** Pact Magic slots spent, when they are kept apart from the shared slots (multiclass warlock). */
  pactUsed?: number;
  deathSaves: { successes: number; failures: number };
  /** Ids of the conditions currently affecting the character. */
  conditions: string[];
  /**
   * The rounds left of what lasts a number of them, by what it is: the id of a condition, or
   * `concentration`, `rage`, `shillelagh` or `sacredWeapon`. Passing
   * the round takes one off each, and what reaches none ends. What has no entry lasts until it is
   * taken off.
   */
  rounds?: Record<string, number>;
  inspiration: boolean;
  /** The die of a Bardic Inspiration the character was given, to add to one d20 roll. */
  bardicDie?: number;
  /**
   * The cantrip Shillelagh is on this weapon (its inventory id): it is magic, uses the spellcasting
   * ability and its damage die is a d8, until a rest ends it.
   */
  shillelagh?: string;
  /**
   * The paladin's Channel Divinity: Sacred Weapon is on this weapon (its inventory id): the
   * Charisma modifier (at least +1) is added to its attack rolls and it is magical, for a minute.
   */
  sacredWeapon?: string;
  /**
   * The spell Magic Weapon is on this weapon (its inventory id), with the bonus to attack and damage
   * it gives (+1, +2 or +3 by the level of the slot): the weapon is magical until a rest ends it.
   */
  magicWeapon?: { itemId: string; bonus: number };
  /**
   * Spells whose effect is counted on the sheet while it lasts (Mage Armor, Shield of Faith): the effects of
   * the spell entry apply as if it were held. A long rest ends them, and so does ending the concentration on one.
   */
  activeSpells?: string[];
  /**
   * Effects the person added by hand, with a name: what another player or the DM put on the character (a
   * blessing, a potion, a ruling). They count on the sheet until they are removed or a long rest ends them.
   */
  customEffects?: CustomEffect[];
}

/** An effect of the Active effects panel written by hand: a name and what it does. */
export interface CustomEffect {
  /** Unique in the list; the name of the effect on the sheet comes from it (`custom:effect/<id>`). */
  id: string;
  name: string;
  effects: Effect[];
  /** Kept on the list but not counted on the sheet (a long rest, or a spent die, turns it off; the person turns it on). */
  off?: boolean;
}

export function createPlayState(): PlayState {
  return {
    tempHp: 0,
    hitDiceUsed: {},
    slotsUsed: Array.from({ length: 9 }, () => 0),
    deathSaves: { successes: 0, failures: 0 },
    conditions: [],
    inspiration: false,
  };
}

/** An item the character owns. `itemId` can be an SRD item or a homebrew one. */
export interface InventoryItem {
  itemId: string;
  quantity: number;
  equipped: boolean;
  /** The place of the board it is worn or held in (see `engine/slots.ts`); when it has none, the first that fits. */
  slot?: BoardSlot | undefined;
  /** An item of the player's own, with no entry in any pack: `itemId` is only a key. Weight is in pounds. */
  custom?: { name: string; weight?: number; note?: string };
  /** A weapon that is magic (made so by a spell such as Magic Weapon, or by a ritual). */
  magical?: boolean;
  /** A bonus to attack and damage rolls that a spell or an enchantment gives (0 to 3). */
  bonus?: number;
  /** A magic item (an entry with `enchants`) that the weapon carries: its bonus and effects apply. */
  enchantment?: string;
}

/** A creature the character has, by the monster it is. Its hit points are kept here. */
export interface Companion {
  /** Stable identity: a character can have two of one kind. */
  id: string;
  /** The monster entry whose stat block it uses. */
  monster: string;
  /** What the character calls it, when not the name of the monster. */
  name?: string;
  /** Current hit points. Undefined means full, so no fix-up is needed when the maximum changes. */
  hp?: number;
  /** The maximum, when the monster has none to give (a stat block that depends on the level). */
  maxHp?: number;
}

/** What gets saved. Everything on the sheet is derived from this by the engine. */
export interface Character {
  /** Stable identity of this character across saves, exports and imports. */
  id: string;
  schemaVersion: typeof CHARACTER_SCHEMA_VERSION;
  ruleset: "srd51" | "srd52";
  name: string;
  /**
   * A picture of the character the person added: a small square image as a `data:` address.
   * It stays on the device and in exported files, but is left out of share links (too big).
   */
  portrait?: string;
  choices: {
    species?: string;
    subspecies?: string;
    background?: string;
  };
  classes: ClassLevel[];
  inventory: InventoryItem[];
  /** The money carried. Absent in characters saved before coins were kept. */
  coins?: Coins;
  /** Creatures the character has: a familiar, a beast, a defender. Absent when there are none. */
  companions?: Companion[];
  /** The Beast forms a 2024 druid knows for Wild Shape (monster ids), as many as the class table allows. */
  wildShapeForms?: string[];
  /**
   * The optional rules switched on for this character (ids of `option` entries, such as
   * Tasha's customised origin). Other rules ask for them by id, and their own effects apply.
   */
  options?: string[];
  /** Features the person wrote for this character, with the uses they have between rests. */
  custom?: CustomFeature[];
  /**
   * What the person decided about the features, traits and feats the character has, by entry id:
   * how many uses they have (where the data does not say), and whether the sheet hides them.
   */
  featureSettings?: Record<string, FeatureSetting> | undefined;
  abilityBase: Record<Ability, number>;
  abilityMethod: AbilityMethod;
  /** The six rolled values, when `abilityMethod` is `roll`. */
  abilityRolls?: number[];
  /**
   * Picks for the choices that species, class, background and traits offer, keyed by
   * `<entry id>/<choice id>`. Each value is the list of selected options.
   */
  selections: Record<string, string[]>;
  /** Spell picks, keyed by class id. */
  spells: Record<string, ClassSpells>;
  play: PlayState;
  story: Story;
  /**
   * Ability Score Improvements taken, one entry per improvement: one ability is +2,
   * two different abilities are +1 each.
   */
  asi: Ability[][];
  /** Feats taken. Each one uses up an ability score improvement. */
  feats: string[];
  /** Free edit: a forced value for a derived field, e.g. `ability.int`. Always wins. */
  overrides: Record<string, number | string | boolean>;
  /** Free edit: defenses written by hand (a resistance, an immunity, a vulnerability or a flat reduction), added to the rules'. */
  extraDefenses?: ExtraDefense[] | undefined;
}

/**
 * A defense the person wrote by hand. `damage` is a kind of damage (`fire`, or one a pack adds); for a
 * reduction it may be empty (every kind), and `amount` is what is taken off a hit.
 */
export interface ExtraDefense {
  kind: "resistance" | "immunity" | "vulnerability" | "reduction";
  damage?: string | undefined;
  amount?: number | undefined;
  note?: string | undefined;
}

export function createCharacter(ruleset: Character["ruleset"]): Character {
  return {
    id: uuid(),
    schemaVersion: CHARACTER_SCHEMA_VERSION,
    ruleset,
    name: "",
    choices: {},
    classes: [],
    inventory: [],
    abilityBase: Object.fromEntries(ABILITIES.map((a) => [a, 10])) as Record<Ability, number>,
    abilityMethod: "manual",
    selections: {},
    spells: {},
    play: createPlayState(),
    story: createStory(),
    asi: [],
    feats: [],
    overrides: {},
  };
}

import { ABILITIES, type Ability } from "../data/schema";
import { STANDARD_ARRAY } from "./abilityScores";
import type { PendingChoice } from "./choices";

/**
 * What the build screen picks for a person who asks it to ("Assign for me", "Choose for me"): the
 * usual order of the abilities for a class, the picks of a choice that suit the character, and spells
 * that most players of a class take first. Everything is a starting point the person can change.
 */

/** The abilities in the order a class usually wants them, by the slug of the class (the 2014 classes). */
export const CLASS_PRIORITY: Record<string, readonly Ability[]> = {
  artificer: ["int", "con", "dex", "wis", "cha", "str"],
  barbarian: ["str", "con", "dex", "wis", "cha", "int"],
  bard: ["cha", "dex", "con", "wis", "int", "str"],
  cleric: ["wis", "con", "str", "dex", "int", "cha"],
  druid: ["wis", "con", "dex", "int", "cha", "str"],
  fighter: ["str", "con", "dex", "wis", "cha", "int"],
  monk: ["dex", "wis", "con", "str", "int", "cha"],
  paladin: ["str", "cha", "con", "wis", "dex", "int"],
  ranger: ["dex", "wis", "con", "str", "int", "cha"],
  rogue: ["dex", "con", "int", "wis", "cha", "str"],
  sorcerer: ["cha", "con", "dex", "wis", "int", "str"],
  warlock: ["cha", "con", "dex", "wis", "int", "str"],
  wizard: ["int", "con", "dex", "wis", "cha", "str"],
};

/** After the abilities a class names, the ones every character is glad to have. */
const FALLBACK: readonly Ability[] = ["con", "dex", "wis", "str", "int", "cha"];

/**
 * The order of the abilities for a class: the table for a class it knows (by the end of the id, so a
 * class of another book with the same name counts too), else the abilities its multiclassing asks for,
 * then the others.
 */
export function abilityPriority(classId: string | undefined, required: readonly Ability[] = []) {
  const slug = classId?.split("/").pop() ?? "";
  const known = CLASS_PRIORITY[slug];
  if (known) return [...known];
  const first = required.filter((a, i) => ABILITIES.includes(a) && required.indexOf(a) === i);
  return [...first, ...FALLBACK.filter((a) => !first.includes(a))];
}

/** The six values given to the abilities in that order: the highest to the first. */
export function suggestedBase(
  order: readonly Ability[],
  values: readonly number[] = STANDARD_ARRAY,
): Record<Ability, number> {
  const sorted = [...values].sort((a, b) => b - a);
  const base = {} as Record<Ability, number>;
  order.forEach((ability, i) => {
    base[ability] = sorted[i] ?? 8;
  });
  return base;
}

/** What `suggestPicks` needs to know of the character. */
export interface PickContext {
  /** The option is already the character's (a language or a skill held from elsewhere). */
  held: (option: string) => boolean;
  /** The ability of a skill (`stealth` → `dex`), for skill choices. */
  skillAbility: (skill: string) => Ability | undefined;
  /** The character's ability modifiers. */
  modifier: Record<Ability, number>;
  /** The abilities in the order the class wants them. */
  priority: readonly Ability[];
}

/** The kinds of choice the build screen may fill by itself: the rest (feats, spells, traits) are the person's. */
export const FILLABLE = new Set(["proficiency", "language", "expertise", "abilityBonus"]);

/**
 * The options to add to a choice so that it is complete: for a skill the ones of the character's best
 * abilities, for a language the first ones not known, for an ability bonus the class's abilities. Nothing
 * for a kind it does not fill, or when nothing is left to choose.
 */
export function suggestPicks(choice: PendingChoice, ctx: PickContext): string[] {
  if (!FILLABLE.has(choice.grants) || choice.remaining <= 0) return [];
  const free = choice.options.filter(
    (option) => !choice.selected.includes(option) && !ctx.held(option),
  );
  const rank = (ability: Ability | undefined) =>
    ability === undefined ? -99 : ctx.modifier[ability] * 10 - ctx.priority.indexOf(ability);
  let ordered = free;
  if (choice.grants === "abilityBonus")
    ordered = [...free].sort(
      (a, b) => ctx.priority.indexOf(a as Ability) - ctx.priority.indexOf(b as Ability),
    );
  else if (choice.grants === "proficiency" || choice.grants === "expertise") {
    const skillOf = (option: string) => {
      const [category, target = ""] = option.includes(":") ? option.split(":") : ["skill", option];
      return category === "skill" ? ctx.skillAbility(target) : undefined;
    };
    // Skills by how good the character is at them; tools and the rest keep their order, after.
    ordered = [...free].sort((a, b) => rank(skillOf(b)) - rank(skillOf(a)));
  }
  return ordered.slice(0, choice.remaining);
}

/** Spells most players of a class take first, by the slug of the class and of the spells (the SRD's). */
export const SUGGESTED_SPELLS: Record<string, readonly string[]> = {
  bard: [
    "vicious-mockery",
    "minor-illusion",
    "light",
    "mage-hand",
    "healing-word",
    "dissonant-whispers",
    "faerie-fire",
    "sleep",
    "charm-person",
    "cure-wounds",
    "thunderwave",
  ],
  cleric: [
    "sacred-flame",
    "guidance",
    "light",
    "thaumaturgy",
    "spare-the-dying",
    "cure-wounds",
    "bless",
    "healing-word",
    "guiding-bolt",
    "shield-of-faith",
    "sanctuary",
  ],
  druid: [
    "produce-flame",
    "guidance",
    "shillelagh",
    "druidcraft",
    "cure-wounds",
    "healing-word",
    "entangle",
    "faerie-fire",
    "thunderwave",
    "goodberry",
  ],
  paladin: ["bless", "cure-wounds", "shield-of-faith", "divine-favor", "command", "heroism"],
  ranger: ["hunters-mark", "cure-wounds", "goodberry", "fog-cloud", "ensnaring-strike"],
  sorcerer: [
    "fire-bolt",
    "ray-of-frost",
    "light",
    "mage-hand",
    "prestidigitation",
    "magic-missile",
    "shield",
    "burning-hands",
    "sleep",
    "chromatic-orb",
    "mage-armor",
  ],
  warlock: [
    "eldritch-blast",
    "minor-illusion",
    "mage-hand",
    "prestidigitation",
    "hex",
    "armor-of-agathys",
    "hellish-rebuke",
    "charm-person",
    "witch-bolt",
  ],
  wizard: [
    "fire-bolt",
    "mage-hand",
    "light",
    "ray-of-frost",
    "prestidigitation",
    "magic-missile",
    "shield",
    "mage-armor",
    "sleep",
    "detect-magic",
    "burning-hands",
    "thunderwave",
    "find-familiar",
  ],
};

/**
 * The spells to add to a list so that it is full: the suggested ones of the class first (in their
 * order), then the lowest levels of the pool by name. `allowed` says how many; `level` and `name` read
 * the pool; `barred` leaves out what a school limit does not allow.
 */
export function suggestSpells(
  classId: string,
  pool: readonly string[],
  chosen: readonly string[],
  allowed: number,
  level: (id: string) => number,
  name: (id: string) => string,
  barred: (id: string) => boolean = () => false,
): string[] {
  const wanted = allowed - chosen.length;
  if (wanted <= 0) return [];
  const slug = classId.split("/").pop() ?? "";
  const favourite = SUGGESTED_SPELLS[slug] ?? [];
  const rank = (id: string) => {
    const at = favourite.indexOf(id.split("/").pop() ?? "");
    return at === -1 ? favourite.length : at;
  };
  const open = pool.filter((id) => !chosen.includes(id) && !barred(id));
  const ordered = [...open].sort(
    (a, b) => rank(a) - rank(b) || level(a) - level(b) || name(a).localeCompare(name(b)),
  );
  return ordered.slice(0, wanted);
}

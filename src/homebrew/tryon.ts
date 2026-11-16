import type { Entry } from "../data/schema";
import { ABILITIES } from "../data/schema";
import { type Character, createCharacter } from "../engine/character";
import { type DerivedSheet, deriveSheet } from "../engine/derive";

/**
 * Trying an entry on a character: the same character with and without it, and what differs. The
 * person sees at once what an effect does to the sheet, instead of making a character to find out.
 */

export interface TryOptions {
  ruleset: "srd51" | "srd52";
  /** The class the character has; a class that is being tried replaces it. */
  classId: string;
  level: number;
}

export const SAMPLE_CLASSES = [
  "fighter",
  "wizard",
  "cleric",
  "rogue",
  "barbarian",
  "bard",
] as const;

/** The kinds of entry that change a character's sheet when they are put on it. */
export const TRYABLE_KINDS = [
  "species",
  "subspecies",
  "class",
  "subclass",
  "background",
  "feat",
  "item",
] as const;

export const canTry = (entry: Entry): boolean =>
  (TRYABLE_KINDS as readonly string[]).includes(entry.kind);

/** A plain character of the sample class and level, with middling scores. */
function sample(options: TryOptions): Character {
  const c = createCharacter(options.ruleset);
  c.name = "Sample";
  c.classes = [{ classId: options.classId, level: options.level }];
  c.abilityBase = { str: 14, dex: 12, con: 14, int: 12, wis: 12, cha: 12 };
  return c;
}

/** The sample character with the entry on it: species chosen, class taken, feat added, item worn. */
export function withEntry(entry: Entry, options: TryOptions): Character | undefined {
  const c = sample(options);
  const level = options.level;
  switch (entry.kind) {
    case "species":
      c.choices.species = entry.id;
      return c;
    case "subspecies":
      if (!entry.parent) return undefined;
      c.choices.species = entry.parent;
      c.choices.subspecies = entry.id;
      return c;
    case "class":
      c.classes = [{ classId: entry.id, level }];
      return c;
    case "subclass":
      if (!entry.parent) return undefined;
      c.classes = [{ classId: entry.parent, level, subclassId: entry.id }];
      return c;
    case "background":
      c.choices.background = entry.id;
      return c;
    case "feat":
      c.feats = [entry.id];
      return c;
    case "item":
      c.inventory = [{ itemId: entry.id, quantity: 1, equipped: true }];
      return c;
    default:
      return undefined;
  }
}

/** The numbers worth comparing: each as a label key, a value before and after. */
export interface Fact {
  key: string;
  before: string;
  after: string;
  changed: boolean;
}

const signed = (n: number) => (n >= 0 ? `+${n}` : String(n));

function factsOf(sheet: DerivedSheet): [string, string][] {
  return [
    ["ac", String(sheet.armorClass.value)],
    ["hp", String(sheet.hitPoints.max)],
    ["speed", sheet.speed === undefined ? "—" : String(sheet.speed)],
    ["initiative", signed(sheet.initiative)],
    ["proficiency", signed(sheet.proficiencyBonus)],
    ...ABILITIES.map((a): [string, string] => [`ability:${a}`, String(sheet.abilities[a].score)]),
    [
      "slots",
      sheet.spellSlots
        .map((n, i) => (n > 0 ? `${i + 1}×${n}` : ""))
        .filter(Boolean)
        .join(" ") || "—",
    ],
    [
      "senses",
      Object.entries(sheet.senses)
        .map(([s, n]) => `${s} ${n}`)
        .join(", ") || "—",
    ],
    [
      "movement",
      Object.entries(sheet.movement)
        .flatMap(([mode, speed]) =>
          speed ? [`${mode} ${speed.feet}${speed.half ? " (½)" : ""}`] : [],
        )
        .join(", ") || "—",
    ],
    ["defenses", Object.values(sheet.defenses).flat().join(", ") || "—"],
    ["traits", String(sheet.traits.length + sheet.features.length)],
    ["attacks", String(sheet.attacks.length)],
  ];
}

export interface TryResult {
  facts: Fact[];
  /** Names (ids) of the traits and features the entry brings, which the plain character does not have. */
  gained: string[];
  /** Ids of the proficiencies the entry brings. */
  proficiencies: string[];
}

/**
 * The comparison for an entry, with the pack's own entries added to the content so that what has
 * not been saved yet counts too. Undefined for an entry that does not go on a character.
 */
export function tryOn(
  entry: Entry,
  index: ReadonlyMap<string, Entry>,
  options: TryOptions,
): TryResult | undefined {
  const withIt = withEntry(entry, options);
  if (!withIt) return undefined;
  const before = deriveSheet(sample(options), index as Map<string, Entry>);
  const after = deriveSheet(withIt, index as Map<string, Entry>);
  const b = new Map(factsOf(before));
  const facts = factsOf(after).map(([key, value]): Fact => {
    const was = b.get(key) ?? "—";
    return { key, before: was, after: value, changed: was !== value };
  });
  const had = new Set([...before.traits, ...before.features]);
  const gained = [...after.traits, ...after.features].filter((id) => !had.has(id));
  const profs = Object.values(after.proficiencies).flat();
  const hadProf = new Set(Object.values(before.proficiencies).flat());
  return { facts, gained, proficiencies: profs.filter((p) => !hadProf.has(p)) };
}

import type { ClassData } from "../data/progression";
import type { Ability } from "../data/schema";

export type ResourceRecovery = "short" | "long";

/**
 * Something a class lets the character use a limited number of times between rests.
 * `kind` names it for the interface (translated there); `id` is stable and unique, so the
 * uses spent can be saved under it.
 */
export interface ClassResource {
  id: string;
  kind: string;
  classId: string;
  max: number;
  recovery: ResourceRecovery;
  /** Counted in points (ki, lay on hands) rather than a few uses to tick off. */
  pool?: boolean;
  /** A short rest gives back only this many uses, not all of them (the 2024 Rage: one). */
  shortRegain?: number;
  /** No limit at this level (a barbarian's rages at level 20). */
  unlimited?: boolean;
  /** A level of spell or similar number the label needs. */
  level?: number;
  /** For a reserve the pack declares and several sources share: its name as a slug (the label is the pack's text for it). */
  reserve?: string;
  /** The name to show, for what a person wrote (a custom feature): there is nothing to translate. */
  name?: string;
  /** The entry (feature, trait, feat) that gives these uses: its name is the label. */
  entry?: string;
  /** A spell that can be cast once between rests without a slot: its name is part of the label. */
  spell?: string;
  /**
   * For a resource worked out from the class table: a pattern for the slugs of the features it
   * stands for (all the `channel-divinity-*` ones), so that what a person sets for one of them
   * changes this resource instead of making a second one.
   */
  covers?: string;
}

/** A class number worth showing during play: a die, a bonus. */
export interface ClassFact {
  kind: string;
  params: Record<string, string | number>;
}

/**
 * Damage that a class adds to its attacks, with when it applies written out in the interface:
 * a die once per turn (sneak attack), a bonus while raging, extra dice on a critical hit, a
 * smite that spends a slot, and the die that martial arts uses for unarmed strikes.
 */
export type ExtraDamage =
  | { kind: "sneakAttack"; dice: string }
  | { kind: "rage"; bonus: number }
  | { kind: "brutalCritical"; dice: number }
  | { kind: "divineSmite" }
  | { kind: "martialArts"; dice: string }
  /** Damage a feature adds (Divine Strike): the entry that gives it, the dice now and the kind of damage. */
  | { kind: "feature"; entry: string; dice: string; damageType: string; note: "oncePerTurn" };

interface Input {
  classId: string;
  level: number;
  data: ClassData;
  modifier: (ability: Ability) => number;
  /** For the saving throws of a class feature (the ki save DC). */
  proficiencyBonus?: number;
  ruleset?: string;
}

const slug = (classId: string) => classId.split("/")[1] ?? classId;

const fraction = (cr: number) => (cr === 0.25 ? "1/4" : cr === 0.5 ? "1/2" : String(cr));

/** The limited-use features of one class at its level, and the numbers that go with them. */
export function classResources(input: Input): {
  resources: ClassResource[];
  facts: ClassFact[];
  extras: ExtraDamage[];
} {
  const { classId, level, data, modifier } = input;
  const row = data.levels.find((l) => l.level === level)?.classSpecific ?? {};
  const num = (key: string) => (typeof row[key] === "number" ? (row[key] as number) : 0);
  const resources: ClassResource[] = [];
  const facts: ClassFact[] = [];
  const extras: ExtraDamage[] = [];
  const add = (
    kind: string,
    max: number,
    recovery: ResourceRecovery,
    extra: Partial<ClassResource> = {},
  ) => {
    if (max > 0)
      resources.push({ id: `${kind}:${slug(classId)}`, kind, classId, max, recovery, ...extra });
  };

  switch (slug(classId)) {
    case "barbarian": {
      const rages = num("rageCount");
      // The data writes "unlimited" as a huge number.
      // The 2024 feature is `barbarian-rage`.
      // In 2024 a short rest gives back one expended use; all of them come back with a long rest.
      add("rage", Math.min(rages, 99), "long", {
        unlimited: rages >= 99,
        covers: "^(barbarian-)?rage$",
        ...(input.ruleset === "srd52" && { shortRegain: 1 }),
      });
      if (num("rageDamageBonus") > 0) {
        facts.push({ kind: "rageDamage", params: { n: num("rageDamageBonus") } });
        extras.push({ kind: "rage", bonus: num("rageDamageBonus") });
      }
      if (num("brutalCriticalDice") > 0)
        extras.push({ kind: "brutalCritical", dice: num("brutalCriticalDice") });
      break;
    }
    case "bard":
      add("bardicInspiration", Math.max(1, modifier("cha")), level >= 5 ? "short" : "long", {
        covers: "^(bard-)?(bardic-inspiration|font-of-inspiration)",
      });
      if (num("bardicInspirationDie") > 0)
        facts.push({ kind: "bardicDie", params: { die: num("bardicInspirationDie") } });
      break;
    case "cleric":
      if (input.ruleset === "srd52")
        // Two uses, more by level; one comes back on a short rest, all of them on a long one.
        add("channelDivinity", num("channelDivinityCharges"), "long", {
          covers: "^cleric-channel-divinity$",
          shortRegain: 1,
        });
      else
        add("channelDivinity", num("channelDivinityCharges"), "short", {
          covers: "^channel-divinity",
        });
      break;
    case "druid":
      if (input.ruleset === "srd52")
        // The uses are the table's; one comes back on a short rest, all of them on a long one.
        add("wildShape", num("wildShapeUses"), "long", {
          covers: "^druid-wild-shape$",
          shortRegain: 1,
        });
      // The Archdruid, at the 20th level, can Wild Shape as often as wanted.
      else if (level >= 2)
        add("wildShape", level >= 20 ? 99 : 2, "short", {
          covers: "^wild-shape",
          ...(level >= 20 && { unlimited: true }),
        });
      if (num("wildShapeMaxCr") > 0)
        facts.push({ kind: "wildShape", params: { cr: fraction(num("wildShapeMaxCr")) } });
      break;
    case "fighter":
      add("actionSurge", num("actionSurges"), "short", { covers: "^action-surge" });
      add("indomitable", num("indomitableUses"), "long", { covers: "^indomitable" });
      break;
    case "monk": {
      add("ki", num("kiPoints"), "short", { pool: true, covers: "^ki$" });
      // The 2024 monk has Focus Points (the feature Monk's Focus) and a martial arts die written as a number.
      add("focus", num("focusPoints"), "short", { pool: true, covers: "^monk-monks-focus$" });
      const art = row.martialArts as { diceCount?: number; diceValue?: number } | undefined;
      const die = art?.diceValue ?? (num("martialArtsDie") || undefined);
      if (die) {
        const dice = `${art?.diceCount ?? 1}d${die}`;
        facts.push({ kind: "martialArts", params: { dice } });
        extras.push({ kind: "martialArts", dice });
      }
      // Stunning Strike and the other features that make a creature save: 8 + proficiency + Wisdom.
      if (input.proficiencyBonus !== undefined && (num("kiPoints") > 0 || num("focusPoints") > 0))
        facts.push({
          kind: num("focusPoints") > 0 ? "focusSaveDc" : "kiSaveDc",
          params: { dc: 8 + input.proficiencyBonus + input.modifier("wis") },
        });
      break;
    }
    case "paladin": {
      const edition2024 = input.ruleset === "srd52";
      add("layOnHands", 5 * level, "long", { pool: true, covers: "^(paladin-)?lay-on-hands$" });
      // In 2024 Divine Smite is a spell (Paladin's Smite always has it prepared), so there is no smite button.
      if (level >= 2 && !edition2024) extras.push({ kind: "divineSmite" });
      if (edition2024)
        // Two uses, three from level 11; one comes back on a short rest, all on a long one.
        add("channelDivinity", num("channelDivinityCharges"), "long", {
          covers: "(^|-)channel-divinity$",
          shortRegain: 1,
        });
      else if (level >= 3) add("channelDivinity", 1, "short", { covers: "^channel-divinity" });
      break;
    }
    case "rogue": {
      const sneak = row.sneakAttack as { diceCount?: number; diceValue?: number } | undefined;
      if (sneak?.diceCount) {
        const dice = `${sneak.diceCount}d${sneak.diceValue ?? 6}`;
        facts.push({ kind: "sneakAttack", params: { dice } });
        extras.push({ kind: "sneakAttack", dice });
      }
      break;
    }
    case "sorcerer":
      add("sorceryPoints", num("sorceryPoints"), "long", {
        pool: true,
        covers: "^(sorcerer-)?font-of-magic$",
      });
      break;
    case "warlock": {
      // In 2024 the one feature Mystic Arcanum comes at levels 11, 13, 15 and 17, a spell of level 6, 7, 8 and 9 each time.
      const arcana =
        input.ruleset === "srd52"
          ? data.levels
              .filter((l) => l.level <= level)
              .reduce(
                (n, l) => n + l.features.filter((f) => f.endsWith("-mystic-arcanum")).length,
                0,
              )
          : 0;
      for (let k = 1; k <= arcana; k++)
        resources.push({
          id: `mysticArcanum${5 + k}:${slug(classId)}`,
          kind: "mysticArcanum",
          classId,
          max: 1,
          recovery: "long",
          level: 5 + k,
          covers: "^warlock-mystic-arcanum$",
        });
      for (const spellLevel of [6, 7, 8, 9]) {
        if (num(`mysticArcanumLevel_${spellLevel}`) > 0) {
          resources.push({
            id: `mysticArcanum${spellLevel}:${slug(classId)}`,
            kind: "mysticArcanum",
            classId,
            max: 1,
            recovery: "long",
            level: spellLevel,
            covers: `^mystic-arcanum-${spellLevel}th-level$`,
          });
        }
      }
      break;
    }
    case "wizard":
      // In 2024 Arcane Recovery gives back slots of a combined level up to half the Wizard level, rounded up.
      if (input.ruleset === "srd52")
        facts.push({ kind: "arcaneRecovery", params: { levels: Math.ceil(level / 2) } });
      else if (num("arcaneRecoveryLevels") > 0)
        facts.push({ kind: "arcaneRecovery", params: { levels: num("arcaneRecoveryLevels") } });
      break;
  }
  return { resources, facts, extras };
}

/** The counters each entry gives, in order: a feat can give several (Fey Touched: two free spells). */
export function resourcesByEntry(resources: ClassResource[]): Map<string, ClassResource[]> {
  const byEntry = new Map<string, ClassResource[]>();
  for (const r of resources)
    if (r.entry) byEntry.set(r.entry, [...(byEntry.get(r.entry) ?? []), r]);
  return byEntry;
}
